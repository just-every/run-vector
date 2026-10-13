import { restoredOperatorAdmitted } from '../data/restore-authority';
import { baseAuth, productOperator } from './base.server'
import type { WorkerBindings } from '../../app/bindings'
// @ts-expect-error Base operator-auth's HTTP helpers are native ESM without a declaration file.
import { localCookieName } from '../../../../vendor/base/operator-auth/http.mjs'
export async function requireOperator(env: WorkerBindings, request: Request) {
  // Anonymous public requests need no credentials; authenticated requests fail
  // visibly if the deployment has not configured its Base identity boundary.
  if (!request.headers.get('cookie')) return null
  const session = await baseAuth(env).getSession(request)
  if (!session || !(await restoredOperatorAdmitted(env.DB, session.operatorId))) return null
  const operator = await productOperator(env.DB, session.operatorId)
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
