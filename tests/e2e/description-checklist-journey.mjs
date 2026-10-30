import assert from 'node:assert/strict';
import {beforePrivateNavigation,settleReads} from './collaboration-navigation.mjs';
import {openBoard,readyBoard} from './core-board-support.mjs';

/** The original checklist creation, attribution and visible progress flow. */
export async function descriptionChecklistJourney(page,context,base,teamId,evidence,record){
 const go=async path=>{await beforePrivateNavigation(page,base+path);await page.goto(base+path);};
 const reload=async()=>{await beforePrivateNavigation(page,page.url());await page.reload();};
 await page.setViewportSize({width:1440,height:1000});
 await go('/app/new-issue');
 const title='synthetic-vector-2514';
 await page.getByRole('textbox',{name:/^Title/}).fill(title);
 await page.getByLabel(/^Team/).selectOption(teamId);
 const editor=page.getByRole('textbox',{name:'Description',exact:true});
 await editor.fill('');
 await editor.pressSequentially('[] Review draft\n- [ ] Publish notes\n- [ ] Archive notes');
 const created=page.waitForResponse(response=>response.url()===base+'/api/issues'&&response.request().method()==='POST');
 await page.getByRole('button',{name:'Create issue',exact:true}).first().click();
 const response=await created;assert.equal(response.status(),201);
 const issue=await response.json(),path='/api/issues/'+issue.identifier;
 await page.waitForURL(base+'/app/issues/'+issue.identifier);
 await reload();
 const content=page.locator('.issue-description');
 await content.getByRole('checkbox',{name:'Review draft',exact:true}).waitFor();
 assert.equal(await content.getByRole('checkbox').count(),3);
 const before=await (await context.request.get(base+path+'/description-history')).json();
 assert.equal(before.revisions.length,1);
 const tick=page.waitForResponse(r=>r.url()===base+path+'/checklist'&&r.request().method()==='POST');
 await content.getByRole('checkbox',{name:'Review draft',exact:true}).check();
 assert.equal((await tick).status(),200);await settleReads(page);await reload();
 await content.getByRole('checkbox',{name:'Review draft',exact:true}).waitFor();
 assert.equal(await content.getByRole('checkbox',{name:'Review draft',exact:true}).isChecked(),true);
 const current=await (await context.request.get(base+path)).json();
 assert.equal(current.description,'- [x] Review draft\n- [ ] Publish notes\n- [ ] Archive notes');
 assert.equal(current.status.id,issue.status.id);
 assert.deepEqual(current.checklist,{completed:1,total:3});
 const history=await (await context.request.get(base+path+'/description-history')).json();
 assert.equal(history.revisions.length,2);
 assert.equal(history.revisions[1].description,current.description);
 const metadata=await (await context.request.get(base+'/api/metadata')).json();
 const actor=metadata.operators.find(row=>row.id===metadata.viewer.id);
 assert.equal(history.revisions[1].actor,actor.name);
 const activity=current.activity.filter(row=>row.nextValue.checklist);
 assert.equal(activity.length,1);assert.equal(activity[0].actor,actor.name);
 assert.deepEqual(activity[0].nextValue.checklist,{index:0,text:'Review draft',checked:true});
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:width===390?844:1000});
  await content.scrollIntoViewIfNeeded();
  await page.screenshot({path:`${evidence}/description-checklist-${width}.png`});
 }
 await page.setViewportSize({width:1440,height:1000});
 await go('/app/issues?'+new URLSearchParams({q:title,team:teamId}));
 const row=page.locator('#issue-row-'+issue.identifier);
 await row.waitFor();assert.equal(await row.getByLabel('Checklist progress',{exact:true}).innerText(),'1/3');
 await openBoard(page,base,{team:teamId,q:title});await readyBoard(page,{team:teamId,q:title});
 assert.equal(await page.locator('#issue-row-'+issue.identifier).getByLabel('Checklist progress',{exact:true}).innerText(),'1/3');
 record('ISSUE-025','A new issue starts its three-item description with brackets, saves and reloads; one in-place tick persists one attributed GFM revision and one item activity, keeps status, and shows one of three in the API, list and board. Screens at 1440 and 390.');
}
