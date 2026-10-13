import { useState } from 'react';
import { z } from 'zod';
import { fetchJson } from '../../../app/api-client';
import { post,detachedText,runSchema,continueRun,runProgressText,rollbackPreviewSchema,reportSchema,type Runs,type Run,type RollbackPreview,type ImportReportData } from './import-client';
import { ImportReport } from './import-report';
const runState=(run:Runs[number])=>{
 const total=run.batchSize?Math.ceil(run.total/run.batchSize):1;
 const batches=`${run.batchesApplied} of ${run.batchesApplied+Math.ceil((run.total-run.checkpoint)/(run.batchSize??Math.max(run.total,1)))} batches`;
 if(run.state==='completed')return `Completed · ${total} ${total===1?'batch':'batches'} · ${run.total} source records`;
 if(['queued','applying','failed'].includes(run.state))return `Unfinished · applied ${batches} · ${run.checkpoint} of ${run.total} source records published`+(run.lastError?` · last batch failed (${run.lastError})`:'');
 return `${run.state.replaceAll('_',' ')} · ${run.checkpoint} of ${run.total} source records`;
};
export function ImportRuns({runs,busy,onChanged,onRefresh,onError}:{runs:Runs;busy:boolean;onChanged:(run:Run)=>void;onRefresh:()=>void;onError:(error:unknown,run?:Run)=>void}) {
 const [report,setReport]=useState<ImportReportData|null>(null),[confirm,setConfirm]=useState<RollbackPreview|null>(null),[working,setWorking]=useState<{id:string;text?:string}|null>(null);
 const resume=async(id:string)=>{
  let shown:Run|undefined;setWorking({id});
  try{await continueRun(await post('/api/data/import/runs/'+id+'/resume',runSchema,{}),run=>{shown=run;setWorking({id,text:runProgressText(run)});onChanged(run);});}
  catch(error){onError(error,shown);}finally{setWorking(null);onRefresh();}
 };
 const review=async(id:string)=>{
  try{setConfirm(await fetchJson('/api/data/import/runs/'+id+'/rollback',rollbackPreviewSchema));}catch(error){onError(error);}
 };
 const rollback=async(id:string)=>{
  try{setConfirm(null);await continueRun(await post('/api/data/import/runs/'+id+'/rollback',runSchema,{confirmed:true}),run=>{setWorking({id,text:runProgressText(run)});onChanged(run);});}
  catch(error){onError(error);}finally{setWorking(null);onRefresh();}
 };
 const openReport=async(id:string)=>{try{setReport(await fetchJson('/api/data/import/runs/'+id+'/report',reportSchema));}catch(error){onError(error);}};
 const downloadReport=async(id:string)=>{
  try{const response=await fetch('/api/data/import/runs/'+id+'/report.csv');if(!response.ok)throw Error('The report CSV could not be read ('+response.status+').');
   const url=URL.createObjectURL(await response.blob()),link=document.createElement('a');link.href=url;link.download='import-'+id+'.csv';link.click();URL.revokeObjectURL(url);}
  catch(error){onError(error);}
 };
 const originals=async(id:string)=>{
  try {
   const original=await fetchJson('/api/data/import/runs/'+id+'/originals',z.array(z.object({name:z.string(),original:z.object({status:z.string(),base64:z.string().optional()})}).passthrough()));
   for(const file of original){if(file.original.status!=='available'||!file.original.base64)continue;const bytes=Uint8Array.from(atob(file.original.base64),c=>c.charCodeAt(0)),url=URL.createObjectURL(new Blob([bytes]));const link=document.createElement('a');link.href=url;link.download=file.name;link.click();URL.revokeObjectURL(url);}
  }catch(error){onError(error);}
 };
 const disabled=busy||working!==null;
 return <section aria-labelledby="import-runs-heading"><h3 id="import-runs-heading">Retained import runs</h3><p>Resume publishes the remaining batches from the durable run. Rollback refuses if an imported issue or its relationships were edited.</p>
  {!runs.length?<p>No imports yet.</p>:<ul className="import-runs">{runs.map(run=><li key={run.id}><strong>{run.namespace.replace(/^vector-import:/,'')}</strong><code>{run.id}</code><p>{working?.id===run.id&&working.text?working.text+'…':runState(run)+detachedText(run)}</p><div className="import-actions"><button type="button" disabled={disabled} onClick={()=>void originals(run.id)}>Download originals</button><button type="button" disabled={disabled} onClick={()=>void resume(run.id)}>Read / resume</button><button type="button" disabled={disabled} onClick={()=>void openReport(run.id)}>Reconciliation report</button>{confirm?.runId===run.id?<RollbackReview preview={confirm} disabled={disabled} onConfirm={()=>void rollback(run.id)} onCancel={()=>setConfirm(null)}/>:<button type="button" disabled={disabled||run.state==='rolled_back'} onClick={()=>void review(run.id)}>Roll back</button>}</div>{report?.run.id===run.id&&<ImportReport report={report} onDownload={()=>void downloadReport(run.id)} onClose={()=>setReport(null)}/>}</li>)}</ul>}
 </section>;
}
const tableNames:Record<string,string>={issues:'issues',issue_labels:'label assignments',issue_activity:'activity entries',issue_parents:'parent links',issue_dependencies:'dependencies',issue_comments:'comments',issue_links:'links',vector_import_revisions:'import markers',due_reminder_suppressions:'consumed overdue reminders'};
function RollbackReview({preview,disabled,onConfirm,onCancel}:{preview:RollbackPreview;disabled:boolean;onConfirm:()=>void;onCancel:()=>void}) {
 const removed=Object.entries(preview.rows).filter(([,count])=>count>0).map(([table,count])=>`${count} ${tableNames[table]??table.replaceAll('_',' ')}`);
 return <div className="import-rollback"><p>Rollback removes: {removed.join(', ')||'nothing'}. Nothing created outside the run is touched. Identifier numbers remain reserved and the originals not withdrawn by personal-data erasure are kept.</p>
  {preview.detachedIssues>0&&<p>{preview.detachedIssues} erasure-detached issues will stay: {preview.detachedIdentifiers.join(', ')}. Personal-data erasure removed their import custody. Unlink or delete a retained issue that points to an issue being removed, then review rollback again. Removing a dependency records native work on both issues; its imported endpoint may also need deletion. Deleting the detached issue directly avoids that dependency edit.</p>}
  {preview.conflicts.length?<><p role="alert">Conflicts on {preview.conflicts.length} imported {preview.conflicts.length===1?'issue':'issues'} block the rollback. Nothing will be removed while these conflicts remain:</p><ul>{preview.conflicts.map(conflict=><li key={conflict.identifier}>{conflict.identifier} (from {conflict.sourceId}): {conflict.reasons.map(reason=>reason==='erasure_detached'?`erasure-detached issues still point here: ${conflict.detachedIdentifiers?.join(', ')}; unlink or delete them before rollback`:reason).join(', ')}</li>)}</ul></>:null}
  <button type="button" disabled={disabled||preview.conflicts.length>0} onClick={onConfirm}>Confirm rollback</button><button type="button" onClick={onCancel}>Cancel</button></div>;
}
