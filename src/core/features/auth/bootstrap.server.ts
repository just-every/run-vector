import { AuthError, createAuthHandler, createOperatorAuth, securityHeaders } from '../../../../vendor/base/operator-auth/index.mjs';
import { bootstrapConfig } from '../bootstrap/config';
import { bootstrapWorkspace } from '../bootstrap/repository';
import { authConfig } from './base.server';
import { signedOwnerClaimConfigured } from './owner-claim.server';
import type { WorkerBindings } from '../../app/bindings';

/** The CLI uses the same native owner transaction as signed managed claim. */
export async function bootstrapOwnerResponse(env: WorkerBindings, request: Request) {
  if (signedOwnerClaimConfigured(env))
    return Response.json({ error: 'signed_owner_claim_required' }, { status: 403, headers: securityHeaders() });
  try {
    bootstrapConfig(env);
    const config = authConfig(env);
    const auth = createOperatorAuth({ db: env.DB, config,
      clientIp: request => config.local ? 'loopback' : request.headers.get('CF-Connecting-IP') ?? '' });
    const response = await createAuthHandler(auth)(request);
    if (response?.status === 303) {
      await bootstrapWorkspace(env.DB, env);
      response.headers.set('Location', '/setup');
    }
    return response ?? new Response('Not found', { status: 404 });
  } catch (error) {
    return Response.json({ error: error instanceof AuthError ? error.code : 'bootstrap_unavailable' }, {
      status: error instanceof AuthError ? error.status : 503, headers: securityHeaders(),
    });
  }
}
