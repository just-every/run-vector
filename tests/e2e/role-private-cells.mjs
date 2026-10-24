import assert from 'node:assert/strict';
import {readerApi} from './role-reader-support.mjs';
import {navigate} from './collaboration-navigation.mjs';
export async function rolePrivateCells({page,peer,memberId,runtime,clause}){
 const owner=readerApi(page,runtime.base),api=readerApi(peer,runtime.base);
 const team=(await owner('/settings/teams','POST',{name:'synthetic-vector-1960',identifierPrefix:'SYNRMAT',isPrivate:true})).teams.find(t=>t.name==='synthetic-vector-1960');
 const issue=await owner('/issues','POST',{title:'synthetic-vector-1961',teamId:team.id,statusId:team.statuses.find(s=>s.category==='started').id,assigneeOperatorId:memberId},201);
 for(const width of [1440,390])await clause('ROLE-001 OPS-001',`private 404 and public/membership read cells through the same Admin/Member session at ${width}`,async()=>{
  await peer.setViewportSize({width,height:width===390?844:1000});await owner(`/settings/operators/${memberId}/role`,'PATCH',{role:'admin'});
  await api('/issues/'+issue.identifier,'GET',undefined,404);await navigate(peer,runtime.base+'/app');assert.ok(!(await peer.locator('main:visible').first().innerText()).includes(issue.identifier));assert.ok(!JSON.stringify(await api('/search?q='+encodeURIComponent(issue.title))).includes(issue.identifier));
  await owner(`/settings/operators/${memberId}/role`,'PATCH',{role:'member'});await api('/issues/'+issue.identifier,'GET',undefined,404);
  await owner(`/settings/teams/${team.id}/members/${memberId}`,'PUT',{role:'member'});await navigate(peer,runtime.base+'/app/issues/'+issue.identifier);await peer.getByRole('heading',{name:issue.title,exact:true}).waitFor();await api('/issues/'+issue.identifier);
  await owner(`/settings/teams/${team.id}/members/${memberId}`,'DELETE');await api('/issues/'+issue.identifier,'GET',undefined,404);
 });
}
