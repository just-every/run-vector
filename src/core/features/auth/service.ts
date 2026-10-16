import { restoredOperatorAdmitted } from '../data/restore-authority';
import { baseAuth, productOperator } from './base.server'
import type { WorkerBindings } from '../../app/bindings'
// @ts-expect-error Base operator-auth's HTTP helpers are native ESM without a declaration file.
import { localCookieName } from '../../../../vendor/base/operator-auth/http.mjs'
export async function requireOperator(env: WorkerBindings, request: Request, includeSetup = false) {
  // Anonymous public requests need no credentials; authenticated requests fail
  // visibly if the deployment has not configured its Base identity boundary.
  if (!request.headers.get('cookie')) return null
  const session = await baseAuth(env).getSession(request)
  if (!session) return null
  // Established sessions project product identity and restore admission in the
  // same SQL snapshot. Only a newly invited identity needs the creation path.
  let operator = await env.DB.prepare(`SELECT o.id,o.name,o.email,o.workspace_id AS workspaceId${includeSetup ? `,
      (SELECT CASE WHEN i.setup_operator_id=o.id AND i.setup_completed_at IS NULL THEN 0 ELSE 1 END
       FROM workspace_settings w LEFT JOIN workspace_installation i ON i.workspace_id=w.id
       WHERE w.id=o.workspace_id) AS setupCompleted` : ''}
    FROM vector_auth_operators m JOIN operators o ON o.id=m.operator_id
    JOIN oa_operators a ON a.id=m.auth_id
    WHERE m.auth_id=? AND o.removed_at IS NULL AND a.status='active'
    AND (NOT EXISTS(SELECT 1 FROM vector_restore_status)
      OR EXISTS(SELECT 1 FROM vector_restore_operator_grants WHERE auth_id=m.auth_id))`)
    .bind(session.operatorId).first<{ id: string; name: string; email: string; workspaceId: string; setupCompleted?: number | null }>()
  if (!operator) {
    if (!(await restoredOperatorAdmitted(env.DB, session.operatorId))) return null
    operator = await productOperator(env.DB, session.operatorId)
    if (operator && includeSetup) {
      const { firstRunState } = await import('../first-run/repository')
      operator = { ...operator, setupCompleted: Number((await firstRunState(env.DB, operator.id)).completed) }
    }
  }
  return operator ? { ...operator, fence: { sessionId: session.id, operatorVersion: session.operator.version } } : null
}
export function clearSessionCookie(env: WorkerBindings, _request: Request) {
  // Base names a local session cookie per origin port, so local seeds never share one.
  return `${env.MAIL_MODE === 'local-outbox' ? localCookieName('operator_session_local', env.APP_ORIGIN) : '__Host-operator_session'}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${new URL(env.APP_ORIGIN).protocol === 'https:' ? '; Secure' : ''}`
}
export function safeReturnTo(value: string | null | undefined) {
  return value && /^\/app(?:\/|\?|$)/.test(value) && !/[\\\r\n]/.test(value)
    ? value
    : '/app'
}
export function isLocalOrigin(origin: string) {
  const u = new URL(origin)
  return ['localhost', '127.0.0.1', '[::1]'].includes(u.hostname)
}
