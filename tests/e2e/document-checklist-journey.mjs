import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {beforePrivateNavigation,settleReads} from './collaboration-navigation.mjs';
import {readDevelopmentLink} from './outbox-session.mjs';

/** Two real author sessions tick document tasks without opening the editor. */
export async function documentChecklistJourney({page,base,api,state,output}){
 await mkdir(output,{recursive:true});
 await page.setViewportSize({width:1440,height:1000});
 const context=page.context(),metadata=await api('/metadata'),teamId=metadata.teams[0].id;
 const issue=await api('/issues','POST',{title:'synthetic-vector-2510',teamId});
 const body='- [ ] Release\n  - [ ] Verify';
 const document=await api('/documents','POST',{parentKind:'issue',parentId:issue.id,title:'synthetic-vector-2511',body});
 const path='/documents/'+document.id,url=base+'/app'+path;
 const actor=(await (await context.request.get(base+'/auth/session')).json()).operator;
 const peerContext=await context.browser().newContext({viewport:{width:1440,height:1000}}),peer=await peerContext.newPage();
 const open=async target=>{await target.bringToFront();await beforePrivateNavigation(target,url);await target.goto(url);await target.getByRole('heading',{name:document.title,exact:true}).waitFor();await target.getByRole('region',{name:'Document content',exact:true}).getByRole('checkbox').first().waitFor();await settleReads(target);};
 const content=target=>target.getByRole('region',{name:'Document content',exact:true});
 try{
  const sent=await peerContext.request.post(base+'/auth/request',{headers:{Origin:base},data:{email:actor.email}});assert.equal(sent.status(),202);
  await peer.goto(await readDevelopmentLink(base,peerContext.request,actor.email,state));
  await peer.getByRole('button',{name:'Confirm',exact:true}).click();await peer.waitForURL(base+'/app');
  const first=await (await context.request.get(base+'/auth/session')).json(),second=await (await peerContext.request.get(base+'/auth/session')).json();
  assert.equal(second.operator.id,first.operator.id);assert.notEqual(second.id,first.id);
  await open(page);await open(peer);
  for(const [target,index] of [[page,1],[peer,0]]){
   const pending=target.waitForResponse(response=>response.url()===base+'/api'+path+'/checklist'&&response.request().method()==='POST');
   await content(target).getByRole('checkbox').nth(index).check();
   const response=await pending;assert.equal(response.status(),200);assert.equal(response.request().postDataJSON().expectedVersion,1);
   await settleReads(target);
  }
  await open(page);
  assert.equal(await content(page).getByRole('checkbox').nth(0).isChecked(),true);
  assert.equal(await content(page).getByRole('checkbox').nth(1).isChecked(),true);
  const current=await api(path);assert.equal(current.body,'- [x] Release\n  - [x] Verify');assert.equal(current.version,3);
  const history=await api(path+'/revisions');assert.deepEqual(history.revisions.map(r=>r.body),[body,'- [ ] Release\n  - [x] Verify',current.body]);
  assert.deepEqual(history.revisions.slice(1).map(r=>[r.authorName,r.checklist.index,r.checklist.checked]),[[metadata.operators.find(o=>o.id===metadata.viewer.id).name,1,true],[metadata.operators.find(o=>o.id===metadata.viewer.id).name,0,true]]);
  const revisions=page.locator('details').filter({has:page.locator('summary').filter({hasText:'Revision history'})});
  await revisions.locator('summary').click();await revisions.getByRole('heading',{name:'Revision 3',exact:true}).waitFor();
  assert.ok((await revisions.innerText()).includes('checked “Verify”'));
  assert.equal((await api('/issues/'+issue.identifier)).status.id,issue.status.id);
  for(const width of [1440,390]){
   await page.setViewportSize({width,height:width===390?844:1000});
   await page.screenshot({path:output+'/document-checklist-'+width+'.png',fullPage:true});
  }
  await page.setViewportSize({width:1440,height:1000});
  await content(page).getByRole('checkbox').nth(1).uncheck();await settleReads(page);
  assert.equal((await api(path)).body,'- [x] Release\n  - [ ] Verify');
  // A stale target edit is refused by the same door with the current text.
  const latest=await api(path);await api(path,'PATCH',{expectedVersion:latest.version,body:'- [x] Release\n  - [ ] Review'});
  const conflict=await peerContext.request.post(base+'/api'+path+'/checklist',{headers:{Origin:base},data:{expectedVersion:1,index:1,text:'Verify',checked:true}});
  assert.equal(conflict.status(),409);assert.equal((await conflict.json()).document.body,'- [x] Release\n  - [ ] Review');
  console.log('[ISSUE-025] document tasks: independent stale sessions, nested ticks, untick, attributed revisions, item activity, current-text conflict and unchanged issue status PASS; screens 1440 and 390');
 }finally{await peerContext.close();}
}

