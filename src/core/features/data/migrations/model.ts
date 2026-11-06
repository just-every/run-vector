import { ImportError } from '../import/types';
import { importContext,type ImportActor } from '../import/authority';
import { loadPlans } from '../../../../../vendor/base/import-kit/src/d1/plans';
import { wireDatabase } from '../import/wire';
import { nativeTargets } from '../import/native-targets';
import { visibleTeam } from '../../roles/visibility-sql';
import type { NativeIssueValue } from '../import/native-snapshot';
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
/** Source rows and pending identities are indivisible historical custody. Check
 * the retained native destinations, including queued and rolled-back runs, as
 * well as current issue locations; scoped live report joins alone lose those
 * boundaries. Reuse the native content rule, never administrative metadata. */
export async function canReadMigration(db:D1Database,actor:ImportActor,id:string) {
  const rows=(await db.prepare(`SELECT j.id,j.plan_json FROM vector_migration_runs m JOIN ik_jobs j ON j.id=m.job_id
    WHERE m.migration_id=? AND j.destination=?`).bind(id,actor.workspace).all<{id:string;plan_json:string}>()).results;
  const plans=await loadPlans(rows,wireDatabase(db),nativeTargets.planCodec);
  const teams=new Set<string>(),issues=new Set<string>();
  const references=(value:unknown):void=>{
    if(!value||typeof value!=='object')return;
    for(const [key,item] of Object.entries(value)) {
      if(typeof item==='string'&&(key==='id'||key.endsWith('issue_id')))issues.add(item);
      else if(item&&typeof item==='object')references(item);
    }
  };
  for(const plan of plans.values())for(const entry of plan.entries)if(!entry.erased)for(const effect of entry.effects) {
    if(effect.targetKind!=='issue')continue;
    const value=effect.value as unknown as NativeIssueValue;
    teams.add(String(value.issue.team_id));issues.add(effect.targetId);references(value);
  }
  // Native visibility is evaluated afresh, including membership withdrawal and
  // native moves after publication. Refuse the whole aggregate, without counts.
  return !!await db.prepare(`SELECT 1 FROM main.operators reader WHERE reader.id=? AND reader.workspace_id=? AND reader.removed_at IS NULL
    AND (reader.role='owner' OR (
      NOT EXISTS(SELECT 1 FROM json_each(?) team WHERE NOT (${visibleTeam('reader','team.value')}))
      AND NOT EXISTS(SELECT 1 FROM main.issues issue WHERE issue.id IN(SELECT value FROM json_each(?)) AND NOT (${visibleTeam('reader','issue.team_id')}))
    ))`).bind(actor.id,actor.workspace,JSON.stringify([...teams]),JSON.stringify([...issues])).first();
}
export async function readMigration(db:D1Database,actor:ImportActor,id:string) {
  await requireMigrationAuthority(db,actor);
  const row=await db.prepare('SELECT * FROM vector_file_migrations WHERE id=? AND workspace_id=?').bind(id,actor.workspace).first<FileMigration>();
  if(!row||!await canReadMigration(db,actor,id))throw new ImportError(409,'migration_unavailable');
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
