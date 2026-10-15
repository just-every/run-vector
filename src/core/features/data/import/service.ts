import { Buffer } from 'node:buffer';
import { planD1Import,readD1ImportJob,readD1ImportOriginals,resumeD1Import,rollbackD1Import,canonicalJson,sha256 } from '../../../../../vendor/base/import-kit/src/d1/index';
import type { ImportJob,ImportPlan } from '../../../../../vendor/base/import-kit/src/d1/index';
import { checkSql,valueBytes } from '../../../../../vendor/base/import-kit/src/d1/budget';
import { parseImport } from './source';
import { mapImport } from './mapper';
import { effectPlan } from './effect-report';
import { buildJiraReview } from './jira-review';
import { jiraInput } from './jira';
import { linearInput } from './linear';
import { importContext,type ImportActor } from './authority';
import { wireDatabase } from './wire';
import { nativeTargets,nativeTargetsForRun } from './native-targets';
import { createReservedImport,preflightReservedImport,importRunMetadata } from './reservations';
import { explainResumeFailure } from './recovery';
import { runProgress,recordRunFailure,clearRunFailure,type RunProgress } from './runs';
import { rollbackPreview,refuseRollbackConflicts } from './rollback';
import { reportInput,buildReport,reportCsv,type ReportInput } from './report';
import { ImportError,importLimits,type ImportInput,type ImportPreview } from './types';

// Each published source entry also carries Base's provenance, claim and guard
// statements and two reads. Batch sizing keeps this request's executions well
// inside D1's per-invocation limit (measured in docs/MOVE-IN.md).
const entryOverhead = 12, batchExecutions = 800;

function normalized(input:ImportInput):ImportInput {
  const selected=linearInput(jiraInput(input));
  return {...selected,source:'vector-import:'+selected.source};
}
function mappingVersion(input:ImportInput) {
  return 'vector-issues-v1:'+sha256(canonicalJson({...(input.format==='jira-csv'?{jiraEffectsVersion:3}:{}),format:input.format,mapping:input.mapping,defaults:input.defaults??{},references:input.references??{},...(input.jira?{jira:input.jira}:{})}));
}
type PlannedPreview = ImportPreview & { plan?: ImportPlan; batchSize?: number; report?: ReportInput };
async function planImport(db:D1Database,actor:ImportActor,raw:ImportInput,origin:string):Promise<PlannedPreview> {
  const input=normalized(raw),effectiveAt=input.effectiveAt??new Date().toISOString();
  if(!Number.isFinite(Date.parse(effectiveAt)) || new Date(effectiveAt).toISOString()!==effectiveAt)throw new ImportError(400,'invalid_review_time');
  const parsed=await parseImport(input),version=mappingVersion(input);
  const mapped=await mapImport(db,actor,input,parsed.source,effectiveAt,version,origin);
  const errors=[...parsed.errors,...mapped.errors];
  if(!parsed.source.records.length)errors.push({row:0,code:'empty_import',message:'The file contains no issue rows.'});
  const jiraReview=input.format==='jira-csv'?buildJiraReview(parsed.source.records,input,errors,mapped.omissions,mapped.references):undefined;
  const preview:PlannedPreview={ready:false,effectiveAt,...(jiraReview?{jiraReview}:{}),...(parsed.jiraDates?{jiraDates:parsed.jiraDates}:{}),headers:parsed.headers,errors,omissions:mapped.omissions,count:parsed.source.records.length,bounds:importLimits,measured:{fileBytes:Buffer.from(input.base64,'base64').byteLength,rows:parsed.source.records.length,reused:mapped.reused}};
  if(errors.length)return preview;
  const context=importContext(db,actor,input.source,version);
  const plan=await planD1Import(mapped.source,{version,map:record=>mapped.effects.get(record.sourceId)!},context);
  let nativeBytes=0,nativeStatements=0,maxParameters=0,entryStatements=1,entryBytes=1;
  try {
    preview.report=reportInput(input,parsed.headers,parsed.source.records,mapped.omissions,jiraReview);
    preview.report.effects=effectPlan(mapped.effects,mapped.references.labels,actor.workspace,input.source);
    const reportJson=JSON.stringify(preview.report);
    checkSql({sql:'INSERT INTO vector_import_reports(job_id,report_json) VALUES(?,?)',params:['0'.repeat(36),reportJson]});
    preview.measured.reportBytes=Buffer.byteLength(reportJson);
    for(const entry of plan.entries) {
      let statementsHere=0,bytesHere=0;
      for(const effect of entry.effects) {
        for(const statement of nativeTargets.write({destination:actor.workspace,...effect,revision:'0'.repeat(64)})) {
          checkSql(statement);statementsHere++;
          bytesHere+=Buffer.byteLength(statement.sql)+(statement.params??[]).reduce((sum,value)=>sum+valueBytes(value),0);
          maxParameters=Math.max(maxParameters,statement.params?.length??0);
        }
      }
      nativeStatements+=statementsHere;nativeBytes+=bytesHere;
      entryStatements=Math.max(entryStatements,statementsHere);entryBytes=Math.max(entryBytes,bytesHere);
    }
    const batchSize=Math.max(1,Math.min(1000,Math.floor(importLimits.batchStatements/entryStatements),Math.floor(importLimits.batchBytes/entryBytes),Math.floor(batchExecutions/(entryStatements+entryOverhead))));
    const planText=canonicalJson(plan),planBytes=Buffer.byteLength(planText);
    // A character above U+00FF is sent as a six-character escape (wire.ts); the retained plan chunks add about 5% of JSON quoting.
    const planWireBytes=Math.ceil((planText.length+5*(planText.match(/[^\u0000-\u00ff]/g)?.length??0))*1.05);
    if(planWireBytes+importLimits.requestOverhead>importLimits.requestBytes)throw new ImportError(413,'import_request_limit');
    const creation=await preflightReservedImport(plan,{...context,reviewedFingerprint:plan.fingerprint},id=>importRunMetadata(id,batchSize,reportJson));
    Object.assign(preview.measured,{nativeBytes,nativeStatements,maxParameters,entryStatements,entryBytes,batchSize,batches:Math.ceil(plan.entries.length/batchSize),creationStatements:creation.mutationStatements,creationExecutions:creation.totalExecutions,creationMaxBoundBytes:creation.maxBoundBytes,planBytes,planWireBytes});
    if(entryStatements+entryOverhead>batchExecutions || entryBytes>importLimits.batchBytes)throw new ImportError(413,'import_native_limit');
    preview.batchSize=batchSize;
  } catch(error) {
    preview.errors.push({row:0,code:error instanceof ImportError?error.code:'import_plan_limit',message:'The measured plan or native SQL exceeds the admitted D1 statement, binding or request size. Split the source file and preview again.'});
    return preview;
  }
  // Do not return a private preview if authority changed during parser/reference
  // reads. Planning repeats the current SQL admission after those awaits.
  await planD1Import(mapped.source,{version,map:record=>mapped.effects.get(record.sourceId)!},context);
  preview.ready=true;preview.fingerprint=plan.fingerprint;preview.plan=plan;
  return preview;
}
export async function previewImport(db:D1Database,actor:ImportActor,raw:ImportInput,origin:string):Promise<ImportPreview> {
  const {plan:_plan,batchSize:_batchSize,report:_report,...preview}=await planImport(db,actor,raw,origin);
  return preview;
}
export type ImportRun = ImportJob & { progress: RunProgress };
/** Creates the run from the exact reviewed plan. Batches publish through resume,
 * one per request; an existing run for the same review returns unchanged. */
