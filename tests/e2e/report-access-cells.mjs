import assert from 'node:assert/strict';
import {navigate} from './collaboration-navigation.mjs';
import {inviteReader,readerApi} from './role-reader-support.mjs';
import {roleScreens} from './role-ui-support.mjs';

export async function insightsAccessCells({page,context,runtime,output,team,issues}){
 const owner=readerApi(page,runtime.base),reader=await inviteReader({owner:page,browser:context.browser(),runtime,email:'synthetic-vector-1900@vector.test',name:'synthetic-vector-1900',role:'member'}),inspect=roleScreens(output);
 const query='?team='+team.id+'&metric=cycle-time',expected=(await owner('/insights?team='+team.id+'&metric=cycle-time')).total;
 try{
  assert.equal((await reader.api('/insights'+query)).total,expected);
  await owner(`/settings/teams/${team.id}/privacy`,'PUT',{isPrivate:true});
  assert.equal((await reader.api('/insights'+query)).total,0);
  await owner(`/settings/operators/${reader.id}/role`,'PATCH',{role:'viewer',teamIds:[]});
  for(const width of [1440,390]){
   await reader.page.setViewportSize({width,height:width===390?844:1000});
   await navigate(reader.page,runtime.base+'/app/insights'+query);await reader.page.locator('[data-insights-ready="true"]').waitFor();
   for(const issue of issues)assert.ok(!(await reader.page.locator('main:visible').first().innerText()).includes(issue.title));
   assert.equal((await reader.api('/insights'+query)).total,0);
  }
  await owner(`/settings/teams/${team.id}/members/${reader.id}`,'PUT',{role:'member'});
  assert.equal((await reader.api('/insights'+query)).total,expected);
  await navigate(reader.page,runtime.base+'/app/insights'+query);await reader.page.locator('[data-insights-ready="true"]').waitFor();
  await inspect(reader.page,reader.page.locator('main:visible').first(),'insights-private-viewer');
  const report=await reader.api('/insights'+query),bucket=report.rows[0].key;
  const counted=await reader.api('/insights'+query+'&bucket='+encodeURIComponent(bucket));assert.ok(counted.drill.issues.length);
  const csv=await reader.page.request.get(runtime.base+'/api/insights.csv'+query+'&bucket='+encodeURIComponent(bucket));assert.equal(csv.status(),200);assert.ok((await csv.text()).includes(counted.drill.issues[0].identifier));
  console.log('REPORT-001 private Member omission and Viewer chart/count/drill/CSV admission passed at 1440/390');
 }finally{await owner(`/settings/teams/${team.id}/privacy`,'PUT',{isPrivate:false});await reader.context.close();}
}

export async function dashboardAccessCells({page,member,memberPage,runtime,output,team,id,mine}){
 const owner=readerApi(page,runtime.base),api=readerApi(memberPage,runtime.base),inspect=roleScreens(output);
 const reader=runtime.sql("SELECT id FROM operators WHERE email='synthetic-vector-42@example.test'")[0].id;
 await owner(`/settings/teams/${team.id}/privacy`,'PUT',{isPrivate:true});
 try{
  assert.deepEqual((await api('/dashboards/'+id)).results.map(r=>r.count),[0,0,0]);
  await owner(`/settings/operators/${reader}/role`,'PATCH',{role:'viewer',teamIds:[]});
  const open=async()=>{await navigate(memberPage,runtime.base+'/app/insights');await memberPage.locator('[data-insights-ready="true"]').waitFor();await memberPage.getByRole('button',{name:'Dashboards',exact:true}).click();await memberPage.locator('[data-dashboards-ready="true"]').waitFor();await memberPage.getByRole('combobox',{name:'Open dashboard',exact:true}).selectOption(id);await memberPage.locator('[data-dashboard-ready="true"]').waitFor();};
  for(const width of [1440,390]){
   await memberPage.setViewportSize({width,height:width===390?844:1000});await open();
   assert.equal(await memberPage.getByRole('region',{name:'Delivery count',exact:true}).locator('strong').textContent(),'0');assert.ok(!(await memberPage.getByRole('region',{name:'Delivery issues',exact:true}).innerText()).includes(mine.identifier));
   assert.equal(await memberPage.getByRole('button',{name:'New dashboard',exact:true}).count(),0);
  }
  await owner(`/settings/teams/${team.id}/members/${reader}`,'PUT',{role:'member'});
  const shared=await api('/dashboards/'+id);assert.deepEqual(shared.results.map(r=>r.count),[1,1,1]);assert.deepEqual(shared.results[2].issues.map(i=>i.identifier),[mine.identifier]);
  const before=runtime.sql(`SELECT version,name,is_shared FROM dashboards WHERE id='${id}'`)[0];
  for(const [path,method,data] of [['/dashboards','POST',{name:'synthetic-vector-1901',widgets:[]}],['/dashboards/'+id,'PUT',{name:'synthetic-vector-1902',expectedVersion:shared.dashboard.version,widgets:[]}],['/dashboards/'+id,'DELETE',{}]])await api(path,method,data,403);
  assert.deepEqual(runtime.sql(`SELECT version,name,is_shared FROM dashboards WHERE id='${id}'`)[0],before);
  await open();await inspect(memberPage,memberPage.locator('main:visible').first(),'dashboard-private-viewer');
  console.log('REPORT-003 existing definitions re-evaluate private access; Viewer read-only counts and lists passed at 1440/390');
 }finally{await owner(`/settings/teams/${team.id}/privacy`,'PUT',{isPrivate:false});}
}
