import { createServerFn } from '@tanstack/react-start'

/** Whether this installation sends sign-in mail to the local development outbox, so /signin can say where to find it. */
export const loadSignIn = createServerFn({ method: 'GET' }).handler(async () => {
  const { env } = await import('cloudflare:workers')
  const { localMailEnabled } = await import('../../features/auth/development.server')
  return { localOutbox: localMailEnabled(env) }
})
