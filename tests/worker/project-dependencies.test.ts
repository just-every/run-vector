import { env } from 'cloudflare:workers';
import { Hono } from 'hono';
import { createApiApp } from '../../src/core/app/api';
import { createIntegrationApi } from '../../src/core/features/integrations/api';
import { expect, it } from 'vitest';
import { createServerApp } from '../../src/core/app/server';
import { bindings, request } from './base-auth-fixture';
import { roleWorkspace, snapshot, resetLimits, type Person } from './role-fixture';
import { provePopulatedUpgrade } from './populated-upgrade';

const watched=['project_dependencies','project_activity','project_notifications','issue_dependencies','issues'];
const path=(blocked:string,blocking:string)=>'/projects/'+blocked+'/dependencies/'+blocking;
async function body(response:Response) {
  expect(response.status,await response.clone().text()).toBe(200);
  return response.json() as Promise<any>;
}
type Workspace=Awaited<ReturnType<typeof roleWorkspace>>;
async function project(f:Workspace,n:number,lead=f.lead.id) {
  const state=await f.mutate('/settings/projects','POST',{name:'synthetic-vector-'+n,leadOperatorId:lead});
  return state.projects.find(p=>p.name==='synthetic-vector-'+n)!;
}
const notices=async(person:Person)=>(await body(await person.call('/notifications?limit=50'))).items.filter((item:any)=>item.projectId);

it('direct project graph uses native and scoped doors, stable identity, attributed endpoint activity and current lead Inbox subjects',async()=>{
  const f=await roleWorkspace(),a=await project(f,1501),b=await project(f,1502,f.member.id);
  await f.create({teamId:f.team.id,projectId:a.id});
  await f.create({teamId:f.team.id,projectId:b.id});
  const app=createServerApp();
  for(const surface of ['call','api'] as const) {
    const baseline=await snapshot(watched);
    const added=await body(await f.admin[surface](path(b.id,a.id),'PUT'));
    const edge=added.directDependencies.blockedBy[0];
    expect(edge).toMatchObject({id:expect.any(String),project:{id:a.id,name:a.name}});
    expect((await body(await f.people.owner[surface]('/projects/'+a.id))).directDependencies.blocking).toEqual([{id:edge.id,project:{id:b.id,name:b.name}}]);
    for(const [endpoint,direction,other] of [[a,'blocking',b],[b,'blocked-by',a]] as const) {
      const detail=await body(await f.call('/projects/'+endpoint.id));
      expect(detail.activity.filter((entry:any)=>entry.kind==='project.dependency_added').at(0)).toMatchObject({actorName:expect.any(String),
        nextValue:{dependencyId:edge.id,blockedProjectId:b.id,blockingProjectId:a.id},dependency:{direction,project:{id:other.id,name:other.name}}});
    }
    const committed=await snapshot(watched);
    expect(committed.project_activity).toHaveLength(baseline.project_activity.length+2);
    expect(committed.project_notifications).toHaveLength(baseline.project_notifications.length+2);
    expect(committed.issue_dependencies).toEqual(baseline.issue_dependencies);
    expect(committed.issues).toEqual(baseline.issues);
    expect(committed.project_activity.slice(-2).every(row=>row.actor_operator_id===f.admin.id)).toBe(true);
    for(const lead of [f.lead,f.member]) {
      const items=await notices(lead);
      expect(items.at(0)).toMatchObject({projectId:b.id,identifier:'Project',title:b.name,causes:['blocking']});
      expect(items.at(0).identifier).not.toMatch(/-[0-9]+$/);
      expect((await lead.call('/notifications/'+items[0].id+'/read','POST',{})).status).toBe(200);
      expect((await notices(lead)).find((item:any)=>item.id===items[0].id).readAt).not.toBeNull();
    }
    expect(await notices(f.admin)).toEqual([]);
    const unchanged=await snapshot(watched);
    expect((await f.admin[surface](path(b.id,a.id),'PUT')).status).toBe(200);
    expect(await snapshot(watched)).toEqual(unchanged);
    // Restart the mounted server and read the same stored edge.
    const restarted=await app.request(bindings.APP_ORIGIN+'/api/projects/'+b.id,{headers:{cookie:f.cookie,host:new URL(bindings.APP_ORIGIN).host}},bindings);
    expect((await body(restarted)).directDependencies.blockedBy[0].id).toBe(edge.id);
    for(const invalid of [path(a.id,a.id),path(a.id,b.id)]) {
      expect((await f.people.owner[surface](invalid,'PUT')).status).toBe(400);
      expect(await snapshot(watched)).toEqual(unchanged);
    }
    await body(await f.lead[surface](path(b.id,a.id),'DELETE'));
    const removed=await snapshot(watched);
    expect(removed.project_dependencies).toEqual(baseline.project_dependencies);
    expect(removed.project_activity).toHaveLength(committed.project_activity.length+2);
    expect(removed.project_activity.slice(-2).every(row=>row.actor_operator_id===f.lead.id&&row.kind==='project.dependency_removed')).toBe(true);
    expect((await body(await f.call('/projects/'+b.id))).directDependencies.blockedBy).toEqual([]);
    expect((await f.lead[surface](path(b.id,a.id),'DELETE')).status).toBe(200);
    expect(await snapshot(watched)).toEqual(removed);
  }
  // A shared lead receives one notice, and the acting lead never receives one.
  await f.mutate('/settings/projects/'+b.id,'PATCH',{leadOperatorId:f.lead.id});
  let before=await snapshot(watched);
  await body(await f.people.owner.call(path(b.id,a.id),'PUT'));
  let after=await snapshot(watched);
  expect(after.project_notifications.slice(before.project_notifications.length).map(row=>row.recipient_id)).toEqual([f.lead.id]);
  before=after;
  await body(await f.lead.call(path(b.id,a.id),'DELETE'));
  after=await snapshot(watched);
  expect(after.project_notifications).toEqual(before.project_notifications);
  // A new current lead receives the next change; erased recipients never return.
  await f.mutate('/settings/projects/'+b.id,'PATCH',{leadOperatorId:f.member.id});
  expect((await f.call('/settings/operators/'+f.lead.id,'DELETE')).status).toBe(200);
  await body(await f.people.owner.api(path(b.id,a.id),'PUT'));
  expect((await env.DB.prepare('SELECT recipient_id FROM project_notifications').all<{recipient_id:string}>()).results.every(row=>row.recipient_id!==f.lead.id)).toBe(true);
  expect((await notices(f.member)).length).toBeGreaterThan(0);
  const stable=await snapshot(watched);
  await body(await f.people.owner.api(path(b.id,a.id),'PUT'));
  expect(await snapshot(watched)).toEqual(stable);
  for(const send of [f.lead.call,f.lead.api])expect((await send(path(b.id,a.id),'DELETE')).status).toBe(401);
  expect(await snapshot(watched)).toEqual(stable);
},120000);

