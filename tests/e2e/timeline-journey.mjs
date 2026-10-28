import assert from 'node:assert/strict';
import {withOperatorClient} from './operator-request.mjs';
import {beforePrivateNavigation} from './collaboration-navigation.mjs';

export async function timelineJourney(page,context,runtime,output){
 const base=runtime.base;
 const call=(path,method='GET',data,expected,token)=>withOperatorClient(context,async client=>{
  const response=await client.fetch(base+'/api'+path,{method,headers:{Origin:base,...(token?{Authorization:'Bearer '+token}:{})},...(data===undefined?{}:{data})});
  if(expected)assert.equal(response.status(),expected,method+' '+path);else assert.ok(response.ok(),method+' '+path+' '+response.status());
  return response.json();
 });
 const teams=await call('/settings/teams','POST',{name:'Delivery planning',identifierPrefix:'SYNDATE'}),team=teams.teams.find(row=>row.identifierPrefix==='SYNDATE');
 const interval=await call('/issues','POST',{teamId:team.id,title:'Prepare rollout',dueDate:'2026-11-12'});
 const dueOnly=await call('/issues','POST',{teamId:team.id,title:'Launch checkpoint',dueDate:'2026-11-15'});
 const startOnly=await call('/issues','POST',{teamId:team.id,title:'Discovery in progress',startDate:'2026-10-15'});
 const neither=await call('/issues','POST',{teamId:team.id,title:'Next milestone exploration'});
 const read=id=>call('/issues/'+id);
 const go=async path=>{await beforePrivateNavigation(page,base+path);await page.goto(base+path);};
 const dismiss=async()=>{const button=page.getByRole('button',{name:'Dismiss Undo notice',exact:true});if(await button.isVisible())await button.click();};
 const timeline=page.getByRole('region',{name:'Issue timeline',exact:true});
 const ready=()=>page.locator('[data-timeline-ready="true"]').waitFor();
 // Native editor, activity and rejected interval through the same public door
 // a member uses. Repeat the editor at the phone width for visual proof.
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:width===390?844:1000});await go('/app/new-issue');
  await page.getByLabel(/Title.*Required/).fill('Plan release verification '+width);await page.getByLabel(/Team.*Required/).selectOption(team.id);
  await page.getByText('Optional context',{exact:true}).click();await page.getByLabel('Start date',{exact:true}).fill('2026-11-02');await page.getByLabel('Due date',{exact:true}).fill('2026-11-09');
  await page.screenshot({path:output+'/start-create-'+width+'.png',fullPage:true});
  const created=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/issues'&&r.request().method()==='POST');await page.getByRole('button',{name:'Create issue',exact:true}).click();const createResponse=await created;assert.equal(createResponse.status(),201);assert.equal((await createResponse.json()).startDate,'2026-11-02');
  await go('/app/issues/'+interval.identifier);
  await page.getByRole('button',{name:'Edit start date',exact:true}).click();
  const form=page.getByRole('form',{name:'Edit start date',exact:true});
  await form.getByLabel('Issue start date',{exact:true}).fill(width===1440?'2026-11-04':'2026-11-05');
  const before=await read(interval.identifier),saved=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/issues/'+interval.identifier&&r.request().method()==='PATCH');
  await form.getByRole('button',{name:'Save start date',exact:true}).click();assert.equal((await saved).status(),200);
  await form.waitFor({state:'detached'});const after=await read(interval.identifier);
  assert.equal(after.startDate,width===1440?'2026-11-04':'2026-11-05');assert.equal(after.activity.length,before.activity.length+1);
  assert.equal(after.activity.filter(entry=>entry.nextValue?.startDate===after.startDate).length,1);
  await page.getByRole('button',{name:'Edit start date',exact:true}).click();await form.getByLabel('Issue start date',{exact:true}).fill('2026-11-13');
  const refused=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/issues/'+interval.identifier&&r.request().method()==='PATCH');
  await form.getByRole('button',{name:'Save start date',exact:true}).click();assert.equal((await refused).status(),400);await form.getByRole('alert').waitFor();
  const unchanged=await read(interval.identifier);assert.equal(unchanged.version,after.version);assert.equal(unchanged.activity.length,after.activity.length);assert.equal(unchanged.startDate,after.startDate);
  await page.screenshot({path:output+'/start-editor-'+width+'.png',fullPage:true});await dismiss();
 }
 const token=await call('/settings/integrations/tokens','POST',{name:'synthetic-vector-220',scopes:['issues:read','issues:write']},201);
 let before=await read(interval.identifier);
 const updated=await call('/v1/issues/'+interval.identifier,'PATCH',{expectedVersion:before.version,startDate:'2026-11-06'},200,token.token);
 assert.equal(updated.startDate,'2026-11-06');assert.equal(updated.activity.length,before.activity.length+1);
 await call('/v1/issues/'+interval.identifier,'PATCH',{expectedVersion:updated.version,startDate:'2026-11-20'},400,token.token);
 assert.equal((await read(interval.identifier)).version,updated.version);
 await call('/settings/integrations/tokens/'+token.credential.id,'DELETE');
 await call('/v1/issues/'+interval.identifier,'PATCH',{expectedVersion:updated.version,startDate:null},401,token.token);
 assert.equal((await read(interval.identifier)).startDate,'2026-11-06');
 const a=await read(interval.identifier),b=await read(dueOnly.identifier);
 await call('/issues/'+a.identifier+'/dependencies','POST',{expectedVersion:a.version,relatedIdentifier:b.identifier,relatedVersion:b.version,direction:'blocks'});
 // The server supplies the workspace day; selecting its week exercises the
 // actual week filter without asserting a wall-clock day in test fixtures.
 const current=await call('/calendar/timeline'),today=new Date(current.today+'T12:00:00Z');
 const monday=new Date(today);monday.setUTCDate(today.getUTCDate()-(today.getUTCDay()+6)%7);
 const weekStart=monday.toISOString().slice(0,10);
 const weekly=await call('/issues','POST',{teamId:team.id,title:'This week planning',startDate:weekStart});
 await go('/app/issues?team='+team.id+'&start=this_week');
 await page.locator('[data-list-state="ready"]').waitFor();await page.locator('[data-issue-identifier="'+weekly.identifier+'"]').waitFor();
 const sunday=new Date(monday);sunday.setUTCDate(monday.getUTCDate()+6);const weekEnd=sunday.toISOString().slice(0,10);
 for(const issue of [await read(interval.identifier),await read(startOnly.identifier)]){const expected=issue.startDate>=weekStart&&issue.startDate<=weekEnd;if(expected)await page.locator('[data-issue-identifier="'+issue.identifier+'"]').waitFor();else assert.equal(await page.locator('[data-issue-identifier="'+issue.identifier+'"]').count(),0);}
 await page.screenshot({path:output+'/starts-this-week-390.png',fullPage:true});
 // List and board retain the field, including their shared bulk command.
 await go('/app/issues?team='+team.id);await page.locator('[data-list-state="ready"]').waitFor();
 await page.getByLabel('Select '+neither.identifier,{exact:true}).check();
 const bulk=page.getByRole('region',{name:'Bulk edit',exact:true});await bulk.getByLabel('Change',{exact:true}).selectOption('startDate');await bulk.getByRole('button',{name:'Edit selected',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'Change start date',exact:true});await dialog.getByLabel('Start date',{exact:true}).fill('2026-11-08');await dialog.getByRole('button',{name:'Apply changes',exact:true}).click();await dialog.waitFor({state:'detached'});
 assert.equal((await read(neither.identifier)).startDate,'2026-11-08');
 const scheduled=await read(neither.identifier);await call('/issues/'+neither.identifier,'PATCH',{expectedVersion:scheduled.version,startDate:null});
 for(const width of [1440,390]){await page.setViewportSize({width,height:width===390?844:1000});await go('/app/board?team='+team.id);await page.locator('[data-list-state="ready"]').waitFor();assert.match(await page.locator('.board-card').filter({hasText:interval.identifier}).textContent(),/2026-11-06/);await page.screenshot({path:output+'/start-board-'+width+'.png',fullPage:true});}
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:width===390?844:1000});await go('/app/issues?team='+team.id);await page.locator('[data-list-state="ready"]').waitFor();
  await page.getByRole('button',{name:'Timeline',exact:true}).click();await ready();
  const row=id=>timeline.locator('[data-timeline-issue="'+id+'"]');
  await row(interval.identifier).waitFor();assert.equal(await row(interval.identifier).getAttribute('data-date-kind'),'interval');assert.equal(await row(interval.identifier).getAttribute('data-start-date'),'2026-11-06');assert.equal(await row(interval.identifier).getAttribute('data-due-date'),'2026-11-12');
  assert.equal(await row(dueOnly.identifier).getAttribute('data-date-kind'),'diamond');assert.equal(await row(dueOnly.identifier).locator('.timeline-diamond').textContent(),'◆');
  assert.equal(await row(startOnly.identifier).getAttribute('data-date-kind'),'open');assert.match(await row(startOnly.identifier).locator('.timeline-bar').getAttribute('aria-label'),/open to today/);
  assert.match(await timeline.getByRole('complementary',{name:'Unscheduled issues',exact:true}).textContent(),new RegExp(neither.identifier));
  const line=timeline.locator('[data-dependency-from="'+interval.identifier+'"][data-dependency-to="'+dueOnly.identifier+'"]');assert.equal(await line.count(),1);assert.match(await line.getAttribute('d'),/^M .+ C /);
  const startButton=row(interval.identifier).getByRole('button',{name:'Drag start date for '+interval.identifier,exact:true});
  await startButton.focus();await page.getByRole('tooltip',{name:'Drag start date',exact:true}).waitFor();await page.keyboard.press('Tab');
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await timeline.scrollIntoViewIfNeeded();await page.screenshot({path:output+'/timeline-'+width+'.png',fullPage:true});
  // Drag each endpoint using the date-axis coordinate, then use Undo and the
  // keyboard editor. Every save is read back with its own activity delta.
  const initial=await call('/calendar/timeline?team='+team.id),dates=[initial.today,...initial.issues.flatMap(issue=>[issue.startDate,issue.dueDate].filter(Boolean))].map(date=>Date.parse(date+'T12:00:00Z')/86400000),first=Math.min(...dates)-3,last=Math.max(...dates)+3;
  async function dragDate(field,next){
   const handle=row(interval.identifier).getByRole('button',{name:'Drag '+field+' date for '+interval.identifier,exact:true});await handle.scrollIntoViewIfNeeded();const from=await handle.boundingBox();assert(from);
   const track=row(interval.identifier).locator('.timeline-track'),fraction=(Date.parse(next+'T12:00:00Z')/86400000-first)/(last-first);
   await page.mouse.move(from.x+from.width/2,from.y+from.height/2);await page.mouse.down();await page.mouse.move(from.x+from.width/2+12,from.y+from.height/2+3,{steps:5});
   await track.evaluate((element,fraction)=>{element.closest('.timeline-scroll').scrollLeft=element.offsetLeft+element.clientWidth*fraction-200;},fraction);
   const box=await track.boundingBox();assert(box);const pending=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/issues/'+interval.identifier&&r.request().method()==='PATCH');
   await page.mouse.move(box.x+box.width*fraction,box.y+box.height/2,{steps:12});await page.mouse.move(box.x+box.width*fraction+1,box.y+box.height/2);await page.mouse.up();assert.equal((await pending).status(),200);await ready();
  }
  before=await read(interval.identifier);await dragDate('start','2026-11-07');let after=await read(interval.identifier);assert.equal(after.startDate,'2026-11-07');assert.equal(after.activity.length,before.activity.length+1);await dismiss();
  before=after;await dragDate('due','2026-11-13');after=await read(interval.identifier);assert.equal(after.dueDate,'2026-11-13');assert.equal(after.activity.length,before.activity.length+1);
  await page.getByRole('region',{name:'Issue Undo',exact:true}).getByRole('button',{name:'Undo',exact:true}).click();await ready();assert.equal((await read(interval.identifier)).dueDate,'2026-11-12');await dismiss();
  await row(interval.identifier).getByRole('button',{name:'Change dates for '+interval.identifier,exact:true}).click();const form=timeline.getByRole('form',{name:'Change dates for '+interval.identifier,exact:true});
  await form.getByLabel('New date',{exact:true}).fill('2026-11-08');const stale=await read(interval.identifier);await call('/issues/'+interval.identifier,'PATCH',{expectedVersion:stale.version,priority:stale.priority==='high'?'low':'high'});
  const raced=await read(interval.identifier);await form.getByRole('button',{name:'Save date',exact:true}).click();await timeline.getByRole('alert').filter({hasText:'Your date change was not saved'}).waitFor();await ready();after=await read(interval.identifier);assert.equal(after.version,raced.version);assert.equal(after.activity.length,raced.activity.length);assert.equal(after.startDate,'2026-11-07');
  await call('/issues/'+interval.identifier,'PATCH',{expectedVersion:after.version,startDate:'2026-11-06'});
  console.log('ISSUE-022 VIEW-007 '+width+': editor, API, interval refusal, week filter, list and board, bulk, four date combinations, dependencies, endpoint drag, activity, Undo, stale and tooltip PASS');
 }
}
