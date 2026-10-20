import { expect } from 'vitest';
import type { setupIntegrations } from './integration-fixture';

export async function exerciseMilestones(f:Awaited<ReturnType<typeof setupIntegrations>>, projectId:string) {
  const base='/settings/projects/'+projectId+'/milestones';
  const send=async(path:string,method='GET',data?:unknown)=>{
    const response=await f.call(path,method,data);
    expect(response.status,await response.clone().text()).toBe(200);
    return response.json() as Promise<any>;
  };
  let detail=await send(base,'POST',{name:'Foundation',description:'Payment validation'});
  const foundation=detail.milestones[0].id;
  detail=await send(base,'POST',{name:'Rollout',targetDate:'2001-01-01'});
  const rollout=detail.milestones[1].id;
  await send(base+'/order','PUT',{milestoneIds:[rollout,foundation]});
  const team=f.initial.teams[0];
  const completed=await f.create({projectId,milestoneId:foundation,statusId:team.statuses.find(s=>s.category==='completed')!.id});
  const open=await f.create({projectId,milestoneId:rollout,statusId:team.statuses.find(s=>s.category==='unstarted')!.id});
  await f.create({projectId,milestoneId:rollout,statusId:team.statuses.find(s=>s.category==='canceled')!.id});
  detail=await send(base+'/'+foundation,'PATCH',{completed:true,name:'Payment foundation',description:'Validated payment service'});
  expect(detail.milestones).toEqual([
    expect.objectContaining({id:rollout,slipped:true,progress:{completed:0,total:1,percentage:0}}),
    expect.objectContaining({id:foundation,name:'Payment foundation',completed:true,slipped:false,progress:{completed:1,total:1,percentage:100}}),
  ]);
  expect((await f.call(base+'/order','PUT',{milestoneIds:[foundation,foundation]})).status).toBe(400);
  const state=await f.mutate('/settings/projects','POST',{name:'Milestone destination',leadOperatorId:f.owner});
  const destination=state.projects.find(p=>p.name==='Milestone destination')!;
  expect((await f.call('/issues/'+open.identifier,'PATCH',{expectedVersion:open.version,projectId:destination.id,milestoneId:rollout})).status).toBe(400);
  const moved=await f.call('/issues/'+open.identifier,'PATCH',{expectedVersion:open.version,projectId:destination.id});
  expect(moved.status).toBe(200);
  const changed=await moved.json() as any;
  expect(changed).toMatchObject({project:{id:destination.id},milestoneId:null,milestone:null});
  const activity=changed.activity.filter((a:any)=>a.kind==='issue.updated');
  expect(activity).toHaveLength(1);
  expect(activity[0]).toMatchObject({previousValue:{projectId,milestoneId:rollout},nextValue:{projectId:destination.id,milestoneId:null}});
  const undo=JSON.parse(moved.headers.get('x-vector-undo')!);
  expect((await f.call('/issues/undo','POST',{actionId:undo.actionId})).status).toBe(200);
  expect(await send('/issues/'+open.identifier)).toMatchObject({project:{id:projectId},milestoneId:rollout});
  const current=await send('/issues/'+open.identifier);
  const bulk=await send('/issues/bulk','POST',{issues:[{identifier:open.identifier,expectedVersion:current.version}],changes:{projectId:destination.id}});
  expect(bulk).toBeTruthy();
  expect(await send('/issues/'+open.identifier)).toMatchObject({milestoneId:null,project:{id:destination.id}});
  await send(base+'/'+foundation,'DELETE');
  expect(await send('/issues/'+completed.identifier)).toMatchObject({milestoneId:null,project:{id:projectId},version:completed.version+1});
}
