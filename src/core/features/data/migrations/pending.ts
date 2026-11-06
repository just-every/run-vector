import { sha256,canonicalJson,type D1Sql } from '../../../../../vendor/base/import-kit/src/d1/index';
import type { MappedRow } from '../import/row-values';
import type { ImportInput } from '../import/types';
import { migrationGuard,type FileMigration,type PendingReference } from './model';

/** Only source references may wait. Explicit native references retain ordinary refusal. */
export function pendingCollector(input:ImportInput,rows:MappedRow[]) {
  const present=new Set(rows.filter(row=>row.value).map(row=>row.record.sourceId)),pending:PendingReference[]=[];
  const defer=(row:MappedRow,kind:PendingReference['kind'],value:string,sourceOnly=false)=>{
    if(!input.migrationId||value.startsWith('native:')||(!sourceOnly&&!value.startsWith('source:')))return false;
    const targetSourceId=value.replace(/^source:/,'');
    if(present.has(targetSourceId))return false;
    if(!pending.some(item=>item.sourceId===row.record.sourceId&&item.kind===kind&&item.targetSourceId===targetSourceId))pending.push({row:row.record.location.row!,sourceId:row.record.sourceId,targetSourceId,kind});
    return true;
  };
  return {pending,defer};
}
/** Run identity, pending custody and the version advance commit with Base's job. */
export function migrationRunMetadata(migration:FileMigration|undefined,id:string,pending:PendingReference[]):D1Sql[] {
  if(!migration)return [];
  return [
    migrationGuard("EXISTS(SELECT 1 FROM vector_file_migrations WHERE id=? AND workspace_id=? AND source=? AND state='open' AND version=?)",[migration.id,migration.workspace_id,migration.source,migration.version]),
    {sql:"INSERT INTO vector_migration_runs(job_id,migration_id,created_at) VALUES(?,?,strftime('%Y-%m-%dT%H:%M:%fZ','now'))",params:[id,migration.id]},
    ...pending.map(item=>({sql:`INSERT INTO vector_migration_references(id,migration_id,job_id,source_row,source_id,target_source_id,kind) VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING`,params:[sha256(canonicalJson([migration.id,item.sourceId,item.kind,item.targetSourceId])),migration.id,id,item.row,item.sourceId,item.targetSourceId,item.kind]})),
    {sql:'UPDATE vector_file_migrations SET version=version+1 WHERE id=?',params:[migration.id]},
  ];
}
