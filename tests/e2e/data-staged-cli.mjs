import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {writeFile,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {generateLinearWorkspace} from '../fixtures/import/linear/generate.mjs';

// DATA-006 through the terminal command: a generated 2,000-issue Linear file is
// previewed once, applied until the process is stopped after batch 3, then the
// same run resumes to completion; replay adds nothing and a changed file conflicts.
export async function exerciseStagedCli({runtime,cookie,scratch,command,session}){
 const api=async(path,method='GET',body)=>{const response=await runtime.req(path,{method,headers:{Cookie:cookie,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});assert.equal(response.status,200,method+' '+path);return response.json();};
 for(const [name,identifierPrefix] of [['Engineering','ENG'],['Operations','OPS']])await api('/api/settings/teams','POST',{name,identifierPrefix});
 const state=await api('/api/settings/administration'),teams=state.teams.filter(team=>['Engineering','Operations'].includes(team.name));
 const owner=(await api('/api/data/import/options')).references.operators.find(row=>!row.removed_at);
 const generated=generateLinearWorkspace({issues:2000,teams:[{key:'ENG',name:'Engineering',cycles:[]},{key:'OPS',name:'Operations',cycles:[]}],people:[owner.name],strangers:['Former Teammate']});
 const file=join(scratch,'linear-2000.csv'),changedFile=join(scratch,'linear-2000-changed.csv'),mapping=join(scratch,'linear-mapping.json'),review=join(scratch,'linear-review.json'),changedReview=join(scratch,'linear-changed-review.json');
 await writeFile(file,generated.csv,{mode:0o600});
 await writeFile(changedFile,generated.csv.replace(generated.rows[0].Title,'Changed after export'),{mode:0o600});
 await writeFile(mapping,JSON.stringify({mapping:{},references:{status:Object.fromEntries(teams.flatMap(team=>[['Todo','unstarted'],['In Progress','started'],['In Review','started'],['Done','completed']].map(([name,category])=>[team.name+'/'+name,team.statuses.find(status=>status.category===category).id])))}}),{mode:0o600});
 const imported=()=>runtime.sql("SELECT count(*) AS n FROM issues WHERE identifier LIKE 'ENG-%' OR identifier LIKE 'OPS-%'")[0].n;
 const preview=command('preview','--file',file,'--format','linear-csv','--source','linear-cli','--mapping',mapping,'--review',review);
 assert.equal(preview.ready,true);assert.equal(preview.rows,2000);assert(preview.batches>3);
 // Stop the applying process after its third batch, as a person pressing Ctrl-C would.
 const stopped=await new Promise((resolve,reject)=>{
  const child=spawn(process.execPath,['scripts/data/import-issues.mjs','apply','--origin',runtime.base,'--session-file',session,'--review',review,'--yes'],{stdio:['ignore','pipe','pipe']});
  let progress='';child.stderr.on('data',chunk=>{progress+=chunk;if(/applied 3 of/.test(progress))child.kill('SIGTERM');});
  child.on('error',reject);child.on('exit',(code,signal)=>resolve({code,signal,progress}));
 });
 assert.equal(stopped.signal,'SIGTERM','the apply process was stopped mid-run');
 const runs=await api('/api/data/import/runs'),retained=runs.runs.find(row=>row.namespace==='vector-import:linear-cli');
 const partial=command('status','--run',retained.id);
 assert.equal(partial.state,'applying');assert(partial.batchesApplied>=3&&partial.batchesApplied<partial.batchesTotal);assert.equal(partial.batchesTotal,preview.batches);
 assert.equal(imported(),partial.checkpoint,'exactly the published batches are visible');
 const finished=command('resume','--run',retained.id);
 assert.deepEqual([finished.state,finished.checkpoint,finished.batchesApplied,finished.batchesTotal],['completed',2000,preview.batches,preview.batches]);
 assert.equal(imported(),2000,'each issue landed exactly once');
 assert.deepEqual(command('apply','--review',review,'--yes'),finished,'a second apply of the same run returns its result');
 assert.equal(imported(),2000);
 // A changed file under the same run identity: reported at preview and refused at apply.
 const changed=command('preview','--file',changedFile,'--format','linear-csv','--source','linear-cli','--mapping',mapping,'--review',changedReview);
 assert.equal(changed.ready,false);assert(changed.errors.some(row=>row.code==='source_content_conflict'));
 const resubmitted=JSON.parse(await readFile(review,'utf8'));resubmitted.input.base64=(await readFile(changedFile)).toString('base64');
 await writeFile(changedReview,JSON.stringify(resubmitted),{mode:0o600});
 assert.throws(()=>command('apply','--review',changedReview,'--yes'),/HTTP 409/);
 assert.equal(imported(),2000);
 return {batches:preview.batches,stoppedAfter:partial.batchesApplied,resumedTo:finished.batchesApplied};
}

/** DATA-015: the Plane fixture uses the ordinary staged terminal door. */
export async function exerciseProfileCli({runtime,scratch,command,team,status}) {
 const file=join(scratch,'plane.csv'),mapping=join(scratch,'plane-mapping.json'),review=join(scratch,'plane-review.json');
 await writeFile(file,await readFile(new URL('../fixtures/import/plane.csv',import.meta.url)),{mode:0o600});
 await writeFile(mapping,JSON.stringify({mapping:{},defaults:{team:team.id},references:{status:{Ready:status.id}}}),{mode:0o600});
 const preview=command('preview','--file',file,'--format','plane-csv','--source','plane-cli','--mapping',mapping,'--review',review);
 assert.equal(preview.ready,true);assert.equal(preview.rows,2);assert.equal(preview.omissions.length,1);
 const run=command('apply','--review',review,'--yes');assert.equal(run.state,'completed');assert.equal(run.checkpoint,2);
 const report=command('report','--run',run.id);
 assert.equal(report.totals.issuesWritten,2);assert.equal(report.totals.omittedValues,1);
 assert.deepEqual(report.mapping.map(row=>row.sourceId).sort(),['ENG-42','ENG-43']);
 assert.equal(report.effects.counts.parents.written,1);
 assert.equal(command('rollback','--run',run.id,'--yes').state,'rolled_back');
 assert.equal(command('report','--run',run.id).totals.issuesWritten,0);
 console.log('[DATA-015] Plane CLI preview/apply/reconciliation/rollback passed.');
}
