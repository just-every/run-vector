import { createServerFn } from '@tanstack/react-start'
import { redirect } from '@tanstack/react-router'

/** Hosted sign-in providers; local dev handles its automatic entry before this page. */
export const loadSignIn = createServerFn({ method: 'GET' }).inputValidator((data: { returnTo?: string }) => data).handler(async ({ data }) => {
  const { currentOperator } = await import('../request.server')
  const { safeReturnTo } = await import('../../features/auth/service')
  if (await currentOperator()) throw redirect({ href: safeReturnTo(data.returnTo) })
  const { env } = await import('cloudflare:workers')
  const { signInProviderLinks } = await import('../../features/auth/providers.server')
  return { providerLinks: await signInProviderLinks(env) }
})