export async function applyImport(db:D1Database,actor:ImportActor,input:ImportInput,origin:string,reviewedFingerprint:string,operationKey:string,acknowledgeOmissions:boolean):Promise<ImportRun> {
  if(!/^[a-f0-9]{64}$/.test(reviewedFingerprint) || !/^[A-Za-z0-9._:-]{1,128}$/.test(operationKey))throw new ImportError(400,'invalid_import_review');
  if(!input.effectiveAt)throw new ImportError(400,'review_time_required');
  // Replaying the same review returns its run unchanged, even after publication
  // made every record a reuse: same operation, fingerprint, mapping and exact bytes.
  const selected=normalized(input);
  const replay=await db.prepare(`SELECT j.id FROM ik_jobs j WHERE j.destination=? AND j.principal_id=? AND j.namespace=? AND j.operation_key=? AND j.fingerprint=? AND j.mapping_version=?
    AND EXISTS(SELECT 1 FROM ik_originals o WHERE o.job_id=j.id AND o.sha256=?)`).bind(actor.workspace,actor.id,selected.source,operationKey,reviewedFingerprint,mappingVersion(selected),sha256(Buffer.from(selected.base64,'base64'))).first<{id:string}>();
  if(replay)return importStatus(db,actor,replay.id);
  const preview=await planImport(db,actor,input,origin);
  if(preview.errors.some(error=>error.code==='source_content_conflict'))throw new ImportError(409,'import_conflict','The file changes records this source already imported. Nothing was overwritten.');
  if(!preview.ready || !preview.plan || !preview.batchSize)throw new ImportError(400,'import_preflight_failed');
  if(preview.fingerprint!==reviewedFingerprint)throw new ImportError(409,'import_review_changed');
  if(preview.omissions.length && !acknowledgeOmissions)throw new ImportError(400,'import_omissions_unreviewed');
  const plan=preview.plan;
  // A source name identifies the run while it is unfinished: a different file
  // under it conflicts instead of racing the retained run for the same records.
  const unfinished=await db.prepare(`SELECT id FROM ik_jobs WHERE destination=? AND namespace=? AND fingerprint<>? AND state IN ('queued','applying','failed','rolling_back','undoing') LIMIT 1`).bind(actor.workspace,plan.namespace,plan.fingerprint).first();
  if(unfinished)throw new ImportError(409,'import_run_unfinished','A run for this source name is unfinished. Resume or roll it back before applying a different file.');
  const job=await createReservedImport(plan,importContext(db,actor,plan.namespace,plan.mappingVersion,reviewedFingerprint,operationKey),id=>importRunMetadata(id,preview.batchSize!,JSON.stringify(preview.report)));
  return withProgress(db,job);
}
async function withProgress(db:D1Database,job:ImportJob):Promise<ImportRun> {
  return {...job,progress:await runProgress(db,job)};
}
async function runContext(db:D1Database,actor:ImportActor,id:string,batchSize=1000) {
  if(!/^[a-f0-9-]{36}$/.test(id))throw new ImportError(400,'invalid_import_run');
  const row=await db.prepare('SELECT j.namespace,j.mapping_version,r.batch_size FROM ik_jobs j LEFT JOIN vector_import_runs r ON r.job_id=j.id WHERE j.id=? AND j.destination=? AND j.principal_id=?').bind(id,actor.workspace,actor.id).first<{namespace:string;mapping_version:string;batch_size:number|null}>();
  if(!row || !row.namespace.startsWith('vector-import:'))throw new ImportError(409,'import_run_unavailable');
  return {...importContext(db,actor,row.namespace,row.mapping_version),storage:{database:wireDatabase(db),targets:nativeTargetsForRun(id)},batchSize:row.batch_size??batchSize,maxBatches:1};
}
export async function importStatus(db:D1Database,actor:ImportActor,id:string) {
  return withProgress(db,await readD1ImportJob(id,await runContext(db,actor,id)));
}
export async function importOriginals(db:D1Database,actor:ImportActor,id:string) {
  return readD1ImportOriginals(id,await runContext(db,actor,id));
}
/** Publishes the next batch (or continues a started rollback). A failure leaves
 * the committed batches in place and is recorded for the run's status. */
