import { expect,it } from 'vitest';
import { env } from 'cloudflare:workers';
import { setupIntegrations } from './integration-fixture';

it('[PROJ-001 PROJ-007] project dates, priority and enabled workspace labels persist with field activity and consistent filtered counts',async()=>{
  const f=await setupIntegrations();
  for(const name of ['Delivery','Customer'])await f.mutate('/settings/labels','POST',{name,color:'#405080',projectsEnabled:true});
  await f.mutate('/settings/labels','POST',{name:'Issues only',color:'#405080'});
  const state=await f.state(),labelIds=state.labels.filter(label=>label.projectsEnabled).map(label=>label.id);
  const initial=await f.mutate('/settings/projects','POST',{name:'Ship checkout',leadOperatorId:f.owner});
  const project=initial.projects.find(p=>p.name==='Ship checkout')!;
  const update={startDate:'2027-02-01',targetDate:'2027-02-20',priority:'high',labelIds};
  await f.mutate('/settings/projects/'+project.id,'PATCH',update);
  f.restart();
  const detail=await (await f.call('/projects/'+project.id)).json() as any;
  expect(detail).toMatchObject({startDate:update.startDate,targetDate:update.targetDate,priority:'high'});
  expect(detail.labels.map((l:any)=>l.id).sort()).toEqual([...labelIds].sort());
  const changes=detail.activity.filter((a:any)=>a.kind.endsWith('_changed'));
  expect(changes).toHaveLength(4);
  expect(changes.map((a:any)=>a.kind).sort()).toEqual(['project.startDate_changed','project.targetDate_changed','project.priority_changed','project.labelIds_changed'].sort());
  await f.mutate('/settings/projects/'+project.id,'PATCH',update);
  expect(((await (await f.call('/projects/'+project.id)).json()) as any).activity).toHaveLength(detail.activity.length);
  for(const invalid of [{targetDate:'2027-01-31'},{startDate:'2027-03-01'},{targetDate:'2027-02-30'}])expect((await f.call('/settings/projects/'+project.id,'PATCH',invalid)).status).toBe(400);
  expect(((await (await f.call('/projects/'+project.id)).json()) as any).activity).toHaveLength(detail.activity.length);
  const low=await f.mutate('/settings/projects','POST',{name:'A low priority project',leadOperatorId:f.owner,priority:'low',labelIds:[labelIds[0]]});
  await f.mutate('/settings/projects','POST',{name:'Unlabelled urgent',leadOperatorId:f.owner,priority:'urgent'});
  const portfolio=await (await f.call('/projects?label='+labelIds[0]+'&sort=priority&lifecycle=planned')).json() as any;
  expect(portfolio.projects.map((p:any)=>p.id)).toEqual([project.id,low.projects.find(p=>p.name==='A low priority project')!.id]);
  expect(portfolio.counts).toEqual({planned:2});
  await f.create({projectId:project.id});
  await f.mutate('/settings/projects/'+project.id,'PATCH',{lifecycle:'active'});
  for(const query of ['lifecycle=active','health=on-track','team='+f.initial.teams[0].id,'targetFrom=2027-02-01&targetTo=2027-02-20','label='+labelIds[1], 'lifecycle=active&health=on-track&lead='+f.owner+'&team='+f.initial.teams[0].id+'&targetFrom=2027-02-01&targetTo=2027-02-20&label='+labelIds[0]]) {
    const response=await f.call('/projects?at=2027-02-01T12%3A00%3A00Z&'+query);
    expect(response.status).toBe(200);
    const filtered=await response.json() as any;
    expect(filtered.projects.map((p:any)=>p.id)).toEqual([project.id]);
    expect(filtered.counts).toEqual({active:1,'on-track':1});
  }
  const byLead=await (await f.call('/projects?at=2027-02-01T12%3A00%3A00Z&lead='+f.owner)).json() as any;
  expect(byLead.projects).toHaveLength(3);
  expect(byLead.counts).toEqual({active:1,'on-track':1,planned:2});
  const noMatches=await (await f.call('/projects?label='+labelIds[0]+'&targetTo=2027-01-01')).json() as any;
  expect(noMatches.projects).toEqual([]); expect(noMatches.counts).toEqual({});
  expect((await f.call('/projects?targetFrom=2027-02-20&targetTo=2027-02-01')).status).toBe(400);

  const stored=await f.call('/preferences/projects','PUT',{filters:{label:labelIds[0]},sort:'priority'});
  expect(stored.status).toBe(200);
  expect(await (await f.call('/preferences/projects')).json()).toMatchObject({filters:{label:labelIds[0]},sort:'priority'});
  const unmarked=state.labels.find(label=>!label.projectsEnabled)!;
  expect((await f.call('/settings/projects/'+project.id,'PATCH',{labelIds:[unmarked.id]})).status).toBe(409);
  expect((await f.call('/settings/labels/'+labelIds[0],'PATCH',{projectsEnabled:false})).status).toBe(409);
  await f.mutate('/settings/labels/'+labelIds[0],'DELETE');
  const after=await (await f.call('/projects/'+project.id)).json() as any;
  expect(after.labels.map((label:any)=>label.id)).toEqual([labelIds[1]]);
  expect(after.activity.filter((a:any)=>a.kind==='project.labelIds_changed')).toHaveLength(2);
  expect(await (await f.call('/preferences/projects')).json()).toMatchObject({filters:{label:'all'}});
  expect((await env.DB.prepare('PRAGMA foreign_key_check').all()).results).toEqual([]);
});

