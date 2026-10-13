import { DurableObject } from 'cloudflare:workers';
import type { WorkerBindings } from '../../app/bindings';
import { authenticateRestoreRequest,restoreRequest } from './http-restore';

const settlementPending = () => Response.json({error:'restore_settlement_pending'}, {status:409});

/** One object per installation serializes the complete Base call, including R2
 * writes and rollback. Never reclaim an uncertain operation on a timeout: an
 * old R2 request cannot be fenced by a D1 lease. Custody is kept only while D1
 * shows R2 settlement may be uncertain; a request that failed or was cut off
 * before that point leaves its job resumable and abortable. */
export class VectorRestoreCoordinator extends DurableObject<WorkerBindings> {
  private running = false;
  async fetch(request: Request) {
    const admission=await authenticateRestoreRequest(request,this.env);
    if(admission instanceof Response)return admission;
    if (this.running) return Response.json({error:'restore_busy'}, {status:409});
    this.running = true;
    try {
      if (!(await this.settle()) && request.method !== 'GET') return settlementPending();
      if (request.method === 'GET') return restoreRequest(request, this.env);
      const id = new URL(request.url).pathname.split('/')[4] ?? null;
      await this.ctx.storage.put('pending',{id});
      let settled = false, result: Response;
      try { result = await restoreRequest(request,this.env); }
      finally { settled = await this.settle(); }
      if (settled) return result;
      await result.body?.cancel();
      return settlementPending();
    } finally { this.running = false; }
  }

  /** Releases custody unless an apply is in progress or an unfinished job still
   * owns R2 objects. A create's reservation that never acquired a Base job is
   * released first, exactly as the create's own cleanup does. */
  private async settle() {
    const pending = await this.ctx.storage.get<{id:string|null}>('pending');
    if (!pending) return true;
    if (pending.id === null) await this.env.DB.prepare('DELETE FROM vector_http_restore WHERE import_id IS NULL').run();
    const uncertain = await this.env.DB.prepare(`SELECT 1 FROM rer_portability_state WHERE applying=1
      UNION ALL SELECT 1 FROM rer_portability_owned o JOIN rer_portability_jobs j ON j.id=o.job WHERE j.phase!='complete' LIMIT 1`).first();
    if (uncertain) return false;
    await this.ctx.storage.delete('pending');
    return true;
  }
}
