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
