import { createDependencies } from '../../../../vendor/base/dependencies/index.mjs'
import { createIdpOwnerClaimHandler } from '../../../../vendor/base/owner-claim/index.mjs'
import { authConfig, baseAuth } from './base.server'
import type { WorkerBindings } from '../../app/bindings'

export function isDependencyPath(path: string) {
  return path === '/.well-known/rer-dependencies' || path.startsWith('/.well-known/rer-link/') || path.startsWith('/auth/dependencies/')
}

export async function dependencyResponse(env: WorkerBindings, request: Request) {
  const config = authConfig(env)
  const claim = createIdpOwnerClaimHandler({ db: env.DB, authConfig: config,
    clientIp: () => config.local ? 'loopback' : request.headers.get('CF-Connecting-IP') ?? '' })
  return createDependencies({ db: env.DB, origin: config.origin, name: 'Vector',
    provider: env.IDENTITY_PROVIDER, local: config.local, auth: baseAuth(env),
    INSTALLATION_KEY: env.INSTALLATION_KEY, INSTALLATION_KEY_PREVIOUS: env.INSTALLATION_KEY_PREVIOUS,
    claimOwner: token => claim(new Request(config.origin + '/auth/owner-claim', {
      method: 'POST', headers: { Host: new URL(config.origin).host, Origin: config.origin, 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })),
  }).handle(request)
}
