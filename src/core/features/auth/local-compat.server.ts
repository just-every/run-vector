import { readRequestJson } from '../../app/input'
import { Hono } from 'hono'
import { z } from 'zod'
import type { AppEnvironment } from '../../app/bindings'
import {
  admitRate,
  consumeMagicLink,
  requestMagicLink,
  revokeSession,
} from './repository'
import {
  isLocalOrigin,
  safeReturnTo,
  sessionCookie,
  sessionToken,
} from './service'
export function createLocalCompatibilityApp() {
  const app = new Hono<AppEnvironment>()
  app.post('/request', async (c) => {
    if (c.req.header('origin') !== c.env.APP_ORIGIN)
      return c.json(
        { error: 'forbidden', message: 'Same-origin request required.' },
        403,
      )
    const parsed = z
      .object({
        email: z.email().max(254),
        returnTo: z.string().max(2000).optional(),
      })
      .strict()
      .safeParse(await readRequestJson(c.req.raw))
    if (!parsed.success)
      return c.json(
        { error: 'invalid_request', issues: parsed.error.issues },
        400,
      )
    if (
      !c.env.APP_ORIGIN ||
      c.env.MAIL_MODE !== 'local-outbox' ||
      !isLocalOrigin(c.env.APP_ORIGIN)
    )
      return c.json(
        {
          error: 'mail_unconfigured',
          message:
            'MAIL_MODE requires an explicitly configured delivery adapter.',
        },
        503,
      )
    if (
      !(await admitRate(
        c.env.DB,
        'magic:' + (c.req.header('cf-connecting-ip') ?? 'local'),
        5,
        15 * 60_000,
      ))
    )
      return c.json({ error: 'rate_limited' }, 429)
    await requestMagicLink(
      c.env.DB,
      parsed.data.email,
      c.env.APP_ORIGIN,
      safeReturnTo(parsed.data.returnTo),
    )
    return c.json(
      {
        message: 'If this email is allow-listed, a sign-in link has been sent.',
      },
      202,
    )
  })
  app.get('/consume', async (c) => {
    c.header('Cache-Control', 'no-store')
    c.header('Referrer-Policy', 'no-referrer')
    const parsed = z
      .object({ token: z.string().regex(/^[a-f0-9]{64}$/) })
      .strict()
      .safeParse(c.req.query())
    if (!parsed.success) return c.json({ error: 'invalid_request' }, 400)
    const session = await consumeMagicLink(c.env.DB, parsed.data.token)
    if (!session)
      return c.json(
        {
          error: 'invalid_link',
          message: 'This sign-in link has expired or was already used.',
        },
        400,
      )
    c.header('Set-Cookie', sessionCookie(session.token, c.env.APP_ORIGIN))
    return c.redirect(safeReturnTo(session.returnTo), 302)
  })
  app.post('/signout', async (c) => {
    if (c.req.header('origin') !== c.env.APP_ORIGIN)
      return c.json({ error: 'forbidden' }, 403)
    const token = sessionToken(c.req.raw)
    if (token) await revokeSession(c.env.DB, token)
    c.header('Set-Cookie', sessionCookie('', c.env.APP_ORIGIN, true))
    return c.json({ signedOut: true })
  })
  return app
}
