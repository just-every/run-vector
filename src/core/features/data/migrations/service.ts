import { randomUUID } from 'node:crypto';
import { canonicalJson,sha256 } from '../../../../../vendor/base/import-kit/src/d1/index';
import { sourceIdentity } from '../../../../../vendor/base/import-kit/src/provenance/identity';
import type { ImportActor } from '../import/authority';
import { ImportError } from '../import/types';
import { readMigration,requireMigrationAuthority,migrationBatch,migrationGuard } from './model';
import { migrationReport } from './report';
import { auditStatement } from '../../audit/producer';

export async function listMigrations(db:D1Database,actor:ImportActor) {
  await requireMigrationAuthority(db,actor);
  return (await db.prepare('SELECT id,source,state,version,finished_at AS finishedAt FROM vector_file_migrations WHERE workspace_id=? ORDER BY rowid DESC').bind(actor.workspace).all()).results;
}
export async function createMigration(db:D1Database,actor:ImportActor,source:string) {
  await requireMigrationAuthority(db,actor);
  const prior=await db.prepare('SELECT id FROM vector_file_migrations WHERE workspace_id=? AND source=?').bind(actor.workspace,source).first<{id:string}>();
  if(prior)return readMigration(db,actor,prior.id);
  const id=randomUUID();
  await migrationBatch(db,actor,[{sql:"INSERT INTO vector_file_migrations(id,workspace_id,source,created_at) VALUES(?,?,?,strftime('%Y-%m-%dT%H:%M:%fZ','now'))",params:[id,actor.workspace,source]},auditStatement({workspace:actor.workspace,actor:actor.id,action:'migration.created',subject:id})]);
  return readMigration(db,actor,id);
}
export type FinishInput={version:number;acceptPending:true;pendingIds:string[]};
export async function finishMigration(db:D1Database,actor:ImportActor,id:string,input:FinishInput) {
  const migration=await readMigration(db,actor,id);
  const ids=[...new Set(input.pendingIds)].sort();
  if(ids.length!==input.pendingIds.length)throw new ImportError(409,'migration_pending_changed');
  const fingerprint=sha256(canonicalJson({version:input.version,pendingIds:ids}));
  if(migration.state==='finished') {
    if(migration.accepted_fingerprint!==fingerprint)throw new ImportError(409,'migration_already_finished');
    return migrationReport(db,actor,id);
  }
  const report=await migrationReport(db,actor,id);
  if(report.migration.version!==input.version||canonicalJson(report.pending.map(row=>row.id).sort())!==canonicalJson(ids))throw new ImportError(409,'migration_pending_changed','The migration changed. Review its current pending list before finishing.');
  if(!report.runs.length||report.runs.some(run=>run.state!=='completed'))throw new ImportError(409,'migration_runs_unfinished');
  // This slice accepts absent endpoints only. A supplied endpoint that still
  // needs cross-run binding must be resolved, never silently declared omitted.
  const identities=report.pending.map(row=>sourceIdentity(actor.workspace,'vector-import:'+migration.source,'issue',row.targetSourceId));
  if(identities.length&&await db.prepare('SELECT 1 FROM ik_sources WHERE identity IN (SELECT value FROM json_each(?)) LIMIT 1').bind(JSON.stringify(identities)).first())throw new ImportError(409,'migration_binding_required');
  try { await migrationBatch(db,actor,[
    migrationGuard("EXISTS(SELECT 1 FROM vector_file_migrations WHERE id=? AND workspace_id=? AND state='open' AND version=?)",[id,actor.workspace,input.version]),
    migrationGuard("NOT EXISTS(SELECT 1 FROM vector_migration_runs m JOIN ik_jobs j ON j.id=m.job_id WHERE m.migration_id=? AND j.state<>'completed')",[id]),
    migrationGuard("NOT EXISTS(SELECT 1 FROM ik_sources WHERE identity IN (SELECT value FROM json_each(?)))",[JSON.stringify(identities)]),
    {sql:"UPDATE vector_migration_references SET state='omitted' WHERE migration_id=? AND state='pending'",params:[id]},
    {sql:"UPDATE vector_file_migrations SET state='finished',version=version+1,accepted_version=?,accepted_fingerprint=?,finished_by=?,finished_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?",params:[input.version,fingerprint,actor.id,id]},
    auditStatement({workspace:actor.workspace,actor:actor.id,action:'migration.finished',subject:id}),
  ]); } catch(error) {
    const current=await readMigration(db,actor,id);
    if(current.state==='finished'&&current.accepted_fingerprint===fingerprint)return migrationReport(db,actor,id);
    if(current.version!==input.version)throw new ImportError(409,'migration_pending_changed');
    throw error;
  }
  return migrationReport(db,actor,id);
}
