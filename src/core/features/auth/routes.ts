import { firstRunState } from '../first-run/repository';
import { restoredEmailAdmitted } from '../data/restore-authority';
// Base's bounded form/JSON reader preserves native pre-hydration admission.
// @ts-expect-error This portable internal module has no declarations.
import { readInput, readParameters } from '../../../../vendor/base/operator-auth/input.mjs';
// @ts-expect-error This portable internal module has no declarations.
import { requirePost } from '../../../../vendor/base/operator-auth/http.mjs';
// @ts-expect-error This portable internal module has no declarations.
import { isLocalCli } from '../../../../vendor/base/operator-auth/local-cli.mjs'
import { admitRate } from './repository'
import { Hono } from 'hono'
import { AuthError, createAuthHandler, securityHeaders } from '../../../../vendor/base/operator-auth/index.mjs'
import { baseAuth, productOperator } from './base.server'
import type { AppEnvironment } from '../../app/bindings'

const enabled = new Set(['/auth/request', '/auth/magic-link', '/auth/confirm', '/auth/session', '/auth/signout', '/auth/setup-complete', '/auth/settings/identity'])
export function createAuthApp() {
  const app = new Hono<AppEnvironment>()
  app.all('*', async c => {
    const path = new URL(c.req.url).pathname
    if (path === '/auth/settings/identity' && c.req.method !== 'POST') return c.json({ error: 'not_found' }, 404)
    if (!enabled.has(path) && !path.startsWith('/auth/oidc/')) return c.json({ error: 'not_found' }, 404)
    try {
      const auth = baseAuth(c.env)
      if (c.req.method === 'POST' && ['/auth/request', '/auth/magic-link'].includes(path)) {
        requirePost(c.req.raw,{origin:c.env.APP_ORIGIN,local:c.env.MAIL_MODE==='local-outbox'});
        const query = readParameters(new URL(c.req.url).searchParams);
        if (Object.hasOwn(query, 'token')) throw new AuthError('invalid_input');
        // Consume the native request once. A rejected restore admission must
        // not leave the original branch of a cloned body pending in the proxy.
        const body = await readInput(c.req.raw) as {email?:unknown;returnTo?:unknown}|null;
        if (typeof body?.email === 'string' && !(await restoredEmailAdmitted(c.env.DB, body.email)))
          return c.json({error:'restored_operator_review_required'},409);
        const local = c.env.MAIL_MODE === 'local-outbox'
        const ip = local ? 'loopback' : c.req.header('cf-connecting-ip')
        // The rer command line's own loopback sign-in is not a person's attempt;
        // Base skips its limit for the same proof, so this one must too.
        const cli = local && await isLocalCli(c.req.raw, { local, SESSION_SECRET: c.env.SESSION_SECRET })
        if (ip && !cli && !(await admitRate(c.env.DB, 'base-magic:' + ip, 5, 15 * 60_000)))
          return c.json({ error: 'rate_limited' }, 429)
        // This is the same public Base operation and response used by its
        // HTTP adapter; Base retains email, origin, rate, token and mail checks.
        return Response.json(await auth.requestMagicLink(c.req.raw, body as {email:string;returnTo?:string}), {
          status:202,headers:securityHeaders(),
        })
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
        const operator = session && await productOperator(c.env.DB, session.operatorId)
        if (!operator) throw new AuthError('operator_unavailable', 503)
        if (!(await firstRunState(c.env.DB, operator.id)).completed) result.headers.set('Location','/setup')
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
