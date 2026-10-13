import type { ImportJob } from '../../../../../vendor/base/import-kit/src/d1/index';

export type RunProgress = {
  batchSize: number; batchesApplied: number; batchesTotal: number;
  /** Published records are visible while the run is still applying; a started
   * rollback is also unfinished until every imported issue is removed. */
  unfinished: boolean; issuesRemaining: number; lastError: string|null; lastErrorAt: string|null;
};
/** Batches are counted from Base's own publication journal, never estimated:
 * every staged batch advanced the checkpoint by exactly the run's batch size. */
export async function runProgress(db:D1Database,job:ImportJob):Promise<RunProgress> {
  const row=await db.prepare(`SELECT r.batch_size,r.last_error,r.last_error_at,
    (SELECT count(*) FROM ik_batches b WHERE b.job_id=j.id AND b.action='apply') AS applied,
    (SELECT count(*) FROM ik_provenance p WHERE p.job_id=j.id AND p.reversed=0) AS remaining
    FROM ik_jobs j LEFT JOIN vector_import_runs r ON r.job_id=j.id WHERE j.id=?`).bind(job.id).first<{batch_size:number|null;last_error:string|null;last_error_at:string|null;applied:number;remaining:number}>();
  const batchSize=row?.batch_size??Math.max(job.total,1),applied=row?.applied??0;
  return {batchSize,batchesApplied:applied,batchesTotal:applied+Math.ceil((job.total-job.checkpoint)/batchSize),
    unfinished:['queued','applying','failed','rolling_back','undoing'].includes(job.state),issuesRemaining:row?.remaining??0,lastError:row?.last_error??null,lastErrorAt:row?.last_error_at??null};
}
/** Keeps only a code, never driver text or private SQL values. */
export async function recordRunFailure(db:D1Database,id:string,error:unknown) {
  const code=error instanceof Error && /^[A-Z_]{3,64}$/.test(error.message)?error.message:'IMPORT_BATCH_FAILED';
  await db.prepare(`UPDATE vector_import_runs SET last_error=?,last_error_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE job_id=?`).bind(code,id).run();
}
export async function clearRunFailure(db:D1Database,id:string) {
  await db.prepare('UPDATE vector_import_runs SET last_error=NULL,last_error_at=NULL WHERE job_id=? AND last_error IS NOT NULL').bind(id).run();
}