it('project graph refuses unsafe authority and concealed endpoints unchanged, rolls notices back atomically and serializes opposite and multi-hop cycles',async()=>{
  const f=await roleWorkspace(),a=await project(f,1511),b=await project(f,1512,f.member.id),c=await project(f,1513);
  for(const p of [a,b,c])await f.create({teamId:f.team.id,projectId:p.id});
  const viewer=await f.fresh('member');
  expect((await f.call('/settings/operators/'+viewer.id+'/role','PATCH',{role:'viewer',teamIds:[f.team.id]})).status).toBe(200);
  for(const surface of ['call','api'] as const) {
    for(const who of [f.guest,viewer])for(const verb of ['PUT','DELETE']) {
      const before=await snapshot(watched);
      expect((await who[surface](path(b.id,a.id),verb)).status).toBe(403);
      expect(await snapshot(watched)).toEqual(before);
    }
    for(const who of [f.people.owner,f.admin,f.member]) {
      await body(await who[surface](path(b.id,a.id),'PUT'));
      await body(await who[surface](path(b.id,a.id),'DELETE'));
    }
  }
  const limited=await body(await f.member.call('/settings/integrations/tokens','GET'));
  expect(limited).toBeTruthy();
  const minted=await f.member.call('/settings/integrations/tokens','POST',{name:'synthetic-vector-1514',scopes:['projects:read']});
  expect(minted.status).toBe(201);
  const token=await minted.json() as any;
  const api=(method:string)=>createServerApp().request(bindings.APP_ORIGIN+'/api/v1'+path(b.id,a.id),{method,headers:{Authorization:'Bearer '+token.token}},bindings);
  let before=await snapshot(watched);
  expect((await api('PUT')).status).toBe(401);
  expect((await f.member.call('/settings/integrations/tokens/'+token.credential.id,'DELETE')).status).toBe(200);
  expect((await api('DELETE')).status).toBe(401);
  expect((await request('/api'+path(b.id,a.id),'PUT',undefined)).status).toBe(401);
  expect(await snapshot(watched)).toEqual(before);
  // Private, foreign and missing endpoint refusals have the same response body.
  const privateTeam=(await f.mutate('/settings/teams','POST',{name:'synthetic-vector-1515',identifierPrefix:'SYNGRAPH',isPrivate:true})).teams.find(t=>t.name==='synthetic-vector-1515')!;
  const hidden=await project(f,1516);
  await f.create({teamId:privateTeam.id,projectId:hidden.id});
  const missing='01K00000000000000000001517',foreign='01K00000000000000000001518';
  await env.DB.prepare("INSERT INTO workspace_settings(id,name,timezone,created_at,updated_at) VALUES('synthetic-vector-1519','synthetic-vector-1519','UTC','2026-01-01','2026-01-01')").run();
  await env.DB.prepare("INSERT INTO projects(id,workspace_id,name,description,lead_operator_id,lifecycle,created_at,updated_at) VALUES(?,'synthetic-vector-1519','synthetic-vector-1520','',?,'planned','2026-01-01','2026-01-01')").bind(foreign,f.owner).run();
  const isolated=new Hono();
  isolated.route('/api/v1',createIntegrationApi());
  isolated.route('/api',createApiApp());
  for(const surface of ['call','api'] as const)for(const verb of ['PUT','DELETE']) {
    before=await snapshot(watched);
    const replies=[];
    for(const target of [hidden.id,foreign,missing]) {
      const send=(route:string)=>isolated.request(bindings.APP_ORIGIN+(surface==='call'?'/api':'/api/v1')+route,
        {method:verb,headers:{Origin:bindings.APP_ORIGIN,host:new URL(bindings.APP_ORIGIN).host,
          ...(surface==='call'?{cookie:f.member.cookie}:{Authorization:'Bearer '+f.member.token})}},bindings);
      const response=await send(path(a.id,target));
      expect(response.status,await response.clone().text()).toBe(404);
      replies.push(await response.json());
      expect((await send(path(target,a.id))).status).toBe(404);
    }
    expect(replies[0]).toEqual(replies[1]);expect(replies[1]).toEqual(replies[2]);
    expect(await snapshot(watched)).toEqual(before);
  }
  await env.DB.prepare('DELETE FROM projects WHERE id=?').bind(foreign).run();
  await env.DB.prepare("DELETE FROM workspace_settings WHERE id='synthetic-vector-1519'").run();
  // Current access gates reads, edge writes, activities and Inbox counts.
  await f.mutate('/settings/teams/'+privateTeam.id+'/members/'+f.member.id,'PUT',{role:'member'});
  await body(await f.member.call(path(hidden.id,a.id),'PUT'));
  expect((await body(await f.member.api('/projects/'+hidden.id))).directDependencies.blockedBy[0].project.id).toBe(a.id);
  await f.mutate('/settings/teams/'+privateTeam.id+'/members/'+f.member.id,'DELETE');
  before=await snapshot(watched);
  expect((await f.member.api(path(hidden.id,a.id),'DELETE')).status).toBe(404);
  const withdrawn=await body(await f.member.call('/projects/'+a.id));
  expect(withdrawn.directDependencies.blocking).toEqual([]);
  expect(JSON.stringify(withdrawn)).not.toContain(hidden.id);
  expect(JSON.stringify(await notices(f.member))).not.toContain(hidden.id);
  expect(await snapshot(watched)).toEqual(before);
  await body(await f.call(path(hidden.id,a.id),'DELETE'));
  // A failed notice rolls back addition and removal through either door.
  for(const verb of ['PUT','DELETE']) {
    if(verb==='DELETE')await body(await f.call(path(b.id,a.id),'PUT'));
    await env.DB.exec("CREATE TRIGGER synthetic_project_notification_failure BEFORE INSERT ON project_notifications BEGIN SELECT RAISE(ABORT,'synthetic-vector-1521'); END;");
    before=await snapshot(watched);
    try {
      expect((await f.call(path(b.id,a.id),verb)).status).toBe(500);
      expect(await snapshot(watched)).toEqual(before);
      expect((await f.admin.api(path(b.id,a.id),verb)).status).toBe(503);
      expect(await snapshot(watched)).toEqual(before);
    } finally { await env.DB.exec('DROP TRIGGER synthetic_project_notification_failure;'); }
    if(verb==='DELETE')await body(await f.call(path(b.id,a.id),'DELETE'));
  }

  const duplicateBase=await snapshot(watched);
  const duplicates=await Promise.all([f.call(path(b.id,a.id),'PUT'),f.admin.api(path(b.id,a.id),'PUT')]);
  expect(duplicates.map(r=>r.status)).toEqual([200,200]);
  const duplicateAfter=await snapshot(watched);
  expect(duplicateAfter.project_activity.length-duplicateBase.project_activity.length).toBe(2);
  const repeatedRemovals=await Promise.all([f.call(path(b.id,a.id),'DELETE'),f.admin.api(path(b.id,a.id),'DELETE')]);
  expect(repeatedRemovals.map(r=>r.status)).toEqual([200,200]);
  expect((await snapshot(watched)).project_activity.length-duplicateAfter.project_activity.length).toBe(2);
  // Public calls genuinely overlap; a committed graph can never contain both.
  await resetLimits();
  const pair=await Promise.all([f.call(path(b.id,a.id),'PUT'),f.admin.api(path(a.id,b.id),'PUT')]);
  expect(pair.map(r=>r.status).sort()).toEqual([200,400]);
  const persisted=(await env.DB.prepare('SELECT * FROM project_dependencies WHERE blocked_project_id IN(?,?,?)').bind(a.id,b.id,c.id).all<any>()).results;
  expect(persisted).toHaveLength(1);
  await body(await f.call(path(persisted[0].blocked_project_id,persisted[0].blocking_project_id),'DELETE'));
  await body(await f.call(path(b.id,a.id),'PUT'));
  await body(await f.call(path(c.id,b.id),'PUT'));
  before=await snapshot(watched);
  expect((await f.member.api(path(a.id,c.id),'PUT')).status).toBe(400);
  expect(await snapshot(watched)).toEqual(before);
  // Cycle detection retains hidden intermediate edges as graph constraints.
  await body(await f.call(path(hidden.id,c.id),'PUT'));
  before=await snapshot(watched);
  expect((await f.call(path(a.id,hidden.id),'PUT')).status).toBe(400);
  expect(await snapshot(watched)).toEqual(before);
  await body(await f.call(path(hidden.id,c.id),'DELETE'));
  await body(await f.call(path(c.id,b.id),'DELETE'));
  await body(await f.call(path(b.id,a.id),'DELETE'));
  await body(await f.call(path(hidden.id,a.id),'PUT'));
  await body(await f.call(path(b.id,hidden.id),'PUT'));
  before=await snapshot(watched);
  const hiddenCycle=await f.member.api(path(a.id,b.id),'PUT');
  expect(hiddenCycle.status).toBe(400);
  expect(await hiddenCycle.text()).not.toContain(hidden.id);
  expect(await snapshot(watched)).toEqual(before);
  expect((await env.DB.prepare('PRAGMA foreign_key_check').all()).results).toEqual([]);
},120000);

it('populated project dependency upgrade preserves project and issue identities without manufacturing historical links or notices',async()=>{
  await provePopulatedUpgrade('0126_project_dependencies.sql',{
    added:['table project_dependencies','index project_dependencies_blocking_idx','trigger project_dependency_insert','trigger project_dependency_immutable','table project_notifications','index project_notifications_recipient_order'],
    changed:[],removed:[],
  },['projects','issues']);
  for(const table of ['project_dependencies','project_notifications'])
    expect(await env.DB.prepare('SELECT count(*) n FROM '+table).first<number>('n')).toBe(0);
},180000);
