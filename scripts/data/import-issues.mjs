import { readFile,lstat } from 'node:fs/promises';
import { resolve,basename,isAbsolute } from 'node:path';
import { options as transportOptions,cookieFile,privateFile } from '../base-cli/modules/portability/cli-options.mjs';
// The server enforces the measured run limits (docs/MOVE-IN.md); these bound local reads.
const fileBytes=4194304,reviewBytes=16777216;
const commands=['preview','apply','status','resume','rollback','report'];
const args=process.argv.slice(2);if(args[0]==='--')args.shift();
const command=args.shift(),selected={};
const summary=run=>({id:run.id,state:run.state,checkpoint:run.checkpoint,total:run.total,batchesApplied:run.progress?.batchesApplied,batchesTotal:run.progress?.batchesTotal});
let last;
async function main(){
 if(!commands.includes(command))throw Error('command');
 while(args.length){const key=args.shift();if(key==='--yes'){if(selected.yes)throw Error('options');selected.yes=true;continue;}if(!['--origin','--session-file','--file','--format','--source','--mapping','--review','--run','--csv','--api-file'].includes(key)||selected[key.slice(2)]!==undefined||!args.length)throw Error('options');selected[key.slice(2)]=args.shift();}
 const session=selected['session-file'];if(!isAbsolute(session??''))throw Error('session');const info=await lstat(session);if(!info.isFile()||(info.mode&0o077))throw Error('session');
 const checked=transportOptions(['export','--origin',selected.origin,'--session-file',session,'--out',resolve('unused-import-output')]),cookie=await cookieFile(session);
 const request=async(path,body)=>{let response;try{response=await fetch(checked.origin+'/api/data/import/'+path,{method:body===undefined?'GET':'POST',redirect:'error',headers:{Cookie:cookie,Origin:checked.origin,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});}catch{throw Error('transport');}if(!response.ok){await response.body?.cancel();throw Error('HTTP '+response.status);}return response.json();};
 const readPrivate=async path=>{if(!isAbsolute(path??''))throw Error('review');const stat=await lstat(path);if(!stat.isFile()||(stat.mode&0o077)||stat.size>reviewBytes)throw Error('review');return JSON.parse(await readFile(path,'utf8'));};
 // Each request publishes one batch; progress goes to stderr, the result to stdout.
 const publish=async run=>{
  last=run;
  while(run.progress?.unfinished){console.error(run.state==='rolling_back'?`rolling back: ${run.progress.issuesRemaining} imported issues remain`:`applied ${run.progress.batchesApplied} of ${run.progress.batchesTotal} batches (${run.checkpoint} of ${run.total} source records)`);run=await request('runs/'+run.id+'/resume',{});last=run;}
  return run;
 };
 if(command==='preview'){
  if(!isAbsolute(selected.file??'')||!isAbsolute(selected.review??''))throw Error('paths');
  const stat=await lstat(selected.file);if(!stat.isFile()||stat.size>fileBytes)throw Error('file');
  const mapping=selected.mapping?JSON.parse(await readFile(selected.mapping,'utf8')):{};
  // linear-api-json: the Linear CSV (--file) and the owner's API file (--api-file), one run.
  let api;if(selected['api-file']!==undefined){if(!isAbsolute(selected['api-file']))throw Error('paths');const apiStat=await lstat(selected['api-file']);if(!apiStat.isFile()||apiStat.size>fileBytes)throw Error('file');api={name:basename(selected['api-file']),base64:(await readFile(selected['api-file'])).toString('base64')};}
  const input={format:selected.format,source:selected.source,name:basename(selected.file),base64:(await readFile(selected.file)).toString('base64'),...(api?{api}:{}),mapping:mapping.mapping??{},...(mapping.defaults?{defaults:mapping.defaults}:{}),...(mapping.references?{references:mapping.references}:{}),...(mapping.jira?{jira:mapping.jira}:{})};
  const preview=await request('preview',input);const file=await privateFile(selected.review);
  try{await file.writeFile(JSON.stringify({input:{...input,effectiveAt:preview.effectiveAt},preview})+'\n');await file.sync();}finally{await file.close();}
  console.log(JSON.stringify({ready:preview.ready,...(preview.jiraDates?{jiraDates:preview.jiraDates}:{}),rows:preview.count,batches:preview.measured.batches,errors:preview.errors.map(row=>({row:row.row,field:row.field,code:row.code})),omissions:preview.omissions.map(row=>({row:row.row,field:row.field,code:row.code})),review:selected.review}));return;
 }
 if(command==='report'){
  // The page as JSON on stdout; with --csv, the per-row mapping file written privately.
  if(!/^[a-f0-9-]{36}$/.test(selected.run??''))throw Error('run');
  console.log(JSON.stringify(await request('runs/'+selected.run+'/report')));
  if(selected.csv!==undefined){
   if(!isAbsolute(selected.csv))throw Error('paths');
   const response=await fetch(checked.origin+'/api/data/import/runs/'+selected.run+'/report.csv',{redirect:'error',headers:{Cookie:cookie,Origin:checked.origin}});
   if(!response.ok){await response.body?.cancel();throw Error('HTTP '+response.status);}
   const file=await privateFile(selected.csv);try{await file.writeFile(await response.text());await file.sync();}finally{await file.close();}
  }
  return;
 }
 let result;
 if(command==='apply'){
  if(!selected.yes)throw Error('confirmation');const review=await readPrivate(selected.review);if(!review.preview.ready)throw Error('review');
  result=await publish(await request('apply',{input:review.input,reviewedFingerprint:review.preview.fingerprint,operationKey:'review:'+review.preview.fingerprint,acknowledgeOmissions:true}));
 }else{
  if(!/^[a-f0-9-]{36}$/.test(selected.run??''))throw Error('run');
  // Without --yes, rollback only shows what it would remove and what blocks it.
  if(command==='rollback'&&!selected.yes){const preview=await request('runs/'+selected.run+'/rollback');console.log(JSON.stringify(preview));console.error(preview.conflicts.length?'Later work blocks this rollback; nothing was removed.':'Rerun with --yes to remove this whole run.');return;}
  result=await request('runs/'+selected.run+(command==='status'?'':'/'+command),command==='status'?undefined:command==='rollback'?{confirmed:true}:{});
  if(command==='resume'||command==='rollback')result=await publish(result);
 }
 console.log(JSON.stringify(summary(result)));
}
main().catch(error=>{
 const progress=last?.progress?` Stopped after ${last.progress.batchesApplied} of ${last.progress.batchesTotal} batches; run ${last.id} resumes from the next batch.`:'';
 console.error('Issue import refused or failed'+(/^HTTP \d+$/.test(error.message)?' ('+error.message+')':'')+'.'+progress+' Check the retained review/run and command options; no credential or private source data was printed.');process.exitCode=1;
});