export async function resumeImport(db:D1Database,actor:ImportActor,id:string) {
  const context=await runContext(db,actor,id);
  let job:ImportJob;
  try { job=await resumeD1Import(id,context); }
  catch(error) { const failure=await explainResumeFailure(id,context,error);await recordRunFailure(db,id,failure);throw failure; }
  await clearRunFailure(db,id);
  return withProgress(db,job);
}
export async function importRollbackPreview(db:D1Database,actor:ImportActor,id:string) {
  await runContext(db,actor,id);
  return rollbackPreview(db,actor.workspace,id);
}
/** Whole-run rollback: refused, with nothing written, while any imported issue
 * has later native work. Each request reverses one batch; repeat until done. */
export async function rollbackImport(db:D1Database,actor:ImportActor,id:string) {
  const context=await runContext(db,actor,id);
  await refuseRollbackConflicts(db,actor.workspace,id);
  let job:ImportJob;
  try { job=await rollbackD1Import(id,context); }
  catch(error) { await recordRunFailure(db,id,error);throw error; }
  await clearRunFailure(db,id);
  return withProgress(db,job);
}
async function storedReport(db:D1Database,actor:ImportActor,id:string) {
  await runContext(db,actor,id);
  const row=await db.prepare('SELECT j.namespace,j.state,r.report_json FROM ik_jobs j JOIN vector_import_reports r ON r.job_id=j.id WHERE j.id=?').bind(id).first<{namespace:string;state:string;report_json:string}>();
  if(!row)throw new ImportError(409,'import_report_unavailable','This run predates reconciliation reports.');
  const input=JSON.parse(row.report_json) as ReportInput;
  return {input,report:await buildReport(db,{id,namespace:row.namespace,state:row.state},input)};
}
/** DATA-007: what the run read, wrote and omitted, and what the file never held. */
export async function importReport(db:D1Database,actor:ImportActor,id:string) {
  return (await storedReport(db,actor,id)).report;
}
export async function importReportCsv(db:D1Database,actor:ImportActor,id:string) {
  const {input,report}=await storedReport(db,actor,id);
  return reportCsv(report,input);
}
