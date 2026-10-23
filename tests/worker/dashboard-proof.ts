import {env} from 'cloudflare:workers';
import {expect} from 'vitest';
import {request,invite} from './base-auth-fixture';
import type {closureFixture} from './cycle-closure-fixture';
import {dashboardReadSchema,dashboardSchema} from '../../src/core/features/dashboards/schema';
export async function exerciseDashboards(f:Awaited<ReturnType<typeof closureFixture>>,member:string,memberId:string,identifiers:string[]) {
 const memberCall=(path:string,method='GET',body?:unknown)=>request('/api'+path,method,body,member);
 for(const [index,date] of ['2026-11-01','2026-11-03'].entries()){
  const issue=await(await f.call('/issues/'+identifiers[index])).json() as {version:number};
  expect((await f.call('/issues/'+identifiers[index],'PATCH',{expectedVersion:issue.version,dueDate:date})).status).toBe(200);
 }
 const made=await memberCall('/issues','POST',{teamId:f.team.id,title:'synthetic-vector-30',dueDate:'2026-11-01',statusId:f.team.statuses.find(s=>s.category==='completed')!.id});expect(made.status).toBe(201);const own=await made.json() as {identifier:string};
 const input={name:'synthetic-vector-31',isShared:false,teamId:null,widgets:['chart','count','list'].map(kind=>({name:kind,kind,filters:{q:'synthetic-vector-',team:f.team.id,scope:'created',category:'completed'},chart:{metric:'throughput'}}))};
 const created=await f.call('/dashboards','POST',input);expect(created.status).toBe(201);const dashboard=dashboardSchema.parse(await created.json());
 const path='/dashboards/'+dashboard.id;
 expect((await memberCall(path)).status).toBe(404);
 const ownerRead=dashboardReadSchema.parse(await(await f.call(path)).json());
 expect(ownerRead.results.map(r=>r.count)).toEqual([4,4,4]);
 expect(ownerRead.results[2].issues.map(i=>i.identifier).sort()).toEqual([...identifiers].sort());
 const share=await f.call(path,'PUT',{...input,isShared:true,expectedVersion:1});expect(share.status).toBe(200);
 const viewed=dashboardReadSchema.parse(await(await memberCall(path)).json());
 expect(viewed.results.map(r=>r.count)).toEqual([1,1,1]);
 expect(viewed.results[0].report?.rows.map(r=>r.count)).toEqual([1]);
 const csv=await request(viewed.results[0].csvHref,'GET',undefined,member);expect(csv.status).toBe(200);expect(await csv.text()).toContain('Completed');
 expect(viewed.results[2].issues.map(i=>i.identifier)).toEqual([own.identifier]);
 const full=await memberCall(viewed.results[2].href.replace('/app',''));expect(full.status).toBe(200);expect((await full.json() as {issues:{identifier:string}[]}).issues.map(i=>i.identifier)).toEqual([own.identifier]);
 const dated=dashboardReadSchema.parse(await(await memberCall(path+'?from=2026-11-02&to=2026-11-05')).json());expect(dated.results.map(r=>r.count)).toEqual([0,0,0]);
 const ownerDated=dashboardReadSchema.parse(await(await f.call(path+'?from=2026-11-01&to=2026-11-01')).json());expect(ownerDated.results.map(r=>r.count)).toEqual([1,1,1]);
 const other=dashboardReadSchema.parse(await(await memberCall(path+'?team='+f.initial.teams[0].id)).json());expect(other.results.map(r=>r.count)).toEqual([0,0,0]);
 expect((await memberCall(path,'PUT',{...input,expectedVersion:2})).status).toBe(403);
 expect((await f.call(path,'PUT',{...input,expectedVersion:1})).status).toBe(409);
 expect((await memberCall(path,'DELETE',{expectedVersion:2})).status).toBe(403);
 expect((await memberCall('/dashboards','POST',{...input,teamId:f.team.id,isShared:true})).status).toBe(403);
 const admin=await invite('synthetic-vector-32@example.test',f.cookie,'admin');
 const renamed=await request('/api'+path,'PUT',{...input,name:'synthetic-vector-33',isShared:true,expectedVersion:2},admin);expect(renamed.status).toBe(200);
 expect(dashboardSchema.parse(await renamed.json()).name).toBe('synthetic-vector-33');
 const stored=(await env.DB.prepare('SELECT definition_json FROM dashboard_widgets WHERE dashboard_id=? ORDER BY position').bind(dashboard.id).all<{definition_json:string}>()).results;
 expect(stored).toHaveLength(3);expect(stored.every(w=>!('results' in JSON.parse(w.definition_json))&&!('issues' in JSON.parse(w.definition_json))&&!('count' in JSON.parse(w.definition_json)))).toBe(true);
 const mine=await memberCall('/dashboards','POST',{...input,name:'synthetic-vector-34'});expect(mine.status).toBe(201);const mineRow=dashboardSchema.parse(await mine.json());expect(mineRow.creatorId).toBe(memberId);
 expect((await memberCall('/dashboards/'+mineRow.id,'DELETE',{expectedVersion:1})).status).toBe(200);
 expect((await memberCall('/dashboards/'+mineRow.id)).status).toBe(404);
 return dashboard.id;
}
