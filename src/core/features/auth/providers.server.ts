// Base's linked-provider resolver is native ESM without declarations.
// @ts-expect-error Base dependencies has no declaration for this composition entry.
import { linkedProviders } from '../../../../vendor/base/dependencies/auth.mjs'
import type { Admission, IdentityProviders } from '../../../../vendor/base/operator-auth/index.mjs'
import type { WorkerBindings } from '../../app/bindings'
import { authConfig, baseAuth } from './base.server'

/** Read native provider visibility without constructing the email/bootstrap adapter. */
export async function signInProviderLinks(env: WorkerBindings) {
  const config = authConfig(env)
  const providers: IdentityProviders = linkedProviders({
    db: env.DB, config,
    // Any admission still goes through the complete configured auth adapter.
    admission: { admit: (...args: Parameters<Admission['admit']>) => baseAuth(env).admission.admit(...args) },
    clientIp: (request: Request) => config.local ? 'loopback' : request.headers.get('CF-Connecting-IP') ?? '',
    enabled: async () => !!(await env.DB.prepare('SELECT idp_sign_in FROM oa_auth_settings WHERE singleton=1').first<{ idp_sign_in: number }>())?.idp_sign_in,
  })
  return (await providers.list()).filter(provider => provider.visible).map(({ id, label, startPath }) => ({ id, label, startPath }))
}