it('[PROJ-001 API-001] scoped project API creates and changes native planning fields and rejects invalid date changes atomically',async()=>{
  const f=await setupIntegrations();
  const state=await f.mutate('/settings/labels','POST',{name:'API delivery',color:'#405080',projectsEnabled:true});
  const label=state.labels.find(l=>l.name==='API delivery')!;
  const second=await f.mutate('/settings/labels','POST',{name:'API customer',color:'#405080',projectsEnabled:true});
  const other=second.labels.find(l=>l.name==='API customer')!;
  const reader=await f.issueToken(['projects:read']),writer=await f.issueToken(['projects:read','projects:write']);
  const input={name:'API launch',leadOperatorId:f.owner,startDate:'2027-04-01',targetDate:'2027-04-20',priority:'high',labelIds:[label.id,other.id]};
  expect((await f.api(reader.token,'/projects','POST',input)).status).toBe(401);
  const created=await f.api(writer.token,'/projects','POST',input);
  expect(created.status,await created.clone().text()).toBe(201);
  const project=await created.json() as any;
  expect(project).toMatchObject({startDate:input.startDate,targetDate:input.targetDate,priority:'high'});
  expect(project.labels.map((l:any)=>l.id).sort()).toEqual([label.id,other.id].sort());
  const before=project.activity.length;
  expect((await f.api(writer.token,'/projects/'+project.id,'PATCH',{targetDate:'2027-03-01',priority:'urgent'})).status).toBe(400);
  expect((await (await f.api(reader.token,'/projects/'+project.id)).json()) as any).toMatchObject({priority:'high',activity:expect.arrayContaining(project.activity)});
  const changed=await f.api(writer.token,'/projects/'+project.id,'PATCH',{startDate:'2027-04-02',targetDate:'2027-04-21',priority:'urgent',labelIds:[]});
  expect(changed.status,await changed.clone().text()).toBe(200);
  const value=await changed.json() as any;
  expect(value.activity).toHaveLength(before+4);
  expect(value.labels).toEqual([]);
  expect((await f.api(reader.token,'/projects?sort=priority')).status).toBe(200);
  expect((await f.api(reader.token,'/projects/'+project.id,'PATCH',{priority:'low'})).status).toBe(401);
  expect((await f.api(writer.token,'/projects','POST',{...input,name:'Bad range',targetDate:'2027-01-01'})).status).toBe(400);
});

