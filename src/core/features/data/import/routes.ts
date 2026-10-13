import type { Hono,Context } from 'hono';
import type { AppEnvironment } from '../../../app/bindings';
import { readRequestJson } from '../../../app/input';
import { requireOperator } from '../../auth/service';
import { importInputSchema,importApplySchema } from './input';
import { previewImport,applyImport,importStatus,importOriginals,resumeImport,rollbackImport,importRollbackPreview,importReport,importReportCsv } from './service';
import { loadImportReferences } from './references';
import { ImportError,importLimits } from './types';
import type { ImportActor } from './authority';
import { z } from 'zod';
import { importOperation } from './failure';
const parse=<T>(schema:z.ZodType<T>,value:unknown):T=>{
  const result=schema.safeParse(value);
  if(!result.success)throw new ImportError(400,'invalid_import_input','The import request has an invalid field, type or bound.');
  return result.data;
};

async function actor(c:Context<AppEnvironment>):Promise<ImportActor> {
  const admitted=await requireOperator(c.env,c.req.raw);
  if(!admitted || admitted.id!==c.get('operatorId'))throw new ImportError(401,'unauthenticated');
  const row=await c.env.DB.prepare('SELECT workspace_id FROM operators WHERE id=? AND removed_at IS NULL').bind(admitted.id).first<{workspace_id:string}>();
  if(!row)throw new ImportError(401,'unauthenticated');
  return {id:admitted.id,workspace:row.workspace_id,fence:admitted.fence};
}
// The base64 file plus its mapping; Workers accept far larger bodies.
const importRequestBytes=2*Math.ceil(importLimits.bytes/3)*4+262144;
export function addImportRoutes(app:Hono<AppEnvironment>) {
  app.get('/data/import/options',async c=>{
    const owner=await actor(c),references=await loadImportReferences(c.env.DB,owner.workspace);
    return c.json({references,bounds:importLimits});
  });
  app.post('/data/import/preview',async c=>{
    const input=parse(importInputSchema,await readRequestJson(c.req.raw,importRequestBytes));
    return c.json(await importOperation(async()=>previewImport(c.env.DB,await actor(c),input,c.env.APP_ORIGIN)));
  });
  app.post('/data/import/apply',async c=>{
    const input=parse(importApplySchema,await readRequestJson(c.req.raw,importRequestBytes));
    return c.json(await importOperation(async()=>applyImport(c.env.DB,await actor(c),input.input,c.env.APP_ORIGIN,input.reviewedFingerprint,input.operationKey,input.acknowledgeOmissions)));
  });
  app.get('/data/import/runs',async c=>{
    const owner=await actor(c),rows=(await c.env.DB.prepare(`SELECT j.id,j.namespace,j.state,j.total,j.checkpoint,j.error,r.batch_size AS batchSize,r.last_error AS lastError,
      (SELECT count(*) FROM ik_batches b WHERE b.job_id=j.id AND b.action='apply') AS batchesApplied FROM ik_jobs j LEFT JOIN vector_import_runs r ON r.job_id=j.id
      WHERE j.destination=? AND j.principal_id=? AND j.namespace LIKE 'vector-import:%' ORDER BY j.rowid DESC LIMIT 50`).bind(owner.workspace,owner.id).all()).results;
    return c.json({runs:rows});
  });
  app.get('/data/import/runs/:id',async c=>c.json(await importOperation(async()=>importStatus(c.env.DB,await actor(c),c.req.param('id')))));
  app.get('/data/import/runs/:id/originals',async c=>c.json(await importOperation(async()=>importOriginals(c.env.DB,await actor(c),c.req.param('id')))));
  app.post('/data/import/runs/:id/resume',async c=>c.json(await importOperation(async()=>resumeImport(c.env.DB,await actor(c),c.req.param('id')))));
  app.get('/data/import/runs/:id/report',async c=>c.json(await importOperation(async()=>importReport(c.env.DB,await actor(c),c.req.param('id')))));
  app.get('/data/import/runs/:id/report.csv',async c=>{
    const id=c.req.param('id'),csv=await importOperation(async()=>importReportCsv(c.env.DB,await actor(c),id));
    return c.body(csv,200,{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':`attachment; filename="import-${id}.csv"`,'Cache-Control':'no-store'});
  });
  app.get('/data/import/runs/:id/rollback',async c=>c.json(await importOperation(async()=>importRollbackPreview(c.env.DB,await actor(c),c.req.param('id')))));
  app.post('/data/import/runs/:id/rollback',async c=>{
    const body=await readRequestJson(c.req.raw);
    if(!body || typeof body!=='object' || !('confirmed' in body) || body.confirmed!==true)throw new ImportError(400,'rollback_confirmation_required');
    return c.json(await importOperation(async()=>rollbackImport(c.env.DB,await actor(c),c.req.param('id'))));
  });
}
