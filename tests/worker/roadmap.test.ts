import {Hono} from 'hono';
import {createApiApp} from '../../src/core/app/api';
import {bindings} from './base-auth-fixture';
import {env} from 'cloudflare:workers';
import {expect,it,vi} from 'vitest';
import {roleWorkspace,snapshot,resetLimits} from './role-fixture';
import type {RoadmapData} from '../../src/core/features/roadmap/schema';

it('roadmap places visible projects and initiatives and fences every planning change with one activity',async()=>{
  vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(new Date('2027-02-08T12:00:00Z'));
  try {
    const f=await roleWorkspace();
    const create=async(name:string,dates:Record<string,unknown>={},teamId=f.team.id)=>{
      const state=await f.mutate('/settings/projects','POST',{name,leadOperatorId:f.lead.id,...dates});
      const project=state.projects.find(p=>p.name===name)!;
      await f.create({teamId,projectId:project.id});
      return project;
    };
    const both=await create('synthetic-vector-2020',{startDate:'2027-02-01',targetDate:'2027-02-20'});
    const target=await create('synthetic-vector-2021',{targetDate:'2027-02-18'});
    const start=await create('synthetic-vector-2022',{startDate:'2027-02-02'});
    const none=await create('synthetic-vector-2023');
    const future=await create('synthetic-vector-2024',{startDate:'2027-03-01'});
    await f.mutate('/settings/projects/'+both.id+'/milestones','POST',{name:'synthetic-vector-2025',targetDate:'2027-02-12'});
    const initiative=await (await f.call('/initiatives','POST',{name:'synthetic-vector-2026',ownerOperatorId:f.owner,targetDate:'2027-04-01'})).json() as any;
    expect((await f.call('/initiatives/'+initiative.id+'/projects','PUT',{expectedVersion:initiative.version,projectIds:[both.id,target.id,start.id,none.id]})).status).toBe(200);
    const fallback=await (await f.call('/initiatives','POST',{name:'synthetic-vector-2027',ownerOperatorId:f.owner,targetDate:'2027-04-01'})).json() as any;
    expect((await f.call('/initiatives/'+fallback.id+'/projects','PUT',{expectedVersion:fallback.version,projectIds:[none.id]})).status).toBe(200);
    const read=async(who=f.people.owner)=>{
      const response=await who.call('/roadmap');expect(response.status,await response.clone().text()).toBe(200);
      return await response.json() as RoadmapData;
    };
    let data=await read();
    const row=(id:string)=>data.projects.find(p=>p.id===id)!;
    expect(data).toMatchObject({today:'2027-02-08',timezone:'UTC',canEdit:true});
    expect(row(both.id).placement).toEqual({kind:'interval',start:'2027-02-01',end:'2027-02-20'});
    expect(row(target.id).placement).toEqual({kind:'diamond',start:'2027-02-18',end:'2027-02-18'});
    expect(row(start.id).placement).toEqual({kind:'open',start:'2027-02-02',end:'2027-02-08'});
    expect(row(future.id).placement).toEqual({kind:'open',start:'2027-03-01',end:'2027-03-01'});
    expect(row(none.id).placement).toEqual({kind:'unscheduled',start:null,end:null});
    expect(row(both.id).milestones).toEqual([expect.objectContaining({name:'synthetic-vector-2025',targetDate:'2027-02-12',completed:false})]);
    expect(data.initiatives.find(n=>n.id===initiative.id)?.placement).toEqual({kind:'interval',start:'2027-02-01',end:'2027-02-20'});
    expect(data.initiatives.find(n=>n.id===fallback.id)?.placement).toEqual({kind:'diamond',start:'2027-04-01',end:'2027-04-01'});
    const labelState=await f.mutate('/settings/labels','POST',{name:'synthetic-vector-2028',color:'#405080',projectsEnabled:true});
    const label=labelState.labels.find(l=>l.name==='synthetic-vector-2028')!;
    const activity=async(id:string)=>(await env.DB.prepare('SELECT * FROM project_activity WHERE project_id=? ORDER BY id').bind(id).all()).results;
    const changes=[
      [both.id,{startDate:'2027-02-02',targetDate:'2027-02-21'}],
      [both.id,{startDate:'2027-02-03'}], [both.id,{targetDate:'2027-02-22'}],
      [target.id,{targetDate:'2027-02-19'}], [none.id,{startDate:'2027-02-04',targetDate:'2027-02-11'}],
      [both.id,{priority:'high'}], [both.id,{labelIds:[label.id]}],
    ] as const;
    for(const [index,[id,change]] of changes.entries()){
      await resetLimits();data=await read();const old=row(id),before=await activity(id);
      const who=[f.people.owner,f.admin,f.member][index%3]!;
      const response=await who.call('/roadmap/projects/'+id,'PATCH',{expectedVersion:old.version,...change});
      expect(response.status,await response.clone().text()).toBe(200);
      const current=(await response.json() as RoadmapData).projects.find(p=>p.id===id)!;
      expect(current).toMatchObject(change);expect(current.version).not.toBe(old.version);
      expect(await activity(id)).toHaveLength(before.length+1);
      expect((await activity(id)).filter((entry:any)=>!before.some((old:any)=>old.id===entry.id))).toEqual([expect.objectContaining({actor_operator_id:who.id})]);
      const stored=await snapshot(['projects','project_activity','project_labels']);
      expect((await who.call('/roadmap/projects/'+id,'PATCH',{expectedVersion:old.version,...change})).status).toBe(409);
      expect(await snapshot(['projects','project_activity','project_labels'])).toEqual(stored);
    }
    data=await read();const current=row(both.id),stored=await snapshot(['projects','project_activity','project_labels']);
    expect((await f.call('/roadmap/projects/'+both.id,'PATCH',{expectedVersion:current.version,startDate:'2027-05-01'})).status).toBe(400);
    expect((await f.call('/roadmap/projects/'+both.id,'PATCH',{priority:'low'})).status).toBe(400);
    expect((await f.call('/roadmap/projects/'+both.id,'PATCH',{expectedVersion:current.version,priority:current.priority})).status).toBe(200);
    expect((await activity(both.id))).toEqual(stored.project_activity.filter((a:any)=>a.project_id===both.id).sort((a:any,b:any)=>a.id.localeCompare(b.id)));
    // A retained Member session follows its current Viewer role immediately.
    const viewer=await f.fresh('member');
    expect((await f.call('/settings/operators/'+viewer.id+'/role','PATCH',{role:'viewer'})).status).toBe(200);
    for(const who of [f.guest,viewer]){
      const projection=await read(who);expect(projection.canEdit).toBe(false);
      const before=await snapshot(['projects','project_activity','project_labels']);
      expect((await who.call('/roadmap/projects/'+both.id,'PATCH',{expectedVersion:current.version,priority:'urgent'})).status).toBe(403);
      expect(await snapshot(['projects','project_activity','project_labels'])).toEqual(before);
    }
    const privateTeam=(await f.mutate('/settings/teams','POST',{name:'synthetic-vector-2029',identifierPrefix:'SYNROAD',isPrivate:true})).teams.find(t=>t.name==='synthetic-vector-2029')!;
    const hidden=await create('synthetic-vector-2030',{startDate:'2020-01-01',targetDate:'2030-01-01'},privateTeam.id);
    const node=await (await f.call('/initiatives/'+initiative.id)).json() as any;
    expect((await f.call('/initiatives/'+initiative.id+'/projects','PUT',{expectedVersion:node.version,projectIds:[both.id,hidden.id]})).status).toBe(200);
    const member=await read(f.member);
    expect(JSON.stringify(member)).not.toContain(hidden.id);expect(JSON.stringify(member)).not.toContain(hidden.name);
    expect(member.initiatives.find(n=>n.id===initiative.id)?.placement).toEqual({kind:'interval',start:'2027-02-03',end:'2027-02-22'});
    const foreign='01K00000000000000000002031',missing='01K00000000000000000002032';
    await env.DB.prepare("INSERT INTO workspace_settings(id,name,timezone,created_at,updated_at) VALUES('synthetic-vector-2033','synthetic-vector-2033','UTC','2027-01-01','2027-01-01')").run();
    await env.DB.prepare("INSERT INTO projects(id,workspace_id,name,description,lead_operator_id,lifecycle,created_at,updated_at) VALUES(?,'synthetic-vector-2033','synthetic-vector-2034','',?,'planned','2027-01-01','2027-01-01')").bind(foreign,f.owner).run();
    const isolated=new Hono().route('/api',createApiApp());
    for(const id of [hidden.id,foreign,missing]){
      const before=await snapshot(['projects','project_activity','project_labels']);
      const response=await isolated.request(bindings.APP_ORIGIN+'/api/roadmap/projects/'+id,{method:'PATCH',headers:{origin:bindings.APP_ORIGIN,cookie:f.member.cookie,'content-type':'application/json',host:new URL(bindings.APP_ORIGIN).host},body:JSON.stringify({expectedVersion:current.version,priority:'urgent'})},bindings);
      expect(response.status,await response.clone().text()).toBe(404);
      expect(await snapshot(['projects','project_activity','project_labels'])).toEqual(before);
      expect(await response.text()).not.toContain(id);
    }
    await env.DB.prepare('DELETE FROM projects WHERE id=?').bind(foreign).run();
    await env.DB.prepare("DELETE FROM workspace_settings WHERE id='synthetic-vector-2033'").run();
  } finally {vi.useRealTimers();}
},120_000);
