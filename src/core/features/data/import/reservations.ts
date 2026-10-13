import { randomUUID } from 'node:crypto';
import { createD1ImportJob,preflightD1ImportJob,type D1ImportContext,type D1Sql,type ImportPlan } from '../../../../../vendor/base/import-kit/src/d1/index';
import { creationStatements,validateCreation } from '../../../../../vendor/base/import-kit/src/d1/creation';
import { atomic,authorize } from '../../../../../vendor/base/import-kit/src/d1/database';
import { guardErasedSources } from '../../../../../vendor/base/import-kit/src/d1/erasure-claims';
import { stored } from '../../../../../vendor/base/import-kit/src/d1/jobs';
import { requestContext,checkSql,valueBytes,D1RequestLimitError } from '../../../../../vendor/base/import-kit/src/d1/budget';
import { ImportError } from './types';
import type { NativeIssueValue } from './native-snapshot';

/** The reviewed identifiers and all job custody commit together. A concurrent
 * native allocation or review wins or loses this entire transaction, never
 * leaves an unresumable queued job, and never reuses an allocated number. */
export async function createReservedImport(plan:ImportPlan,rawContext:D1ImportContext,metadata:(id:string)=>D1Sql[]) {
 const context=requestContext(rawContext),db=context.storage.database;
 await authorize(context,'create');
 const operationKey=validateCreation(plan,context);
 const prior=await db.prepare('SELECT id FROM ik_jobs WHERE destination=? AND principal_id=? AND operation_key=?').bind(context.destination,context.authorization.principalId,operationKey).first<{id:string}>();
 if(prior)return createD1ImportJob(plan,context);
 await guardErasedSources(plan,db);
 const id=randomUUID(),ranges=await numberRanges(plan,context);
 const reservations=reservationStatements(id,context.destination,ranges);
 validateCreation(plan,context);
 try { await atomic(context,'create',[...creationStatements(plan,context,id,operationKey),...reservations,...metadata(id)],3); }
 catch(error){
  await authorize(context,'create');
  for(const {prefix,first} of ranges){
   const floor=await db.prepare('SELECT last_sequence FROM issue_prefix_sequences WHERE workspace_id=? AND identifier_prefix=?').bind(context.destination,prefix).first<{last_sequence:number}>();
   if(floor&&floor.last_sequence>=first)throw new ImportError(409,'import_review_changed','Another issue or import reserved these identifiers during apply. No run or issue was created. Preview again and apply the new review.');
  }
  throw error;
 }
 return (await stored(id,context,'create')).job;
}

/** Already retained issues are reused, so only absent native targets consume
 * new numbers. Publication still checks their exact retained snapshots. */
async function numberRanges(plan:ImportPlan,context:D1ImportContext) {
 const effects=plan.entries.flatMap(entry=>entry.erased?[]:entry.effects).filter(effect=>effect.targetKind==='issue');
 const existing=new Set<string>();
 for(let start=0;start<effects.length;start+=1000){
  const rows=await context.storage.database.prepare('SELECT id FROM issues WHERE id IN (SELECT value FROM json_each(?))').bind(JSON.stringify(effects.slice(start,start+1000).map(effect=>effect.targetId))).all<{id:string}>();
  rows.results.forEach(row=>existing.add(row.id));
 }
 const ranges=new Map<string,{first:number;last:number}>();
 for(const effect of effects){
  if(existing.has(effect.targetId))continue;
  const issue=(effect.value as unknown as NativeIssueValue).issue,prefix=String(issue.origin_prefix),sequence=Number(issue.sequence_number),range=ranges.get(prefix);
  ranges.set(prefix,{first:Math.min(range?.first??sequence,sequence),last:Math.max(range?.last??sequence,sequence)});
 }
 return [...ranges].map(([prefix,range])=>({prefix,...range}));
}

type Range={prefix:string;first:number;last:number};
function reservationStatements(id:string,destination:string,ranges:Range[]):D1Sql[] {
 return ranges.flatMap(({prefix,first,last})=>[
  {sql:`INSERT INTO vector_import_allocations(job_id,workspace_id,identifier_prefix,first_sequence,last_sequence) SELECT ?,?,?,?,?
    WHERE COALESCE((SELECT last_sequence FROM issue_prefix_sequences WHERE workspace_id=? AND identifier_prefix=?),0)<?`,params:[id,destination,prefix,first,last,destination,prefix,first]},
  {sql:`SELECT CASE WHEN EXISTS(SELECT 1 FROM vector_import_allocations WHERE job_id=? AND identifier_prefix=?) THEN 1 ELSE json('import number reservation changed') END`,params:[id,prefix]},
  {sql:`INSERT INTO issue_prefix_sequences(workspace_id,identifier_prefix,last_sequence,updated_at) VALUES(?,?,?,strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    ON CONFLICT(workspace_id,identifier_prefix) DO UPDATE SET last_sequence=excluded.last_sequence,updated_at=excluded.updated_at`,params:[destination,prefix,last]},
 ]);
}
export function importRunMetadata(id:string,batchSize:number,reportJson:string):D1Sql[] {
 return [
  {sql:`INSERT INTO vector_import_runs(job_id,batch_size,created_at) VALUES(?,?,strftime('%Y-%m-%dT%H:%M:%fZ','now'))`,params:[id,batchSize]},
  {sql:`INSERT INTO vector_import_reports(job_id,report_json,created_at) VALUES(?,?,strftime('%Y-%m-%dT%H:%M:%fZ','now'))`,params:[id,reportJson]},
 ];
}
/** Include product reservations and report custody in the same admission budget
 * as Base's exact production creation serializer, including range lookup reads. */
export async function preflightReservedImport(plan:ImportPlan,context:D1ImportContext,metadata:(id:string)=>D1Sql[]) {
 const id='00000000-0000-0000-0000-000000000000',base=preflightD1ImportJob(plan,context);
 const extra=[...reservationStatements(id,context.destination,await numberRanges(plan,context)),...metadata(id)];
 extra.forEach(checkSql);
 const reads=Math.ceil(plan.entries.flatMap(entry=>entry.erased?[]:entry.effects).filter(effect=>effect.targetKind==='issue').length/1000);
 const totalExecutions=base.totalExecutions+extra.length+reads;
 if(totalExecutions>1000)throw new D1RequestLimitError();
 return {...base,mutationStatements:base.mutationStatements+extra.length,totalExecutions,
  maxBoundBytes:Math.max(base.maxBoundBytes,...extra.map(statement=>(statement.params??[]).reduce((sum,value)=>sum+valueBytes(value),0)))};
}