/** Existing project templates share native checklist authoring and Markdown. */
export async function templateChecklistJourney({page,base,api,output}){
 const metadata=await api('/metadata'),teamId=metadata.teams[0].id;
 const template=await api('/project-templates','POST',{name:'synthetic-vector-2520-'+Date.now(),description:'',milestones:[{name:'synthetic-vector-2521',offsetDays:null}],issues:[{title:'synthetic-vector-2522',offsetDays:null,milestonePosition:0}]});
 await page.setViewportSize({width:1440,height:1000});await page.bringToFront();
 await beforePrivateNavigation(page,base+'/app/projects');await page.goto(base+'/app/projects');
 await page.getByRole('button',{name:'New project from template',exact:true}).click();
 await page.locator('[data-project-templates-ready="true"]').waitFor();
 await page.getByLabel('Choose project template',{exact:true}).selectOption(template.id);
 await page.getByRole('button',{name:'Edit project template',exact:true}).click();
 const editor=page.getByRole('form',{name:'Edit project template',exact:true});
 const description=editor.getByLabel('Template description',{exact:true});
 await description.pressSequentially('[] Prepare');assert.equal(await description.inputValue(),'- [ ] Prepare');
 const milestone=editor.getByLabel('Milestone description',{exact:true});
 await milestone.fill('Review');await milestone.press('ControlOrMeta+Shift+7');assert.equal(await milestone.inputValue(),'- [ ] Review');
 const issue=editor.getByLabel('Issue Markdown description',{exact:true});
 await issue.pressSequentially('/checklist');await page.getByRole('option',{name:'Checklist',exact:true}).click();
 await issue.pressSequentially('Verify');assert.equal(await issue.inputValue(),'- [ ] Verify');
 // The inherited toolbar gives each compact control its keyboard tooltip.
 const bold=editor.getByRole('button',{name:'Bold text',exact:true}).first();await bold.focus();
 await page.getByRole('tooltip',{name:'Bold text',exact:true}).waitFor();
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:width===390?844:1000});await editor.scrollIntoViewIfNeeded();
  await page.screenshot({path:output+'/template-checklist-editor-'+width+'.png',fullPage:true});
 }
 await page.setViewportSize({width:1440,height:1000});
 await editor.getByRole('button',{name:'Save template changes',exact:true}).click();
 await editor.waitFor({state:'hidden'});
 const current=await api('/project-templates/'+template.id);
 assert.equal(current.description,'- [ ] Prepare');assert.equal(current.milestones[0].description,'- [ ] Review');assert.equal(current.issues[0].description,'- [ ] Verify');
 await page.getByText('Preview project structure',{exact:true}).click();
 const preview=page.locator('details').filter({has:page.locator('summary').filter({hasText:'Preview project structure'})});
 assert.equal(await preview.getByRole('checkbox',{name:'Prepare',exact:true}).isDisabled(),true);
 assert.equal(await preview.getByRole('checkbox',{name:'Verify',exact:true}).isDisabled(),true);
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:width===390?844:1000});await preview.scrollIntoViewIfNeeded();
  await page.screenshot({path:output+'/template-checklist-preview-'+width+'.png',fullPage:true});
 }
 await page.setViewportSize({width:1440,height:1000});
 const applied=await api('/project-templates/'+template.id+'/apply','POST',{name:'synthetic-vector-2523',teamId,startDate:'2027-03-01',expectedVersion:current.version});
 assert.equal((await api('/projects/'+applied.projectId)).description,current.description);
 const created=(await api('/issues?project='+applied.projectId)).issues.find(row=>row.title==='synthetic-vector-2522');assert.ok(created);
 const detail=await api('/issues/'+created.identifier);assert.equal(detail.description,'- [ ] Verify');assert.deepEqual(detail.checklist,{completed:0,total:1});
 console.log('[ISSUE-025] project template checklist shortcuts, slash command, Markdown preservation, read-only previews and created issue progress PASS; screens 1440 and 390');
}
