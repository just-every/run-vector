import type { WorkerBindings } from '../../app/bindings';
import { requireOperator } from '../auth/service';

export async function liveConnection(request: Request, env: WorkerBindings) {
  if (request.headers.get('Origin') !== env.APP_ORIGIN) return new Response(null, { status: 403 });
  const operator = await requireOperator(env, request);
  if (!operator) return new Response(null, { status: 401 });
  if (!env.LIVE_SYNC) return new Response(null, { status: 503 });
  const hub = env.LIVE_SYNC.get(env.LIVE_SYNC.idFromName(operator.workspaceId));
  const target = new URL(request.url);
  target.pathname = '/connect';
  target.search = '';
  return hub.fetch(target, { headers: { Origin: env.APP_ORIGIN, Upgrade: request.headers.get('Upgrade') ?? '',
    'x-vector-live-reader': JSON.stringify({ actor: operator.id, workspace: operator.workspaceId, fence: operator.fence }) } });
}

const publishers = new WeakMap<D1Database, (event: string) => Promise<void>>();
/** Register only selected native mutation doors, retaining their transaction DB. */
export function configureLivePublication(db: D1Database, env: WorkerBindings, workspace: string) {
  if (!env.LIVE_SYNC) return;
  const hub = env.LIVE_SYNC.get(env.LIVE_SYNC.idFromName(workspace));
  publishers.set(db, async event => {
    const response = await hub.fetch('https://live.invalid/publish', { method: 'POST', body: event });
    if (!response.ok) throw new Error('Live invalidation unavailable');
  });
}

/** Called only after the guarded transaction returned its committed issue row. */
export async function publishCommittedChange(db: D1Database, event: string) {
  try { await publishers.get(db)?.(event); }
  catch {
    // The issue is already committed. Existing native polling recovers a lost
    // hint; a transport failure must not report that durable mutation failed.
    console.warn('Live invalidation interrupted; native refresh remains available.');
  }
}
