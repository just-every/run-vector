import { admitRate } from './repository'
import { Hono } from 'hono'
import { AuthError, createAuthHandler, securityHeaders } from '../../../../vendor/base/operator-auth/index.mjs'
import { baseAuth, localCompatibility, productOperator } from './base.server'
import { createLocalCompatibilityApp } from './local-compat.server'
import type { AppEnvironment } from '../../app/bindings'

const localApp = createLocalCompatibilityApp()
const enabled = new Set(['/auth/request', '/auth/magic-link', '/auth/confirm', '/auth/session', '/auth/signout'])
export function createAuthApp() {
  const app = new Hono<AppEnvironment>()
  app.all('*', async c => {
    const path = new URL(c.req.url).pathname
    // Historical synthetic/native fixtures are an explicit local dialect only.
    // Its GET consumption and vector_session credential never reach production.
    if (localCompatibility(c.env) && (path === '/auth/request' || path === '/auth/consume' ||
      (path === '/auth/signout' && c.req.header('cookie')?.includes('vector_session=')))) {
      const url = new URL(c.req.url); url.pathname = path.slice('/auth'.length)
      return localApp.fetch(new Request(url, c.req.raw), c.env)
    }
    if (!enabled.has(path)) return c.json({ error: 'not_found' }, 404)
    try {
      const auth = baseAuth(c.env)
      if (c.req.method === 'POST' && ['/auth/request', '/auth/magic-link'].includes(path)) {
        const ip = c.env.MAIL_MODE === 'local-outbox' ? 'loopback' : c.req.header('cf-connecting-ip')
        if (ip && !(await admitRate(c.env.DB, 'base-magic:' + ip, 5, 15 * 60_000)))
          return c.json({ error: 'rate_limited' }, 429)
      }
      let request = c.req.raw
      if (path === '/auth/request') {
        const url = new URL(request.url); url.pathname = '/auth/magic-link'
        request = new Request(url, request)
      }
      const result = await createAuthHandler(auth)(request)
      if (!result) return c.json({ error: 'not_found' }, 404)
      if (path === '/auth/confirm' && request.method === 'POST' && result.status === 303) {
        const cookie = result.headers.get('set-cookie')!
        const sessionRequest = new Request(request.url, { headers: {
          host: new URL(request.url).host, cookie: cookie.split(';')[0],
        } })
        const session = await auth.getSession(sessionRequest)
        if (!session || !(await productOperator(c.env.DB, session.operatorId)))
          throw new AuthError('operator_unavailable', 503)
      }
      // Preserve the existing application signout response contract.
      if (path === '/auth/signout' && result.status === 204)
        return Response.json({ signedOut: true }, { headers: result.headers })
      return result
    } catch (error) {
      return Response.json({ error: error instanceof AuthError ? error.code : 'auth_unavailable' }, {
        status: error instanceof AuthError ? error.status : 503, headers: securityHeaders(),
      })
    }
  })
  return app
}
