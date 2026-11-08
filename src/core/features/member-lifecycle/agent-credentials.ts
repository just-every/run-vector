import { verifyJws } from '../../../../vendor/base/agent-door/credentials';
import type { WorkerBindings } from '../../app/bindings';
import { nativePeople } from '../agent-door/people';

/** Base authenticates the credential afterwards. This additional revocation
 * fence covers signed credentials issued before suspension, even if the agent
 * had never called this installation and therefore has no local agent row.
 * Base permits 30 seconds of issuer clock skew; the cutoff includes that skew.
 * Fresh Business credentials can be used after that conservative cutoff. */
export async function suspendedAgentCredential(env: WorkerBindings, request: Request) {
  const token = request.headers.get('authorization')?.match(/^Bearer[ \t]+([^\s]+)$/i)?.[1];
  if (!token?.includes('.') || !env.RER_OWNER_CLAIM_PUBLIC_KEYS) return false;
  const claims = await verifyJws(token, 'at+jwt', JSON.parse(env.RER_OWNER_CLAIM_PUBLIC_KEYS));
  if (!claims || claims.iss !== env.RER_OWNER_CLAIM_ISSUER || claims.aud !== env.APP_ORIGIN+'/mcp'
      || typeof claims.sub !== 'string' || typeof claims.iat !== 'number' || !Number.isFinite(claims.iat)) return false;
  const sponsor = await nativePeople(env).sponsor({sub:claims.sub});
  if (!sponsor) return false;
  const event = await env.DB.prepare(`SELECT MAX(created_at) AS at FROM member_lifecycle_events
    WHERE operator_id=? AND action IN('suspended','left')`).bind(sponsor.id).first<{at:string|null}>();
  return event?.at != null && claims.iat <= Math.ceil(Date.parse(event.at)/1000)+30;
}
