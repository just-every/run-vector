import assert from 'node:assert/strict';

/** Native records are created at public settings routes; never fixture SQL. */
export async function prepareJiraNativeRecords(page, base, fixture) {
 const get = async () => {
  const response = await page.request.get(base+'/api/data/import/options');
  assert.equal(response.status(),200);return (await response.json()).references;
 };
 let refs=await get();
 const team=refs.teams.find(row=>!row.archived_at);
 const operator=refs.operators.find(row=>!row.removed_at&&row.identity_active===1);
 assert(team&&operator,'An existing active team and signed-in operator must be available');
 const statuses=Object.fromEntries(['unstarted','started','completed'].map(category=>{
  const status=refs.statuses.find(row=>row.team_id===team.id&&row.category===category);
  assert(status,'Existing team needs '+category+' status');return [category,status];
 }));
 async function post(path,body) {
  const response=await page.request.post(base+path,{headers:{Origin:base},data:body});
  assert(response.ok(),path+' '+response.status()+' '+await response.text());
 }
 if(!refs.teams.some(row=>row.id!==team.id&&!row.archived_at)) {
  await post('/api/settings/teams',{name:'Jira competing team',identifierPrefix:'JCT'});
  refs=await get();
 }
 const otherTeam=refs.teams.find(row=>row.id!==team.id&&!row.archived_at);
 const otherStatus=refs.statuses.find(row=>row.team_id===otherTeam.id&&row.category==='unstarted');
 assert(otherStatus,'A real second team status must exist for scoped-alias proof');
 for(const name of fixture.expected.nativeSetup.labels) {
  if(!refs.labels.some(row=>row.name===name))await post('/api/settings/labels',{name,color:'#224466'});
 }
 for(const [index,name] of fixture.expected.nativeSetup.cycles.entries()) {
  if(!refs.cycles.some(row=>row.name===name&&row.team_id===team.id&&!row.closed_at)) {
   await post('/api/settings/cycles',{teamId:team.id,name,startsLocal:`2040-0${index+1}-01T09:00`,endsLocal:`2040-0${index+1}-15T09:00`,capacity:null});
  }
 }
 refs=await get();
 const cycles=fixture.expected.nativeSetup.cycles.map(name=>{
  const cycle=refs.cycles.find(row=>row.name===name&&row.team_id===team.id&&!row.closed_at);
  assert(cycle,'Exact existing open cycle '+name);return cycle;
 });
 for(const name of fixture.expected.nativeSetup.labels)assert(refs.labels.some(row=>row.name===name));
 return {team,operator,statuses,cycles,otherTeam,otherStatus};
}
