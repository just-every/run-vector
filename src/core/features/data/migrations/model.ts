import { ImportError } from '../import/types';
import { importContext,type ImportActor } from '../import/authority';
import type { D1Sql } from '../../../../../vendor/base/import-kit/src/d1/index';

export type FileMigration = {id:string;workspace_id:string;source:string;state:'open'|'finished';version:number;accepted_version:number|null;accepted_fingerprint:string|null;finished_by:string|null;finished_at:string|null;created_at:string};
export type PendingReference = {row:number;sourceId:string;targetSourceId:string;kind:'parent'|'dependencies'|'duplicateOf'|'blocks'|'related'};
export type MigrationReference = PendingReference & {id:string;runId:string;state:'pending'|'omitted'};

/** The session and current leadership role fence every mutation, including replay. */
export function migrationAuthority(db:D1Database,actor:ImportActor):D1Sql {
  const admission=importContext(db,actor,'vector-file-migration','v1').authorization.predicate('read',actor.workspace);
  return {sql:`(${admission.sql}) AND EXISTS(SELECT 1 FROM operators WHERE id=? AND workspace_id=? AND removed_at IS NULL AND role IN ('owner','admin'))`,params:[...admission.params??[],actor.id,actor.workspace]};
}
export async function requireMigrationAuthority(db:D1Database,actor:ImportActor) {
  const check=migrationAuthority(db,actor);
  if(!await db.prepare('SELECT 1 WHERE '+check.sql).bind(...check.params??[]).first())throw new ImportError(403,'migration_forbidden');
}
export async function readMigration(db:D1Database,actor:ImportActor,id:string) {
  await requireMigrationAuthority(db,actor);
  const row=await db.prepare('SELECT * FROM vector_file_migrations WHERE id=? AND workspace_id=?').bind(id,actor.workspace).first<FileMigration>();
  if(!row)throw new ImportError(409,'migration_unavailable');
  return row;
}
export async function importMigration(db:D1Database,actor:ImportActor,input:{migrationId?:string;source:string}) {
  if(!input.migrationId)return;
  const migration=await readMigration(db,actor,input.migrationId);
  if(input.source.replace(/^vector-import:/,'')!==migration.source)throw new ImportError(409,'migration_source_mismatch');
  if(migration.state!=='open')throw new ImportError(409,'migration_finished');
  return migration;
}
export const migrationGuard=(sql:string,params:D1Sql['params']=[]):D1Sql=>({sql:`SELECT CASE WHEN (${sql}) THEN 1 ELSE json('migration changed') END`,params});
export async function migrationBatch(db:D1Database,actor:ImportActor,statements:D1Sql[]) {
  const authority=migrationAuthority(db,actor);
  await db.batch([migrationGuard(authority.sql,authority.params),...statements,migrationGuard(authority.sql,authority.params)].map(s=>db.prepare(s.sql).bind(...s.params??[])));
}
