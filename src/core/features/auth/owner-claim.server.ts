import { createOwnerClaimHandler, OwnerClaimError } from '../../../../vendor/base/owner-claim/index.mjs';
import { AuthError } from '../../../../vendor/base/operator-auth/index.mjs';
import { bootstrapConfig } from '../bootstrap/config';
import { bootstrapWorkspace } from '../bootstrap/repository';
import { localMailEnabled } from './development.server';
import type { WorkerBindings } from '../../app/bindings';

export function signedOwnerClaimConfigured(env: WorkerBindings) {
  // Partial configuration also selects this fail-closed path; it never falls
  // back to the legacy configured-owner bootstrap.
  return [env.RER_OWNER_CLAIM_ISSUER,env.RER_OWNER_CLAIM_INSTALLATION_ID,
    env.RER_OWNER_CLAIM_APP_ORIGIN,env.RER_OWNER_CLAIM_PUBLIC_KEYS].some(Boolean);
}

export async function ownerClaimResponse(env: WorkerBindings, request: Request) {
  try {
    bootstrapConfig(env);
    if(env.APP_ORIGIN!==env.RER_OWNER_CLAIM_APP_ORIGIN)throw new OwnerClaimError('invalid_config',503);
    const local=localMailEnabled(env);
    const result=await createOwnerClaimHandler({
      db:env.DB,authConfig:{origin:env.APP_ORIGIN,local,OWNER_EMAIL:env.FIRST_OWNER_EMAIL!,
        SESSION_SECRET:env.SESSION_SECRET!,SETUP_TOKEN:env.SETUP_TOKEN!},
      clientIp:request=>local?'loopback':request.headers.get('CF-Connecting-IP')??'',
      issuer:env.RER_OWNER_CLAIM_ISSUER!,installationId:env.RER_OWNER_CLAIM_INSTALLATION_ID!,
      appOrigin:env.RER_OWNER_CLAIM_APP_ORIGIN!,expectedEmail:env.FIRST_OWNER_EMAIL!,
      publicKeys:JSON.parse(env.RER_OWNER_CLAIM_PUBLIC_KEYS??'null'),
    })(request);
    if(result?.status===303||result?.status===200&&request.method==='POST') {
      await bootstrapWorkspace(env.DB,env);
      if(result.status===303) result.headers.set('Location','/setup');
    }
    return result??new Response('Not found',{status:404});
  } catch(error) {
    const known=error instanceof OwnerClaimError||error instanceof AuthError;
    return Response.json({error:known?error.code:'owner_claim_unavailable'},
      {status:known?error.status:503,headers:{'cache-control':'no-store'}});
  }
}
