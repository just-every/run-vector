import { createOperatorAuth, AuthError, type RolePolicy } from '../../../../vendor/base/operator-auth/index.mjs'
import { hostedMailSender } from '../../platform/mail'
import type { WorkerBindings } from '../../app/bindings'
import { developmentSender, localMailEnabled } from './development.server'
import branding from '../../../branding.json'
import { createUlid } from '../../shared/ids'

// Every Base operator keeps Base's owner role as an implementation detail (0011),
// so Base's last-owner constraint still protects the last Vector operator. The
// product role on the Vector record decides (ROLE-001): Owners and Admins invite,
// and Members only while the workspace lets them (operator.management.v1). The
// role an invitation grants is Vector's (vector_invitation_roles); Base links
// are always owner links, checked again when accepted.
function productRoles(db: D1Database): RolePolicy {
  return async ({ actor, action, target, role }) => {
    if (['sessions:list', 'sessions:revoke'].includes(action)) return target?.id === actor.id
    if (action !== 'operators:invite' && action !== 'operators:list') return false
    const current = await db.prepare(`SELECT o.role,w.member_invites AS memberInvites FROM vector_auth_operators m
      JOIN operators o ON o.id=m.operator_id JOIN workspace_settings w ON w.id=o.workspace_id
      WHERE m.auth_id=? AND o.removed_at IS NULL`).bind(actor.id).first<{ role: string; memberInvites: number }>()
    if (!current) return false
    if (action === 'operators:list') return current.role !== 'guest'
    return role === 'owner' && (['owner', 'admin'].includes(current.role) || current.role === 'member' && current.memberInvites === 1)
  }
}

/** The operator-auth configuration; the local-only dev entry builds the same one. */
export function authConfig(env: WorkerBindings) {
  return { origin: env.APP_ORIGIN, OWNER_EMAIL: env.FIRST_OWNER_EMAIL!, SESSION_SECRET: env.SESSION_SECRET!, SETUP_TOKEN: env.SETUP_TOKEN, dependencies: true, MAIL_FROM: env.MAIL_FROM,
    local: localMailEnabled(env), branding: { productName: branding.name, accentColor: branding.color, signInPath: '/signin', theme: '/brand/confirmation.css' } }
}

export function baseAuth(env: WorkerBindings) {
  if (!env.SESSION_SECRET || env.SESSION_SECRET.length < 32)
    throw new AuthError('SESSION_SECRET_required', 503)
  if (!env.FIRST_OWNER_EMAIL) throw new AuthError('FIRST_OWNER_EMAIL_required', 503)
  const local = localMailEnabled(env)
  if (local && !['localhost', '127.0.0.1', '[::1]'].includes(new URL(env.APP_ORIGIN).hostname))
    throw new AuthError('local_outbox_requires_loopback', 503)
  if (!env.MAIL_FROM) throw new AuthError('MAIL_FROM_required', 503)
  const capture = local || env.RER_DEMO === '1'
  if (!capture && !['sendgrid', 'resend', 'rer'].includes(env.MAIL_PROVIDER ?? '')) throw new AuthError('MAIL_PROVIDER_required', 503)
  // A mail key enables email delivery. Native owner claim, sessions and linked
  // identity providers remain available before optional mail is configured.
  const sender = capture ? developmentSender(env) : hostedMailSender(env)
  return createOperatorAuth({
    db: env.DB,
    config: authConfig(env),
    mailSender: sender, rolePolicy: productRoles(env.DB),
    clientIp: request => local ? 'loopback' : request.headers.get('CF-Connecting-IP') ?? '',
  })
}

/** Base's accepted invitation creates the product record only after admission.
 * The SQL rechecks current authority and atomically installs its stable ULID map.
 * The role is the one the accepted link was issued for; a person admitted
 * without an invitation (a local dev persona) is a Member. */
export async function productOperator(db: D1Database, authId: string) {
  const existing = await mappedOperator(db, authId)
  if (existing) return existing
  const at = new Date().toISOString()
  await db.batch([db.prepare(`INSERT INTO operators(id,workspace_id,name,email,role,created_at,updated_at)
    SELECT ?,w.id,a.display_name,a.email,COALESCE((SELECT r.role FROM oa_tokens t JOIN vector_invitation_roles r ON r.token_id=t.id
      WHERE t.operator_id=a.id AND t.kind='invite' AND t.consumed_at IS NOT NULL ORDER BY t.consumed_at DESC LIMIT 1),'member'),?,?
    FROM oa_operators a CROSS JOIN workspace_settings w
    WHERE a.id=? AND a.status='active'
    AND NOT EXISTS(SELECT 1 FROM vector_auth_operators WHERE auth_id=a.id)
    AND (SELECT count(*) FROM workspace_settings)=1
    ON CONFLICT DO NOTHING`).bind(createUlid(new Date()), at, at, authId),
    db.prepare(`INSERT OR IGNORE INTO team_members(team_id,operator_id,role,created_at,updated_at)
      SELECT t.id,m.operator_id,'member',?,? FROM vector_auth_operators m JOIN operators o ON o.id=m.operator_id
      JOIN oa_tokens token ON token.operator_id=m.auth_id AND token.kind='invite' AND token.consumed_at IS NOT NULL
      JOIN vector_invitation_roles r ON r.token_id=token.id JOIN json_each(r.team_ids_json) invited
      JOIN teams t ON t.id=invited.value AND t.workspace_id=o.workspace_id
      WHERE m.auth_id=? AND o.role='guest' AND token.id=(SELECT id FROM oa_tokens WHERE operator_id=m.auth_id AND kind='invite' AND consumed_at IS NOT NULL ORDER BY consumed_at DESC LIMIT 1)`)
      .bind(at,at,authId),
  ])
  return mappedOperator(db, authId)
}
async function mappedOperator(db: D1Database, authId: string) {
  return db.prepare(`SELECT o.id,o.name,o.email,o.workspace_id AS workspaceId FROM vector_auth_operators m
    JOIN operators o ON o.id=m.operator_id JOIN oa_operators a ON a.id=m.auth_id
    WHERE m.auth_id=? AND o.removed_at IS NULL AND a.status='active'`).bind(authId)
    .first<{ id: string; name: string; email: string; workspaceId: string }>()
}
