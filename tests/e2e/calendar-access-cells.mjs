import assert from 'node:assert/strict';
import {inviteReader,readerApi} from './role-reader-support.mjs';
import {navigate} from './collaboration-navigation.mjs';
import {roleScreens} from './role-ui-support.mjs';
export async function calendarAccessCells(page,context,runtime,output){
 const base=runtime.base,owner=readerApi(page,base),reader=await inviteReader({owner:page,browser:context.browser(),runtime,email:'synthetic-vector-1910@vector.test',name:'synthetic-vector-1910',role:'member'}),inspect=roleScreens(output);
 try{
  const state=await owner('/settings/teams','POST',{name:'synthetic-vector-1911',identifierPrefix:'SYNCALR'}),team=state.teams.find(t=>t.name==='synthetic-vector-1911');
  const outside=state.teams.find(t=>t.id!==team.id&&!t.isPrivate&&!t.archivedAt);
  const hidden=await owner('/issues','POST',{teamId:team.id,title:'synthetic-vector-1912',dueDate:'2026-11-04',assigneeOperatorId:reader.id},201);
  const visible=await owner('/issues','POST',{teamId:outside.id,title:'synthetic-vector-1913',dueDate:'2026-11-04',assigneeOperatorId:reader.id},201);
  await owner('/releases','POST',{name:'synthetic-vector-2303',teamId:team.id,targetDate:'2026-11-04',description:'synthetic-vector-2304'},201);
  await owner('/releases','POST',{name:'synthetic-vector-2305',targetDate:'2026-11-04'},201);
  await owner(`/settings/teams/${team.id}/members/${reader.id}`,'PUT',{role:'member'});
  const feed=await reader.api('/calendar/feeds','POST',{},201);
  assert.ok((await(await context.request.get(feed.url)).text()).includes(hidden.identifier));
  const teamFeed=await reader.api('/calendar/feeds','POST',{teamId:team.id},201);
  let releaseFeed=await(await context.request.get(feed.url)).text();assert.ok(releaseFeed.includes('synthetic-vector-2303'));assert.ok(releaseFeed.includes('synthetic-vector-2305'));assert.ok(!releaseFeed.includes('synthetic-vector-2304'));
  await owner(`/settings/teams/${team.id}/members/${reader.id}`,'DELETE');
  assert.ok(!(await(await context.request.get(feed.url)).text()).includes('synthetic-vector-2303'));assert.equal((await context.request.get(teamFeed.url)).status(),404);
  await owner(`/settings/teams/${team.id}/privacy`,'PUT',{isPrivate:true});
  assert.ok(!JSON.stringify(await reader.api('/calendar/events?month=2026-11')).includes(hidden.identifier));
  assert.ok(!(await(await context.request.get(feed.url)).text()).includes(hidden.identifier));
  await owner(`/settings/operators/${reader.id}/role`,'PATCH',{role:'viewer',teamIds:[]});
  await owner(`/settings/teams/${team.id}/members/${reader.id}`,'PUT',{role:'member'});
  releaseFeed=await(await context.request.get(feed.url)).text();assert.ok(releaseFeed.includes('synthetic-vector-2303'));assert.ok(releaseFeed.includes('synthetic-vector-2305'));
  const events=await reader.api('/calendar/events?month=2026-11');assert.ok(JSON.stringify(events).includes(hidden.identifier));
  const bytes=await(await context.request.get(feed.url)).text();assert.ok(bytes.includes(visible.identifier));assert.ok(!bytes.includes(hidden.identifier));
  const before=runtime.sql(`SELECT version,due_date FROM issues WHERE id='${visible.id}'`)[0];
  for(const width of [1440,390]){
   await reader.page.setViewportSize({width,height:width===390?844:1000});await navigate(reader.page,base+'/app/calendar');await reader.page.locator('[data-month-calendar-ready="true"]').waitFor();
   await reader.page.getByLabel('Calendar month',{exact:true}).fill('2026-11');await reader.page.locator('[data-month-calendar-ready="true"]').waitFor();
   await reader.page.locator('[data-calendar-day="2026-11-04"] > button').click();await reader.page.locator(`[data-calendar-event="${visible.identifier}"]`).waitFor();
   assert.equal(await reader.page.getByRole('button',{name:'Change due date for '+visible.identifier,exact:true}).count(),0);assert.equal(await reader.page.locator(`[data-calendar-event="${visible.identifier}"]`).getAttribute('draggable'),'false');
  }
  await inspect(reader.page,reader.page.getByRole('region',{name:'Selected day events',exact:true}),'calendar-viewer-agenda');
  await inspect(reader.page,reader.page.getByRole('region',{name:'Create calendar feed',exact:true}),'calendar-viewer-own-feed');
  await reader.api('/issues/'+visible.identifier,'PATCH',{expectedVersion:before.version,dueDate:'2026-11-05'},403);assert.deepEqual(runtime.sql(`SELECT version,due_date FROM issues WHERE id='${visible.id}'`)[0],before);
  const own=await reader.api('/calendar/feeds','POST',{},201),rotated=await reader.api(`/calendar/feeds/${own.id}/rotate`,'POST',{expectedVersion:own.version});
  assert.equal((await context.request.get(own.url)).status(),404);assert.equal((await context.request.get(rotated.url)).status(),200);
  await reader.api(`/calendar/feeds/${own.id}`,'DELETE',{expectedVersion:rotated.version});assert.equal((await context.request.get(rotated.url)).status(),404);
  await owner(`/settings/teams/${team.id}/members/${reader.id}`,'DELETE');assert.ok(!JSON.stringify(await reader.api('/calendar/events?month=2026-11')).includes(hidden.identifier));assert.ok(!(await(await context.request.get(feed.url)).text()).includes('synthetic-vector-2303'));
  await owner(`/settings/operators/${reader.id}/role`,'PATCH',{role:'guest',teamIds:[team.id]});assert.equal((await context.request.get(feed.url)).status(),404);
  console.log('CAL-001 VIEW-007 private exclusion, current creator authority, Viewer month read-only and own feed rotation/revocation passed at 1440/390');
 }finally{await reader.context.close();}
}
