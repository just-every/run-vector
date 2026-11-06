import {readFile} from 'node:fs/promises';
import {expectedUndoConflicts} from './core-undo-properties.mjs';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
/** Native project recovery using the rendered controls and real retained data. */
export async function projectDeletionJourney({page,base,api,navigate,capture,team,memberId,memberContext}) {
 const axeSource=await readFile(createRequire(import.meta.url).resolve('axe-core/axe.min.js'),'utf8');
 async function audit(region){
  await page.evaluate(source=>{const script=document.createElement('script');const nonce=document.querySelector('script[nonce]')?.nonce;if(nonce)script.nonce=nonce;script.textContent=source;document.head.append(script);},axeSource);
  const violations=await region.evaluate(async element=>(await window.axe.run(element)).violations.filter(v=>['serious','critical'].includes(v.impact)).map(v=>v.id));
  assert.deepEqual(violations,[]);
 }
 const suffix=Date.now(),name='synthetic-vector-9700-'+suffix;
 const project=(await api('/settings/projects','POST',{name,description:'synthetic-vector-9701',leadOperatorId:memberId})).projects.find(p=>p.name===name);
 const destination=(await api('/settings/projects','POST',{name:'synthetic-vector-9702-'+suffix,leadOperatorId:memberId})).projects.find(p=>p.name==='synthetic-vector-9702-'+suffix);
 const detail=await api('/settings/projects/'+project.id+'/milestones','POST',{name:'synthetic-vector-9703',description:'synthetic-vector-9704'});
 const milestone=detail.milestones.find(m=>m.name==='synthetic-vector-9703');
 const first=await api('/issues','POST',{title:'synthetic-vector-9705',description:'synthetic-vector-9706',teamId:team.id,projectId:project.id,milestoneId:milestone.id});
 const second=await api('/issues','POST',{title:'synthetic-vector-9707',description:'synthetic-vector-9708',teamId:team.id,projectId:project.id,milestoneId:milestone.id});
 const cleared=await api('/issues','POST',{title:'synthetic-vector-9711',teamId:team.id,projectId:project.id,milestoneId:milestone.id});
 const explicitlyCleared=await api('/issues','POST',{title:'synthetic-vector-9712',teamId:team.id,projectId:project.id,milestoneId:milestone.id});
 const doc=await api('/documents','POST',{parentKind:'project',parentId:project.id,title:'synthetic-vector-9709',body:'synthetic-vector-9710'});
 const screens=async(label)=>{for(const width of [1440,390]){await page.setViewportSize({width,height:1000});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await capture('PROJ-017',label+'-'+width,page);}await page.setViewportSize({width:1440,height:1000});};
 async function remove(){
  await navigate('/app/projects/'+project.id);
  await page.getByText('Manage '+name,{exact:true}).click();
  await page.getByRole('button',{name:'Delete project',exact:true}).click();
  const pending=page.waitForResponse(r=>r.request().method()==='DELETE'&&new URL(r.url()).pathname==='/api/settings/projects/'+project.id);
  await page.getByRole('button',{name:'Delete project and keep issues',exact:true}).click();
  const response=await pending;assert.equal(response.status(),200);
  const receipt=JSON.parse(response.headers()['x-vector-project-undo']);
  await page.waitForURL(base+'/app/projects');
  return receipt;
 }
 await page.setViewportSize({width:1440,height:1000});
 let receipt=await remove();
 const notice=page.getByRole('region',{name:'Project deletion Undo',exact:true});
 await notice.getByRole('button',{name:'Undo project deletion',exact:true}).waitFor();
 assert.equal((await api('/issues/'+first.identifier)).project,null);
 await audit(notice);
 await screens('project-retained-deletion');
 await notice.getByRole('button',{name:'Undo project deletion',exact:true}).focus();
 await page.keyboard.press('Enter');
 await page.waitForURL(base+'/app/projects/'+project.id);
 await page.getByRole('heading',{name,exact:true}).waitFor();
 assert.equal((await api('/issues/'+first.identifier)).milestone.id,milestone.id);
 assert.equal((await api('/projects/'+project.id)).activity.filter(a=>a.kind==='project.restored').length,1);
 await screens('project-restored-undo');
 receipt=await remove();
 const current=await api('/issues/'+first.identifier);
 await api('/issues/'+first.identifier,'PATCH',{expectedVersion:current.version,projectId:destination.id});
 const reassigned=await api('/issues/'+cleared.identifier,'PATCH',{expectedVersion:(await api('/issues/'+cleared.identifier)).version,projectId:destination.id});
 await api('/issues/'+cleared.identifier,'PATCH',{expectedVersion:reassigned.version,projectId:null});
 await api('/issues/'+explicitlyCleared.identifier,'PATCH',{expectedVersion:(await api('/issues/'+explicitlyCleared.identifier)).version,projectId:null});
 const recoveryState=async()=>({recent:await api('/projects/recently-deleted'),issues:await Promise.all([first,second,cleared,explicitlyCleared].map(issue=>api('/issues/'+issue.identifier)))});
 const beforeRefusal=await recoveryState();
 const undoUrl=base+'/api/projects/undo-deletion';
 expectedUndoConflicts.add(undoUrl);
 try {
  const pending=page.waitForResponse(r=>r.request().method()==='POST'&&r.url()===undoUrl);
  await notice.getByRole('button',{name:'Undo project deletion',exact:true}).click();
  assert.equal((await pending).status(),409);
  await notice.getByRole('alert').getByText('Nothing changed.',{exact:false}).waitFor();
  assert.deepEqual(await recoveryState(),beforeRefusal,'stale Undo changes no visible issue, history or recovery entry');
  await screens('project-stale-undo-refused');
 } finally { expectedUndoConflicts.delete(undoUrl); }
 assert.equal((await api('/projects/recently-deleted')).projects.find(p=>p.id===receipt.id).projectId,project.id);
 for(const [method,path,data] of [['get','/projects/recently-deleted'],['post','/projects/restore',{id:receipt.id,version:1}]]){
  const refused=await memberContext.request[method](base+'/api'+path,{headers:{Origin:base},...(data?{data}:{})});assert.equal(refused.status(),403);
 }
 await navigate('/app/settings/workspace');
 await page.reload();
 const recent=page.getByRole('region',{name:'Recently deleted projects',exact:true});
 await recent.getByRole('button',{name:'Restore '+name,exact:true}).waitFor();
 assert.ok((await recent.innerText()).includes('Deleted by'));
 await audit(recent);
 await screens('project-recently-deleted-after-reload');
 await recent.getByRole('button',{name:'Restore '+name,exact:true}).click();
 await page.waitForURL(base+'/app/projects/'+project.id);
 await page.getByRole('heading',{name,exact:true}).waitFor();
 assert.equal((await api('/issues/'+first.identifier)).project.id,destination.id);
 for(const issue of [cleared,explicitlyCleared]){
  const current=await api('/issues/'+issue.identifier);assert.equal(current.id,issue.id);assert.equal(current.project,null);assert.equal(current.milestone,null);
 }
 assert.equal((await api('/issues/'+second.identifier)).project.id,project.id);
 assert.equal((await api('/issues/'+second.identifier)).milestone.id,milestone.id);
 const recoveredMilestones=(await api('/projects/'+project.id)).milestones;
 assert.deepEqual(recoveredMilestones.map(({progress,...fields})=>fields),detail.milestones.map(({progress,...fields})=>fields));
 assert.equal(recoveredMilestones[0].progress.total,1);
 assert.equal((await api('/projects/'+project.id)).activity.filter(a=>a.kind==='project.restored').length,2);
 const retained=await api('/documents/'+doc.id);assert.equal(retained.body,doc.body);assert.equal(retained.id,doc.id);
 await page.reload();await page.getByRole('heading',{name,exact:true}).waitFor();
 await page.getByRole('region',{name:'Documents',exact:true}).getByRole('link',{name:doc.title,exact:true}).waitFor();
 await screens('project-restored-membership');
 await navigate('/app/documents/'+doc.id);
 await page.getByRole('heading',{name:doc.title,exact:true}).waitFor();
 await page.getByText(doc.body,{exact:true}).filter({visible:true}).first().waitFor();
 await screens('project-retained-document');
 console.log('PROBE PROJ-017 reassignment: native deletion, later issue assignment and Settings recovery -> newer project preserved; untouched issue, milestone and document restored with original identities');
 console.log('PROBE PROJ-017 stale Undo: changed membership -> rendered refusal and HTTP 409 with unchanged issue content, activity and recovery entries');
 console.log('PROBE PROJ-017 explicit clearing: reassign then clear, and explicit later clear -> both issues remain unassigned after restore');
}
