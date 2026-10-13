import { useEffect,useState,type FormEvent } from 'react';
import { useApiResource } from '../../../app/api-client';
import { importFields,importLimits,type ImportInput,type ImportMapping } from '../import/types';
import { previewSchema,post,runSchema,runsSchema,readImportFile,continueRun,runProgressText,groupDiagnostics,receiptRow,type Run,type Review } from './import-client';
import { JiraConfiguration } from './jira-configuration';
import { ImportRuns } from './import-runs';
import { ImportMapping as MappingControls } from './import-mapping';
import './data.css';
export function DataPanel() {
 const runs=useApiResource('/api/data/import/runs',runsSchema);
 const [ready,setReady]=useState(false);useEffect(()=>setReady(true),[]);
 const [format,setFormat]=useState<ImportInput['format']>('csv'),[source,setSource]=useState(''),[file,setFile]=useState<{name:string;base64:string;headers:string[]}|null>(null),[mapping,setMapping]=useState<ImportMapping>({}),[defaults,setDefaults]=useState<ImportInput['defaults']>({}),[references,setReferences]=useState<ImportInput['references']>({}),[review,setReview]=useState<Review|null>(null),[reviewedInput,setReviewedInput]=useState<ImportInput|null>(null),[acknowledged,setAcknowledged]=useState(false),[pending,setPending]=useState(false),[message,setMessage]=useState<{runId?:string;text:string}>({text:''}),[apiFile,setApiFile]=useState<{name:string;base64:string}|null>(null);
 const [jira,setJira]=useState<NonNullable<ImportInput['jira']>>({});
 const publish=(run:Run)=>{
  runs.publishReceipt(current=>({runs:[receiptRow(run),...(current?.runs??[]).filter(row=>row.id!==run.id)]}));
  setMessage({runId:run.id,text:run.progress.unfinished?runProgressText(run)+'…':`Import ${run.state}: ${runProgressText(run)}. No messages or invitations were sent.`});
 };
 const clear=()=>{setReview(null);setReviewedInput(null);setAcknowledged(false);setMessage({text:''});};
 const fail=(error:unknown,run?:Run)=>{
  const text=error instanceof Error?error.message:'The operation could not complete. Read its retained run before retrying.';
  setMessage(run?{runId:run.id,text:`Stopped. ${runProgressText(run)}. ${text} Resume continues from the next batch; published batches stay marked as part of an unfinished run.`}:{text});
 };
 const choose=async(selected?:File)=>{
  clear();setFile(null);if(!selected)return;
  try{const next=await readImportFile(selected,format);setFile(next);setMapping(format==='jira-csv'?{}:Object.fromEntries(importFields.filter(field=>next.headers.includes(field)).map(field=>[field,field])));}catch(error){fail(error);}
 };
 const chooseApi=async(selected?:File)=>{clear();setApiFile(null);if(!selected)return;try{const read=await readImportFile(selected,'json',false);setApiFile({name:read.name,base64:read.base64});}catch(error){fail(error);}};
 const preview=async(event:FormEvent)=>{
  event.preventDefault();if(!file)return;setPending(true);setMessage({text:''});
  try{const input:ImportInput={format,source,name:file.name,base64:file.base64,...(format==='linear-api-json'&&apiFile?{api:apiFile}:{}),mapping,defaults,references,...(format==='jira-csv'?{jira}:{})};const result=await post('/api/data/import/preview',previewSchema,input);setReview(result);setReviewedInput({...input,effectiveAt:result.effectiveAt});setAcknowledged(false);}catch(error){clear();fail(error);}finally{setPending(false);}
 };
 const apply=async()=>{
  if(!review?.ready||!review.fingerprint||!reviewedInput)return;setPending(true);setMessage({text:''});
  let shown:Run|undefined;
  try{
   const created=await post('/api/data/import/apply',runSchema,{input:reviewedInput,reviewedFingerprint:review.fingerprint,operationKey:'review:'+review.fingerprint,acknowledgeOmissions:acknowledged});
   setReview(null);setReviewedInput(null);
   await continueRun(created,run=>{shown=run;publish(run);});
  }catch(error){fail(error,shown);}
  finally{setPending(false);runs.reload();}
 };
 return <section id="data" className="data-panel" aria-labelledby="data-heading"><h2 id="data-heading">Data / Move in</h2><p>Map CSV or JSON issues, review every error and omission, then apply the reviewed run. One run reads up to {importLimits.rows.toLocaleString('en-US')} source rows in a file of up to {Math.round(importLimits.bytes/1048576)} MiB and publishes them in staged batches; each batch is all or nothing.</p><p>Linear CSV file importer (documented format, tested with generated files): workspace issue CSV. Comments and attachment bytes are absent from this export. Unmapped and unsupported values remain in the originals.</p>
 <form onSubmit={event=>void preview(event)}><div className="import-file-fields"><label>File format<select aria-label="File format" value={format} disabled={pending||!ready} onChange={event=>{setFormat(event.target.value as ImportInput['format']);setFile(null);setMapping({});setDefaults({});setReferences({});clear();}}><option value="csv">Mapped CSV</option><option value="json">Mapped JSON array</option><option value="jira-csv">Jira All Fields CSV (supported profile)</option><option value="linear-csv">Linear workspace CSV</option><option value="linear-api-json">Linear CSV with API file</option></select></label><label>Stable source name<input required maxLength={100} pattern={"[a-zA-Z0-9][a-zA-Z0-9._:\\-]*"} value={source} disabled={pending||!ready} onChange={event=>{setSource(event.target.value);clear();}} placeholder="migration-october"/></label><label>Issue export file<input key={format} required type="file" accept={format==='json'?'.json,application/json':'.csv,text/csv'} disabled={pending||!ready} onChange={event=>void choose(event.target.files?.[0])}/></label>{format==='linear-api-json'&&<label>Linear API file (docs/LINEAR-API-FILE.md)<input required type="file" accept=".json,application/json" disabled={pending||!ready} onChange={event=>void chooseApi(event.target.files?.[0])}/></label>}</div>
 {file&&<MappingControls headers={file.headers} linear={format==='linear-csv'||format==='linear-api-json'||format==='jira-csv'} jira={format==='jira-csv'} busy={pending} value={{mapping,defaults,references}} onChange={next=>{setMapping(next.mapping);setDefaults(next.defaults);setReferences(next.references);clear();}}/>}
 {format==='jira-csv'&&<JiraConfiguration value={jira} busy={pending} onChange={value=>{setJira(value);clear();}}/>}
 <button type="submit" disabled={pending||!ready||!file||!source||(format==='linear-api-json'&&!apiFile)}>Preview import</button></form>
 {message.text&&<p role="status" data-run-id={message.runId}>{message.text}</p>}{runs.error&&<p role="alert">{runs.error.message}</p>}
 {review&&<section className="import-review" aria-labelledby="import-review-heading"><h3 id="import-review-heading">Review {review.count} source rows</h3><p>{review.measured.fileBytes} bytes · {review.measured.reused??0} previously imported rows · {review.measured.batches?`${review.measured.batches} batches of up to ${review.measured.batchSize} rows`:'not yet admitted'}</p>{review.jiraDates&&<p>Dates: {review.jiraDates.pattern} · sample: {review.jiraDates.sample||'(none)'} · {review.jiraDates.cells} date cells · source offset: {review.jiraDates.sourceOffset} · short-year century: {review.jiraDates.shortYearCentury??'none supplied'}. {review.jiraDates.policy}</p>}{review.errors.length>0&&<><p role="alert">Nothing can be applied until these errors are fixed.</p><ul>{groupDiagnostics(review.errors).map(group=><li key={group.field+group.code}>{group.field?group.field+': ':''}{group.message} · {group.rows.length} {group.rows.length===1?'row':'rows'} ({rowList(group.rows)})</li>)}</ul></>}{review.omissions.length>0&&<><h4>Not imported, kept in the original file</h4><ul>{groupDiagnostics(review.omissions).map(group=><li key={group.field+group.code}>{group.field?group.field+': ':''}{group.message} · {group.rows.length} {group.rows.length===1?'row':'rows'} ({rowList(group.rows)})</li>)}</ul><label className="import-ack"><input type="checkbox" checked={acknowledged} onChange={event=>setAcknowledged(event.target.checked)}/>I reviewed these omissions.</label></>}<button type="button" disabled={pending||!review.ready||(review.omissions.length>0&&!acknowledged)} onClick={()=>void apply()}>Apply reviewed run</button></section>}
 <ImportRuns runs={runs.data?.runs??[]} busy={pending} onChanged={publish} onRefresh={runs.reload} onError={fail}/>
 </section>;
}
const rowList=(rows:number[])=>'row '+rows.slice(0,12).join(', ')+(rows.length>12?` and ${rows.length-12} more`:'');
