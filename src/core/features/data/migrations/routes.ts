import type { Hono,Context } from 'hono';
import { z } from 'zod';
import type { AppEnvironment } from '../../../app/bindings';
import { readRequestJson } from '../../../app/input';
import type { ImportActor } from '../import/authority';
import { ImportError } from '../import/types';
import { importOperation } from '../import/failure';
import { createMigration,listMigrations,finishMigration } from './service';
import { migrationReport,migrationCsv } from './report';
const create=z.object({source:z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,99}$/)}).strict();
const finish=z.object({version:z.number().int().positive(),acceptPending:z.literal(true),pendingIds:z.array(z.string().regex(/^[a-f0-9]{64}$/)).max(20000)}).strict();
async function body<S extends z.ZodType>(c:Context<AppEnvironment>,schema:S) {
  const parsed=schema.safeParse(await readRequestJson(c.req.raw,2*1024*1024));
  if(!parsed.success)throw new ImportError(400,'migration_acceptance_required','Explicit acceptance of the current pending list and version is required.');
  return parsed.data;
}
export function addMigrationRoutes(app:Hono<AppEnvironment>,actor:(c:Context<AppEnvironment>)=>Promise<ImportActor>) {
  app.get('/data/migrations',async c=>c.json({migrations:await importOperation(async()=>listMigrations(c.env.DB,await actor(c)))}));
  app.post('/data/migrations',async c=>{const input=await body(c,create);return c.json(await importOperation(async()=>createMigration(c.env.DB,await actor(c),input.source)));});
  app.get('/data/migrations/:id',async c=>c.json(await importOperation(async()=>migrationReport(c.env.DB,await actor(c),c.req.param('id')))));
  app.get('/data/migrations/:id/report.csv',async c=>{
    const report=await importOperation(async()=>migrationReport(c.env.DB,await actor(c),c.req.param('id')));
    return c.body(migrationCsv(report),200,{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="migration.csv"','Cache-Control':'no-store'});
  });
  app.post('/data/migrations/:id/finish',async c=>{const input=await body(c,finish);return c.json(await importOperation(async()=>finishMigration(c.env.DB,await actor(c),c.req.param('id'),input)));});
}
