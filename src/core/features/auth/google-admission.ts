import { AuthError, type Principal, type CompletedSession } from '../../../../vendor/base/operator-auth/index.mjs'
import { trustedEmail } from '../../../../vendor/base/operator-auth/identity/index.mjs'
// @ts-expect-error Base server-only credential primitives have no declarations.
import { opaqueToken, hashToken } from '../../../../vendor/base/operator-auth/crypto.mjs'
// @ts-expect-error Base server-only cookie helper has no declarations.
import { sessionCookie } from '../../../../vendor/base/operator-auth/http.mjs'
import { authConfig, baseAuth, productOperator } from './base.server'
import { googleOwner, type GoogleConfiguration } from './google-settings'
import { createUlid } from '../../shared/ids'
import type { WorkerBindings } from '../../app/bindings'

/** A verified Google principal still needs current native membership or a live
 * native invitation. Google never creates an uninvited product identity. */
export async function admitGoogle(env:WorkerBindings,request:Request,principal:Principal,row:GoogleConfiguration,test:boolean,returnTo:string):Promise<CompletedSession> {
  const email=trustedEmail(principal,Date.now())
  if(!email || principal.issuer!=='https://accounts.google.com') throw new AuthError('invalid_identity',403)
  if(test) {
    const {operator,db}=await googleOwner(env,request)
    if(operator.email!==email || operator.fence.sessionId!==row.test_session_id) throw new AuthError('google_test_owner_required',403)
    await db.batch([
      db.prepare("SELECT CASE WHEN EXISTS(SELECT 1 FROM vector_google_configuration WHERE generation=? AND test_session_id=?) THEN 1 ELSE json('google configuration changed') END").bind(row.generation,operator.fence.sessionId),
      db.prepare('UPDATE vector_google_configuration SET tested=1 WHERE singleton=1'),
    ])
    const current=await baseAuth(env).getSession(request)
    if(!current) throw new AuthError('unauthenticated',401)
    return {session:current,operator:current.operator,cookie:'vector_google_test=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0',returnTo:'/app/settings/sign-in'}
  }
  // A previously linked subject cannot move accounts or evade removal by
  // presenting another email. Require a fresh matching verified email each time.
  const person=await env.DB.prepare(`SELECT a.id,a.version,a.status FROM oa_operators a
    WHERE a.email=? AND a.status IN('active','invited')
    AND NOT EXISTS(SELECT 1 FROM oa_external_identities e WHERE e.issuer=? AND e.subject=? AND e.operator_id<>a.id)
    AND NOT EXISTS(SELECT 1 FROM oa_external_identities e WHERE e.issuer=? AND e.operator_id=a.id AND e.subject<>?)`)
    .bind(email,principal.issuer,principal.subject,principal.issuer,principal.subject).first<{id:string;version:number;status:string}>()
  if(!person) throw new AuthError('google_admission_denied',403)
  const now=Date.now(),token=opaqueToken(),session=crypto.randomUUID(),hash=await hashToken(env.SESSION_SECRET,'session',token)
  const at=new Date(now).toISOString(),audit=createUlid(new Date(now))
  const liveInvite=`SELECT t.id FROM oa_tokens t JOIN vector_invitation_roles r ON r.token_id=t.id
    JOIN oa_operators issuer ON issuer.id=t.issuer_id JOIN operators inviter ON inviter.id=r.inviter_operator_id
    JOIN vector_auth_operators im ON im.auth_id=issuer.id AND im.operator_id=inviter.id
    JOIN workspace_settings w ON w.id=inviter.workspace_id
    WHERE t.operator_id=a.id AND t.kind='invite' AND t.consumed_at IS NULL AND t.revoked_at IS NULL
    AND t.expires_at>? AND t.operator_version=a.version AND issuer.status='active' AND issuer.version=t.issuer_version
    AND inviter.removed_at IS NULL AND (inviter.role='owner' OR inviter.role='admin' AND r.role IN('member','guest','viewer')
      OR inviter.role='member' AND r.role='member' AND w.member_invites=1)
    AND NOT EXISTS(SELECT 1 FROM oa_dev_credentials d WHERE d.credential='oa_tokens' AND d.id=t.id)
    ORDER BY t.created_at DESC LIMIT 1`
  // Recheck every mutable admission input inside the same D1 transaction as
  // binding, invitation consumption, product projection, session and audit.
  const guard=env.DB.prepare(`SELECT CASE WHEN EXISTS(SELECT 1 FROM oa_operators a
    JOIN vector_google_configuration g ON g.singleton=1 AND g.enabled=1 AND g.generation=?
    WHERE a.id=? AND a.email=? AND a.version=? AND a.status IN('active','invited')
    AND NOT EXISTS(SELECT 1 FROM vector_http_restore)
    AND (NOT EXISTS(SELECT 1 FROM vector_restore_status) OR EXISTS(SELECT 1 FROM vector_restore_operator_grants WHERE auth_id=a.id))
    AND (a.status='active' AND EXISTS(SELECT 1 FROM vector_auth_operators m JOIN operators o ON o.id=m.operator_id
      JOIN workspace_settings w ON w.id=o.workspace_id WHERE m.auth_id=a.id AND o.removed_at IS NULL)
      OR a.status='invited' AND EXISTS(${liveInvite}))
    AND NOT EXISTS(SELECT 1 FROM oa_domain_rules d WHERE d.domain=? AND d.provider_id<>'google')
    AND NOT EXISTS(SELECT 1 FROM oa_external_identities e WHERE e.issuer=? AND (e.subject=? AND e.operator_id<>a.id OR e.operator_id=a.id AND e.subject<>?)))
    THEN 1 ELSE json('google admission changed') END`)
    .bind(row.generation,person.id,email,person.version,now,email.split('@')[1],principal.issuer,principal.subject,principal.subject)
  await env.DB.batch([
    guard,
    env.DB.prepare(`INSERT INTO oa_external_identities(issuer,subject,operator_id) VALUES(?,?,?) ON CONFLICT DO NOTHING`).bind(principal.issuer,principal.subject,person.id),
    env.DB.prepare(`UPDATE oa_tokens SET consumed_at=? WHERE id=(SELECT (${liveInvite}) FROM oa_operators a WHERE a.id=? AND a.status='invited')`).bind(now,now,person.id),
    env.DB.prepare("UPDATE oa_operators SET status='active' WHERE id=? AND status='invited'").bind(person.id),
    env.DB.prepare(`INSERT INTO operators(id,workspace_id,name,email,role,created_at,updated_at)
      SELECT ?,w.id,a.display_name,a.email,r.role,?,? FROM oa_operators a CROSS JOIN workspace_settings w
      JOIN oa_tokens t ON t.operator_id=a.id AND t.kind='invite' AND t.consumed_at=?
      JOIN vector_invitation_roles r ON r.token_id=t.id WHERE a.id=?
      AND NOT EXISTS(SELECT 1 FROM vector_auth_operators WHERE auth_id=a.id) ON CONFLICT DO NOTHING`).bind(createUlid(new Date(now)),at,at,now,person.id),
    env.DB.prepare(`INSERT OR IGNORE INTO team_members(team_id,operator_id,role,created_at,updated_at)
      SELECT team.id,m.operator_id,'member',?,? FROM vector_auth_operators m JOIN operators o ON o.id=m.operator_id
      JOIN oa_tokens t ON t.operator_id=m.auth_id AND t.consumed_at=? JOIN vector_invitation_roles r ON r.token_id=t.id
      JOIN json_each(r.team_ids_json) j JOIN teams team ON team.id=j.value AND team.workspace_id=o.workspace_id
      WHERE m.auth_id=? AND o.role IN('guest','viewer')`).bind(at,at,now,person.id),
    env.DB.prepare(`INSERT INTO oa_sessions(id,token_hash,operator_id,operator_version,kind,created_at,expires_at)
      SELECT ?,?,id,version,'native',?,? FROM oa_operators WHERE id=? AND status='active'`).bind(session,hash,now,now+86400000,person.id),
    env.DB.prepare('INSERT INTO vector_google_sessions(session_id,generation) VALUES(?,?)').bind(session,row.generation),
    env.DB.prepare(`INSERT INTO audit_records(id,actor_operator_id,action,subject_identifier,subject_id,created_at,updated_at)
      SELECT ?,operator_id,'signin.google','Google sign-in',operator_id,?,? FROM vector_auth_operators WHERE auth_id=?`).bind(audit,at,at,person.id),
  ])
  if(!await productOperator(env.DB,person.id)) throw new AuthError('google_admission_denied',403)
  const cookie=sessionCookie(token,{...authConfig(env),secure:new URL(env.APP_ORIGIN).protocol==='https:',cookieName:env.MAIL_MODE==='local-outbox'?`operator_session_local_${new URL(env.APP_ORIGIN).port||80}`:'__Host-operator_session'},86400)
  const admitted=await baseAuth(env).getSession(new Request(request.url,{headers:{host:new URL(env.APP_ORIGIN).host,cookie:cookie.split(';')[0]}}))
  if(!admitted) throw new AuthError('google_admission_denied',403)
  return {session:admitted,operator:admitted.operator,cookie,returnTo}
}
