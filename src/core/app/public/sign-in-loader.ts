import { createServerFn } from '@tanstack/react-start'

/** Hosted sign-in providers; local dev handles its automatic entry before this page. */
export const loadSignIn = createServerFn({ method: 'GET' }).handler(async () => {
  const { env } = await import('cloudflare:workers')
  const { signInProviderLinks } = await import('../../features/auth/providers.server')
  return { providerLinks: await signInProviderLinks(env) }
})
