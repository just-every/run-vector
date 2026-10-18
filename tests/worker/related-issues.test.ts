import { expect,it } from 'vitest';
import { setupAdministration } from './administration-fixture';

type Issue={identifier:string;version:number;dependencies:{direction:string;identifier:string}[];status:{category:string}};
it('[REL-007] related issues are symmetric across teams, preserve identifiers on a team move, never block work and disappear when either endpoint is deleted',async()=>{
  const f=await setupAdministration();
  const state=await f.mutate('/settings/teams','POST',{name:'Platform',identifierPrefix:'PLAT'});
  const team=state.teams.find(t=>t.name==='Platform')!;
  const a=await f.create({title:'Investigate delayed invoice export',assigneeOperatorId:f.owner}),b=await f.create({title:'Document export limits',teamId:team.id,assigneeOperatorId:f.owner});
  const read=async(identifier:string)=>(await (await f.call('/issues/'+identifier)).json()) as Issue;
  const relate=async(left:Issue,right:Issue,method='POST')=>f.call('/issues/'+left.identifier+'/dependencies',method,{expectedVersion:left.version,relatedIdentifier:right.identifier,relatedVersion:right.version,direction:'related'});
  expect((await relate(await read(a.identifier),await read(a.identifier))).status).toBe(409);
  expect((await relate(await read(a.identifier),await read(b.identifier))).status).toBe(200);
  const linkedA=await read(a.identifier),linkedB=await read(b.identifier);
  expect(linkedA.dependencies).toContainEqual(expect.objectContaining({direction:'related',identifier:b.identifier}));
  expect(linkedB.dependencies).toContainEqual(expect.objectContaining({direction:'related',identifier:a.identifier}));
  expect((await relate(linkedB,linkedA)).status).toBe(409);
  const work=await (await f.call('/my-work')).json() as {sections:{waiting:{identifier:string}[]}};
  expect(work.sections.waiting.some(i=>[a.identifier,b.identifier].includes(i.identifier))).toBe(false);
  const moved=await f.call('/issues/'+a.identifier+'/team','POST',{expectedVersion:linkedA.version,teamId:team.id,statusId:team.statuses.find(s=>s.category==='backlog')!.id});
  expect(moved.status,await moved.clone().text()).toBe(200);
  expect((await moved.json() as Issue).identifier).toBe(a.identifier);
  expect((await read(b.identifier)).dependencies).toContainEqual(expect.objectContaining({identifier:a.identifier,direction:'related'}));
  expect((await relate(await read(b.identifier),await read(a.identifier),'DELETE')).status).toBe(200);
  expect((await read(a.identifier)).dependencies).toEqual([]);expect((await read(b.identifier)).dependencies).toEqual([]);
  for(const [removed,survivor] of [[a,b],[b,await f.create({title:'Export follow-up'})]]) {
    expect((await relate(await read(removed.identifier),await read(survivor.identifier))).status).toBe(200);
    const response=await f.call('/issues/'+removed.identifier,'DELETE',{expectedVersion:(await read(removed.identifier)).version,confirmed:true});
    expect(response.status,await response.clone().text()).toBe(200);
    expect((await read(survivor.identifier)).dependencies).toEqual([]);
  }
});
