import { createOperatorAuth, AuthError, type RolePolicy, type MailMessage } from '../../../../vendor/base/operator-auth/index.mjs'
// Base mail ships native ESM without declarations. The adapter owns its narrow boundary.
// @ts-expect-error Base mail has no declaration file.
import { createMailSender } from '../../../../vendor/base/mail/index.mjs'
import type { WorkerBindings } from '../../app/bindings'
import { createUlid } from '../../shared/ids'

// There are no product roles. All admitted operators use Base's owner authority;
// its last-owner constraint therefore also protects the last Vector operator.
const equalOperators: RolePolicy = ({ actor, action, target, role }) =>
  action === 'operators:invite' ? role === 'owner' :
  action === 'operators:list' ||
  (['sessions:list', 'sessions:revoke'].includes(action) && target?.id === actor.id)

export function localCompatibility(env: WorkerBindings) {
  const host = new URL(env.APP_ORIGIN).hostname
  return !env.SESSION_SECRET && env.MAIL_MODE === 'local-outbox' && ['localhost', '127.0.0.1', '[::1]', 'vector.test'].includes(host)
}

/** Explicit local outbox, also shared by the retained local fixture dialect. */
export function localMailSender(db: D1Database, link?: string, legacyLinkId?: string) {
  return createMailSender({ provider: 'development', mode: 'development' }, {
    outbox: { async put(message: MailMessage) {
      const url = link ?? message.text?.match(/https?:\/\/[^\s]+/)?.[0]
      if (!url) throw new Error('Auth mail has no confirmation URL.')
      const at = new Date().toISOString()
      await db.prepare(`INSERT INTO local_mail_outbox(id,recipient,sign_in_url,created_at,updated_at) SELECT ?,?,?,?,? WHERE ? IS NULL OR EXISTS(SELECT 1 FROM magic_links m JOIN operators o ON o.id=m.operator_id WHERE m.id=? AND o.removed_at IS NULL)`)
        .bind(message.deliveryId, message.to[0], url, at, at, legacyLinkId ?? null, legacyLinkId ?? null).run()
    } },
  })
}

export function baseAuth(env: WorkerBindings) {
  if (!env.SESSION_SECRET || env.SESSION_SECRET.length < 32)
    throw new AuthError('SESSION_SECRET_required', 503)
  if (!env.FIRST_OWNER_EMAIL) throw new AuthError('FIRST_OWNER_EMAIL_required', 503)
  const local = env.MAIL_MODE === 'local-outbox'
  if (local && !['localhost', '127.0.0.1', '[::1]'].includes(new URL(env.APP_ORIGIN).hostname))
    throw new AuthError('local_outbox_requires_loopback', 503)
  if (!env.MAIL_FROM) throw new AuthError('MAIL_FROM_required', 503)
  if (!local && env.MAIL_PROVIDER !== 'sendgrid') throw new AuthError('MAIL_PROVIDER_sendgrid_required', 503)
  if (!local && !env.MAIL_API_KEY) throw new AuthError('MAIL_API_KEY_required', 503)
  const sender = local ? localMailSender(env.DB) : createMailSender({ provider: 'sendgrid', mode: 'production', apiKey: env.MAIL_API_KEY! })
  return createOperatorAuth({
    db: env.DB,
    config: { origin: env.APP_ORIGIN, OWNER_EMAIL: env.FIRST_OWNER_EMAIL,
      SESSION_SECRET: env.SESSION_SECRET, MAIL_FROM: env.MAIL_FROM, local },
    mailSender: sender, rolePolicy: equalOperators,
    clientIp: request => local ? 'loopback' : request.headers.get('CF-Connecting-IP') ?? '',
  })
}

/** Base's accepted invitation creates the product record only after admission.
 * The SQL rechecks current authority and atomically installs its stable ULID map. */
export async function productOperator(db: D1Database, authId: string) {
  const existing = await mappedOperator(db, authId)
  if (existing) return existing
  const at = new Date().toISOString()
  await db.prepare(`INSERT INTO operators(id,workspace_id,name,email,created_at,updated_at)
    SELECT ?,w.id,a.display_name,a.email,?,? FROM oa_operators a CROSS JOIN workspace_settings w
    WHERE a.id=? AND a.status='active'
    AND NOT EXISTS(SELECT 1 FROM vector_auth_operators WHERE auth_id=a.id)
    AND (SELECT count(*) FROM workspace_settings)=1
    ON CONFLICT DO NOTHING`).bind(createUlid(new Date()), at, at, authId).run()
  return mappedOperator(db, authId)
}
async function mappedOperator(db: D1Database, authId: string) {
  return db.prepare(`SELECT o.id,o.name,o.email FROM vector_auth_operators m
    JOIN operators o ON o.id=m.operator_id JOIN oa_operators a ON a.id=m.auth_id
    WHERE m.auth_id=? AND o.removed_at IS NULL AND a.status='active'`).bind(authId)
    .first<{ id: string; name: string; email: string }>()
}
