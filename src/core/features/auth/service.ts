import { activeSession, digest } from './repository'
import { baseAuth, localCompatibility, productOperator } from './base.server'
import type { WorkerBindings } from '../../app/bindings'
export function sessionToken(request: Request) {
  return (
    request.headers
      .get('cookie')
      ?.split(';')
      .map((s) => s.trim())
      .find((s) => s.startsWith('vector_session='))
      ?.slice('vector_session='.length) ?? null
  )
}
export async function requireOperator(env: WorkerBindings, request: Request) {
  const token = sessionToken(request)
  if (token && localCompatibility(env)) {
    const operator = /^[a-f0-9]{64}$/.test(token) ? await activeSession(env.DB, token) : null
    return operator ? { ...operator, fence: await digest(token) } : null
  }
  // Anonymous public requests need no credentials; authenticated requests fail
  // visibly if the deployment has not configured its Base identity boundary.
  if (!request.headers.get('cookie')) return null
  const session = await baseAuth(env).getSession(request)
  if (!session) return null
  const operator = await productOperator(env.DB, session.operatorId)
  return operator ? { ...operator, fence: { sessionId: session.id, operatorVersion: session.operator.version } } : null
}
export function clearSessionCookie(env: WorkerBindings, request: Request) {
  if (localCompatibility(env) && sessionToken(request)) return sessionCookie('', env.APP_ORIGIN, true)
  return `${env.MAIL_MODE === 'local-outbox' ? 'operator_session_local' : '__Host-operator_session'}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${new URL(env.APP_ORIGIN).protocol === 'https:' ? '; Secure' : ''}`
}
export function safeReturnTo(value: string | null | undefined) {
  return value && /^\/app(?:\/|\?|$)/.test(value) && !/[\\\r\n]/.test(value)
    ? value
    : '/app'
}
export function isLocalOrigin(origin: string) {
  const u = new URL(origin)
  return ['localhost', '127.0.0.1', 'vector.test'].includes(u.hostname)
}
export function sessionCookie(token: string, origin: string, clear = false) {
  return `vector_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${clear ? 0 : 30 * 86400}${new URL(origin).protocol === 'https:' ? '; Secure' : ''}`
}
