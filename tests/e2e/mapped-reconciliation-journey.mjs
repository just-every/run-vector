import assert from 'node:assert/strict';
import {expect} from '@playwright/test';
import {join} from 'node:path';

/** Nonempty source values in every dimension, including a missing person. */
export async function exerciseMappedReconciliation({page,runtime,native,terminalReport,directory,proof}) {
 const request=async(path,body)=>{
  const response=body===undefined?await page.request.get(runtime.base+path):await page.request.post(runtime.base+path,{headers:{Origin:runtime.base},data:body});
  assert(response.ok(),path+' '+response.status()+' '+await response.text());return response.json();
 };
 for(const name of ['Reconciliation alpha','Reconciliation beta'])await request('/api/settings/projects',{name,leadOperatorId:native.operator.id});
 const refs=(await request('/api/data/import/options')).references;
 const projects=['Reconciliation alpha','Reconciliation beta'].map(name=>refs.projects.find(row=>row.name===name));
 assert(projects.every(Boolean));
 const rows=Array.from({length:4},(_,index)=>({
  key:'synthetic-vector-'+(index+1),title:'Mapped reconciliation '+(index+1),
  team:index<2?'Source team alpha':'Source team beta',status:index<2?'Source ready':'Source backlog',
  project:index<2?'Source project alpha':'Source project beta',cycle:index<2?'Source cycle':'',
  assignee:index<2?'Source person':'Unknown source person',retained:'synthetic-vector-retained-'+index,
 }));
 const input={format:'json',source:'synthetic-vector-dimensions',name:'dimensions.json',base64:Buffer.from(JSON.stringify(rows)).toString('base64'),
  mapping:{sourceId:'key',title:'title',team:'team',status:'status',project:'project',cycle:'cycle',assignee:'assignee'},
  references:{team:{'Source team alpha':native.team.id,'Source team beta':native.otherTeam.id},
   status:{'Source ready':native.statuses.unstarted.id,'Source backlog':native.otherStatus.id},
   project:{'Source project alpha':projects[0].id,'Source project beta':projects[1].id},
   cycle:{'Source cycle':native.cycles[0].id},assignee:{'Source person':native.operator.id}},
 };
 const preview=await request('/api/data/import/preview',input);assert.equal(preview.ready,true,JSON.stringify(preview.errors));
 let run=await request('/api/data/import/apply',{input:{...input,effectiveAt:preview.effectiveAt},reviewedFingerprint:preview.fingerprint,operationKey:'synthetic-vector-dimensions',acknowledgeOmissions:true});
 while(run.progress.unfinished)run=await request('/api/data/import/runs/'+run.id+'/resume',{});
 const report=await request('/api/data/import/runs/'+run.id+'/report');
 assert.equal(report.run.state,'completed');assert.equal(report.totals.issuesWritten,4);
 assert.deepEqual(await terminalReport(run.id),report);
 await page.setViewportSize({width:1440,height:900});await page.goto(runtime.base+'/app/settings');
 await expect(page.getByLabel('File format',{exact:true})).toBeEnabled();
 const row=page.locator('.import-runs > li').filter({has:page.getByText(run.id,{exact:true})});
 const shown=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/data/import/runs/'+run.id+'/report');
 await row.getByRole('button',{name:'Reconciliation report',exact:true}).click();
 assert.equal((await shown).status(),200);
 const section=row.locator('.import-report');
 await section.getByRole('heading',{name:'Reconciliation report: synthetic-vector-dimensions',exact:true}).waitFor();
 const dimensions={
  team:[['Source team alpha',native.team.name],['Source team beta',native.otherTeam.name]],
  status:[['Source ready',native.statuses.unstarted.name],['Source backlog',native.otherStatus.name]],
  project:[['Source project alpha',projects[0].name],['Source project beta',projects[1].name]],
  cycle:[['Source cycle',native.cycles[0].name],['','(none)']],
  assignee:[['Source person',native.operator.name],['Unknown source person','(none)']],
 };
 const names={team:'Team',status:'Status',project:'Project',cycle:'Cycle',assignee:'Assignee'};
 for(const [field,groups] of Object.entries(dimensions)) {
  assert.deepEqual(report.dimensions[field].map(group=>({...group,vector:[...group.vector]})).sort((a,b)=>a.source.localeCompare(b.source)),
   groups.map(([source,name])=>({source,read:2,written:2,vector:[{name,count:2}]})).sort((a,b)=>a.source.localeCompare(b.source)));
  const table=section.getByRole('table',{name:names[field]+': read and written',exact:true});
  for(const [source,name] of groups) {
   const shown=table.locator('tbody > tr').filter({has:page.getByRole('cell',{name:source||'(empty)',exact:true})});
   assert.deepEqual(await shown.locator('td').allTextContents(),[source||'(empty)','2','2',name]);
  }
 }
 for(const width of proof.captureWidths){await page.setViewportSize({width,height:900});await section.scrollIntoViewIfNeeded();await page.screenshot({path:join(directory,'mapped-dimensions-'+width+'.png')});}
 proof.mappedDimensions={run:run.id,totals:report.totals,dimensions:report.dimensions};
}
