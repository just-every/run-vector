import { mentionToken } from '../../src/core/features/notifications/mention-token';
import { apiCoverage } from '../../src/core/features/integrations/api-coverage';
import { z } from 'zod';
import * as planning from '../../src/core/features/administration/schema';
import { apiRoutes } from '../../src/core/features/integrations/api-schema';
import { tokenScopes } from '../../src/core/features/integrations/scopes';
import {env} from 'cloudflare:workers';
import {it,expect,vi,afterEach} from 'vitest';
afterEach(()=>vi.useRealTimers());
import {setupIntegrations} from './integration-fixture';
import {invite,actor,request,origin,bindings} from './base-auth-fixture';
import {createIntegrationApi} from '../../src/core/features/integrations/api';
it('[API-001 API-002 ISSUE-022] Base scoped token authority drives native routes, usage, stale writes and revocation without HTML or file admission',async()=>{
 vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(new Date());
 const f=await setupIntegrations(),read=await f.issueToken(['issues:read','metadata:read']),write=await f.issueToken(['issues:read','issues:write','comments:write']);
 expect((await f.api('', '/issues')).status).toBe(401);expect((await f.api('int_'+'a'.repeat(64),'/issues')).status).toBe(401);
 f.restart();
 expect((await f.api(read.token,'/metadata')).status).toBe(200);expect((await f.api(read.token,'/issues','POST',{teamId:f.initial.teams[0].id,title:'Denied'})).status).toBe(401);
 const created=await f.api(write.token,'/issues','POST',{teamId:f.initial.teams[0].id,title:'Native API issue',startDate:'2035-01-01',dueDate:'2035-01-10'});expect(created.status).toBe(201);const issue=await created.json() as {identifier:string;id:string;version:number};
 const before=(await env.DB.prepare('SELECT * FROM issues WHERE id=?').bind(issue.id).first());
 const readIssue=async()=>await (await f.api(read.token,'/issues/'+issue.identifier)).json() as any;
 expect(await readIssue()).toMatchObject({startDate:'2035-01-01',dueDate:'2035-01-10'});
 expect((await f.api(write.token,'/issues','POST',{teamId:f.initial.teams[0].id,title:'Invalid dates',startDate:'2035-01-11',dueDate:'2035-01-10'})).status).toBe(400);
 expect((await f.api(write.token,'/issues/'+issue.identifier,'PATCH',{expectedVersion:issue.version,startDate:'2035-01-11',title:'Must not change'})).status).toBe(400);
 expect((await f.api(write.token,'/issues/'+issue.identifier,'PATCH',{expectedVersion:issue.version,dueDate:'2034-12-31'})).status).toBe(400);
 expect(await env.DB.prepare('SELECT * FROM issues WHERE id=?').bind(issue.id).first()).toEqual(before);
 const filtered=await (await f.api(read.token,'/issues?start=range&startFrom=2035-01-01&startTo=2035-01-02&sort=start')).json() as any;
 expect(filtered.issues.map((row:any)=>({identifier:row.identifier,startDate:row.startDate}))).toEqual([{identifier:issue.identifier,startDate:'2035-01-01'}]);
 expect((await f.api(write.token,'/issues/'+issue.identifier,'PATCH',{expectedVersion:issue.version+1,title:'Stale'})).status).toBe(409);expect(await env.DB.prepare('SELECT * FROM issues WHERE id=?').bind(issue.id).first()).toEqual(before);
 expect((await f.api(write.token,'/issues/'+issue.identifier,'PATCH',{expectedVersion:issue.version,title:'Updated through native rule',startDate:'2035-01-02'})).status).toBe(200);
 expect((await readIssue()).activity.filter((entry:any)=>entry.kind==='issue.updated'&&entry.nextValue?.startDate==='2035-01-02')).toHaveLength(1);
 expect((await f.api(write.token,'/issues/'+issue.identifier+'/comments','POST',{body:'API comment'})).status).toBe(201);
 const day=new Date(),monday=new Date(day);monday.setUTCDate(day.getUTCDate()-(day.getUTCDay()+6)%7);
 const weekStart=monday.toISOString().slice(0,10),outsideWeek=new Date(monday);outsideWeek.setUTCDate(monday.getUTCDate()-1);
 const weekly=await (await f.api(write.token,'/issues','POST',{teamId:f.initial.teams[0].id,title:'Starts this week',startDate:weekStart})).json() as any;
 const other=await (await f.api(write.token,'/issues','POST',{teamId:f.initial.teams[0].id,title:'Starts last week',startDate:outsideWeek.toISOString().slice(0,10)})).json() as any;
 const thisWeek=await (await f.api(read.token,'/issues?start=this_week&sort=start')).json() as any;
 expect(thisWeek.issues.map((row:any)=>row.identifier)).toContain(weekly.identifier);
 expect(thisWeek.issues.map((row:any)=>row.identifier)).not.toContain(other.identifier);
 expect((await f.api(read.token,'/issues?workspaceId=spoof')).status).toBe(400);expect((await f.api(read.token,'/issues/'+issue.identifier)).status).toBe(200);
 // Foreign native records are test data only; the token cannot widen its issuer workspace.
 const foreignWorkspace='01K00000000000000000000110',foreignTeam='01K00000000000000000000111',foreignStatus='01K00000000000000000000112';
 await env.DB.batch([
  env.DB.prepare("INSERT INTO workspace_settings(id,name,timezone,created_at,updated_at) SELECT ?,'Other fixture workspace',timezone,created_at,updated_at FROM workspace_settings LIMIT 1").bind(foreignWorkspace),
  env.DB.prepare("INSERT INTO teams(id,workspace_id,name,identifier_prefix,created_at,updated_at) SELECT ?,?,'Other fixture team','OTH',created_at,updated_at FROM teams LIMIT 1").bind(foreignTeam,foreignWorkspace),
  env.DB.prepare("INSERT INTO workflow_statuses(id,team_id,name,category,position,created_at,updated_at) SELECT ?,?,name,category,position,created_at,updated_at FROM workflow_statuses WHERE category='backlog' LIMIT 1").bind(foreignStatus,foreignTeam),
  env.DB.prepare('UPDATE issues SET team_id=? WHERE id=?').bind(foreignTeam,issue.id),
 ]);
 // Exercise the real mounted API router against this otherwise unsupported
 // multi-workspace fixture, independently of installation bootstrap refusal.
 const router=createIntegrationApi(),foreign=(token:string,path:string,method='GET',body?:unknown)=>router.request(origin+path,{method,headers:{Authorization:'Bearer '+token,'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)},bindings);
 const foreignBefore=await env.DB.prepare('SELECT * FROM issues WHERE id=?').bind(issue.id).first();
 expect((await foreign(read.token,'/issues/'+issue.identifier)).status).toBe(404);
 expect((await foreign(write.token,'/issues/'+issue.identifier,'PATCH',{expectedVersion:issue.version+1,title:'Foreign mutation'})).status).toBe(404);
 expect((await foreign(write.token,'/issues/'+issue.identifier+'/comments','POST',{body:'Foreign comment'})).status).toBe(404);
 expect((await foreign(write.token,'/issues','POST',{teamId:foreignTeam,title:'Foreign creation'})).status).toBe(400);
 expect(await env.DB.prepare('SELECT * FROM issues WHERE id=?').bind(issue.id).first()).toEqual(foreignBefore);
 await env.DB.batch([env.DB.prepare('UPDATE issues SET team_id=? WHERE id=?').bind(f.initial.teams[0].id,issue.id),env.DB.prepare('DELETE FROM team_issue_history WHERE team_id=?').bind(foreignTeam),env.DB.prepare('DELETE FROM workflow_statuses WHERE id=?').bind(foreignStatus),env.DB.prepare('DELETE FROM teams WHERE id=?').bind(foreignTeam),env.DB.prepare('DELETE FROM workspace_settings WHERE id=?').bind(foreignWorkspace)]);
 const listed=await f.call('/settings/integrations');expect(listed.status).toBe(200);const text=await listed.text();expect(text.includes(read.token)||text.includes(write.token)).toBe(false);
 expect((await f.call('/settings/integrations/tokens/usage')).status).toBe(200);
 expect((await f.api(write.token,'/issues/'+issue.identifier,'DELETE')).status).toBe(404);
 expect((await f.app.request(origin+'/api/session',{headers:{Authorization:'Bearer '+write.token}},bindings)).status).toBe(401);
 await env.DB.prepare('CREATE TRIGGER deny_token_usage BEFORE INSERT ON integration_token_usage BEGIN SELECT RAISE(ABORT,\'usage failure\'); END').run();
 expect((await f.api(read.token,'/issues')).status).toBe(503);await env.DB.prepare('DROP TRIGGER deny_token_usage').run();expect((await f.api(read.token,'/issues')).status).toBe(200);
 const profile=await env.DB.prepare('SELECT token_id AS id FROM vector_integration_tokens WHERE name=? LIMIT 1').bind('Native API').first<{id:string}>();
 expect((await f.call('/settings/integrations/tokens/'+profile!.id,'DELETE')).status).toBe(200);expect((await f.api(read.token,'/issues')).status).toBe(401);
 await env.DB.prepare('UPDATE integration_tokens SET expires_at=1 WHERE token_hash IS NOT NULL').run();expect((await f.api(write.token,'/issues')).status).toBe(401);
 expect((await env.DB.prepare('PRAGMA foreign_key_check').all()).results).toEqual([]);
},180000);

it('[API-003] the versioned schema is published through the real app',async()=>{
 const f=await setupIntegrations();
 const response=await f.api('', '/schema');
 expect(response.status).toBe(200);
 const schema=await response.json() as any;
 expect(schema.openapi).toBe('3.1.0');
 for(const [path,method,validator] of [
  ['/projects','post',planning.projectCreateSchema.omit({createSlackChannel:true})],
  ['/projects/{id}','patch',planning.projectUpdateSchema],
  ['/projects/{id}/milestones','post',planning.projectMilestoneCreateSchema],
  ['/projects/{id}/milestones/{milestoneId}','patch',planning.projectMilestoneUpdateSchema],
  ['/projects/{id}/milestones/order','put',planning.projectMilestoneOrderSchema],
  ['/cycles','post',planning.cycleCreateSchema],
 ] as const){const generated=z.toJSONSchema(validator,{io:'input'});delete generated.$schema;expect(schema.paths[path][method].requestBody.content['application/json'].schema).toEqual(generated);}
 const mounted=f.app.routes.filter(r=>r.method!=='ALL'&&r.path.startsWith('/api/v1/')).map(r=>r.method+' '+r.path.slice('/api/v1'.length).replace(/:([A-Za-z]+)/g,'{$1}')).sort();
 expect(mounted).toEqual(apiRoutes.map(r=>r.method+' '+r.path).sort());
 const required='issues,comments,attachments,relations,labels,teams,workflow states,cycles,projects,milestones,initiatives,releases,documents,views,customers,customer requests,notifications,members'.split(',');
 const remainder:string[]=[];
 for(const name of required){
  const object=schema['x-object-coverage'][name];expect(object).toBeDefined();
  if(object.status==='not-built'){expect(object.clause).toMatch(/^[A-Z]+-\d{3}$/);remainder.push(name+': not built ('+object.clause+')');continue;}
  for(const operation of ['list','get','create','update','delete']){
   const entry=object.operations[operation];expect(entry).toBeDefined();
   if(entry.status==='owed'){expect(entry.reason.length).toBeGreaterThan(0);remainder.push(name+'.'+operation);continue;}
   expect(entry.routes.length).toBeGreaterThan(0);
   for(const ref of entry.routes){const [method,path]=ref.split(' '),route=schema.paths[path][method.toLowerCase()];expect(route['x-object']).toBe(name);expect(route['x-operation']).toBe(operation);if(operation==='list'){expect(route['x-pagination']).toBe('cursor');expect(route['x-filters'].length).toBeGreaterThan(0);}}
  }
 }
 const qualification=apiCoverage(schema);expect(qualification.complete).toBe(remainder.length===0);expect(qualification.missing.length+qualification.unbuilt.length).toBe(remainder.length);
 // A declared gap is reported, never disguised as an unsupported read-only operation.
 console.log('API-003 schema coverage: route inventory valid; OPEN remainder: '+remainder.join(', '));
});

it('[API-003 PROJ-011 ISSUE-008] public tokens page a native planning journey and enforce comment scopes, authorship, erasure and cursor invalidation',async()=>{
 const f=await setupIntegrations(),token=(await f.issueToken([...tokenScopes],'Planning journey')).token;
 const old=(await f.issueToken(['comments:write','projects:write'],'Existing scopes')).token;
 const call=async(path:string,method='GET',body?:unknown,status=200)=>{
  const response=await f.api(token,path,method,body);expect(response.status,await response.clone().text()).toBe(status);return await response.json() as any;
 };
 expect((await f.api('', '/unlisted')).status).toBe(404);
 for(const path of ['/comments','/cycles','/projects/00000000000000000000000000/milestones'])expect((await f.api(old,path)).status).toBe(401);
 const project=await call('/projects','POST',{name:'API planning',leadOperatorId:f.owner},201);
 const second=await call('/projects','POST',{name:'Second project',leadOperatorId:f.owner},201);
 const cycle=await call('/cycles','POST',{teamId:f.initial.teams[0].id,name:'API cycle',startsLocal:'2027-04-01T09:00',endsLocal:'2027-04-15T09:00'},201);
 const milestone=await call('/projects/'+project.id+'/milestones','POST',{name:'API milestone'},201);
 await call('/projects/'+project.id+'/milestones','POST',{name:'Next milestone'},201);
 const issues=[];
 for(let i=0;i<3;i++)issues.push(await call('/issues','POST',{teamId:f.initial.teams[0].id,title:'API journey '+i,projectId:project.id,cycleId:cycle.cycle.id,milestoneId:milestone.id},201));
 const pages=async(path:string,key:string)=>{
  const ids:string[]=[];let cursor:string|null=null;let total:number|undefined;
  do{const page=await call(path+(path.includes('?')?'&':'?')+'limit=1'+(cursor?'&cursor='+encodeURIComponent(cursor):''));total??=page.total;expect(page.total).toBe(total);expect(page[key]).toHaveLength(1);ids.push(page[key][0].id);cursor=page.nextCursor;}while(cursor);
  expect(new Set(ids).size).toBe(ids.length);expect(ids.length).toBe(total);return ids;
 };
 expect(await pages('/issues?project='+project.id,'issues')).toEqual(issues.map(i=>i.id).reverse());
 expect(await pages('/projects','projects')).toEqual([project.id,second.id]);
 expect(await pages('/cycles?team='+f.initial.teams[0].id,'cycles')).toEqual([cycle.cycle.id]);
 expect((await pages('/projects/'+project.id+'/milestones','milestones')).length).toBe(2);
 const first=await call('/issues?project='+project.id+'&limit=1');
 expect((await f.api(token,'/issues?project='+second.id+'&limit=1&cursor='+encodeURIComponent(first.nextCursor))).status).toBe(409);
 const issue=issues[0];
 expect((await f.api(token,'/issues/'+issue.identifier,'PATCH',{expectedVersion:999,title:'stale'})).status).toBe(409);
 await call('/issues/'+issue.identifier,'PATCH',{expectedVersion:issue.version,title:'Changed ordering'});
 expect((await f.api(token,'/issues?project='+project.id+'&limit=1&cursor='+encodeURIComponent(first.nextCursor))).status).toBe(409);
 const pp=await call('/projects?limit=1');await call('/projects/'+second.id,'PATCH',{name:'A first'});
 expect((await f.api(token,'/projects?limit=1&cursor='+encodeURIComponent(pp.nextCursor))).status).toBe(409);
 const comment=await call('/issues/'+issue.identifier+'/comments','POST',{body:'Stable API body'},201);
 await call('/issues/'+issue.identifier+'/comments','POST',{body:'Second API body'},201);
 const read=await call('/comments/'+comment.id);
 expect(read).toEqual({id:comment.id,issueIdentifier:issue.identifier,body:'Stable API body',version:0,author:{id:f.owner,displayName:'Owner'},createdAt:expect.any(String),editedAt:null,url:origin+'/app/issues/'+issue.identifier,maxBodyLength:100000,truncated:false});
 expect((await pages('/comments?issue='+issue.identifier,'comments')).length).toBe(2);
 expect((await call('/comments?createdFrom=2099-01-01T00%3A00%3A00Z')).comments).toEqual([]);
 expect((await f.api(old,'/comments/'+comment.id,'PATCH',{body:'Scope denied'})).status).toBe(401);
 const peerCookie=await invite('peer@base.test',f.cookie),peer=await actor(peerCookie);
 const minted=await request('/api/settings/integrations/tokens','POST',{name:'Peer',scopes:['comments:read','comments:edit','comments:write']},peerCookie);expect(minted.status).toBe(201);
 const peerToken=(await minted.json() as any).token;
 expect((await f.api(peerToken,'/comments/'+comment.id,'PATCH',{body:'Another author'})).status).toBe(403);
 const cp=await call('/comments?issue='+issue.identifier+'&limit=1');
 expect((await f.api(peerToken,'/comments?issue='+issue.identifier+'&limit=1&cursor='+encodeURIComponent(cp.nextCursor))).status).toBe(409);
 await call('/comments/'+comment.id,'PATCH',{body:'Edited body',expectedVersion:read.version});
 expect((await call('/comments/'+comment.id)).editedAt).not.toBeNull();
 expect((await f.api(token,'/comments?issue='+issue.identifier+'&limit=1&cursor='+encodeURIComponent(cp.nextCursor))).status).toBe(409);
 const peerCommentResponse=await f.api(peerToken,'/issues/'+issue.identifier+'/comments','POST',{body:'Retained author history'});expect(peerCommentResponse.status).toBe(201);
 const peerComment=await peerCommentResponse.json() as any;
 const removed=await f.call('/settings/operators/'+peer,'DELETE');expect(removed.status,await removed.clone().text()).toBe(200);
 expect((await f.api(peerToken,'/comments')).status).toBe(401);
 expect((await call('/comments/'+peerComment.id)).author).toEqual({id:peer,displayName:'Removed operator'});
 await call('/comments/'+comment.id,'DELETE',{expectedVersion:(await call('/comments/'+comment.id)).version});expect((await f.api(token,'/comments/'+comment.id)).status).toBe(404);
 expect((await call('/comments?issue='+issue.identifier)).comments.some((c:any)=>c.id===comment.id)).toBe(false);
 await call('/projects/'+project.id+'/milestones/'+milestone.id,'PATCH',{completed:true});
 expect((await call('/projects/'+project.id+'/milestones/'+milestone.id)).completed).toBe(true);
 await call('/projects/'+project.id+'/milestones/'+milestone.id,'DELETE');
 for(const value of issues)expect((await call('/issues/'+value.identifier)).milestoneId).toBeNull();
 expect((await f.api(old,'/projects/'+second.id,'DELETE')).status).toBe(401);
 await call('/projects/'+second.id,'DELETE');expect((await f.api(token,'/projects/'+second.id)).status).toBe(404);
 expect((await env.DB.prepare('PRAGMA foreign_key_check').all()).results).toEqual([]);
},180000);

it('[API-003 ISSUE-008] stale and missing comment revisions refuse edit/delete with unchanged storage',async()=>{
 const f=await setupIntegrations(),token=(await f.issueToken([...tokenScopes],'Comment revisions')).token;
 const peer=await actor(await invite('revision-peer@base.test',f.cookie));
 const call=async(path:string,method='GET',body?:unknown,status=200)=>{
  const response=await f.api(token,path,method,body);expect(response.status,await response.clone().text()).toBe(status);return await response.json() as any;
 };
 const issue=await call('/issues','POST',{teamId:f.initial.teams[0].id,title:'Revision refusal'},201);
 const comment=await call('/issues/'+issue.identifier+'/comments','POST',{body:'Original'},201),path='/comments/'+comment.id;
 const original=await call(path);
 const body='- [ ] Review\n\n'+mentionToken({id:peer,name:'Revision peer'});
 await call(path,'PATCH',{body,expectedVersion:original.version});
 const edited=await call(path);expect(edited.version).toBe(original.version+1);
 // Native full-body edits, even identical text, and checklist edits invalidate API revisions too.
 expect((await f.call('/issues/'+issue.identifier+'/comments/'+comment.id,'PATCH',{body})).status).toBe(200);
 const native=await call(path);expect(native.version).toBe(edited.version+1);
 expect((await f.call('/issues/'+issue.identifier+'/comments/'+comment.id+'/checklist','POST',{expectedBody:body,index:0,text:'Review',checked:true})).status).toBe(200);
 const current=await call(path);expect(current.version).toBe(native.version+1);
 expect((await call('/comments?issue='+issue.identifier)).comments[0]).toEqual(current);
 expect((await f.call('/issues/'+issue.identifier+'/links','POST',{name:'Retained comment link',url:'https://example.test/review',commentId:comment.id})).status).toBe(201);
 // Compare all application tables, including history, search/counters, links,
 // followers, mentions, notifications and delivery queues. Only API request
 // usage and rate-limit accounting may advance on a refused write.
 const tables=(await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT GLOB '_cf_*' AND name NOT IN ('integration_token_usage','access_rate_limits') ORDER BY name").all<{name:string}>()).results;
 const storage=async()=>Object.fromEntries(await Promise.all(tables.map(async({name})=>[name,(await env.DB.prepare('SELECT * FROM "'+name.replaceAll('"','""')+'"').all()).results.map(row=>JSON.stringify(row)).sort()])));
 const before=await storage();
 for(const [method,input,status] of [
  ['PATCH',{body:'Stale replacement',expectedVersion:original.version},409],
  ['DELETE',{expectedVersion:native.version},409],
  ['PATCH',{body:'Missing revision'},400],
  ['DELETE',{},400],
 ] as const){
  await call(path,method,input,status);
  expect(await call(path)).toEqual(current);
  expect(await storage()).toEqual(before);
 }
 // A fresh revision still permits the author to edit and delete normally.
 await call(path,'PATCH',{body:'Fresh replacement',expectedVersion:current.version});
 const fresh=await call(path);expect(fresh.body).toBe('Fresh replacement');expect(fresh.version).toBe(current.version+1);
 await call(path,'DELETE',{expectedVersion:fresh.version});
 expect((await f.api(token,path)).status).toBe(404);
 expect((await call('/comments?issue='+issue.identifier)).comments).toEqual([]);
 expect((await env.DB.prepare('PRAGMA foreign_key_check').all()).results).toEqual([]);
},180000);

it('[API-003 ISSUE-008] concurrent same-revision comment edits commit exactly one body and its effects',async()=>{
 const f=await setupIntegrations(),token=(await f.issueToken([...tokenScopes],'Concurrent comments')).token;
 const peer=await actor(await invite('concurrent-peer@base.test',f.cookie));
 const issueResponse=await f.api(token,'/issues','POST',{teamId:f.initial.teams[0].id,title:'Concurrent revisions'});expect(issueResponse.status).toBe(201);
 const issue=await issueResponse.json() as any;
 const created=await f.api(token,'/issues/'+issue.identifier+'/comments','POST',{body:'Original'});expect(created.status).toBe(201);
 const {id}=await created.json() as any,path='/comments/'+id;
 const read=await f.api(token,path);expect(read.status).toBe(200);const original=await read.json() as any;
 const bodies=['First '+mentionToken({id:peer,name:'Peer'}),'Second '+mentionToken({id:peer,name:'Peer'})];
 const replies=await Promise.all(bodies.map(body=>f.api(token,path,'PATCH',{body,expectedVersion:original.version})));
 expect(replies.map(r=>r.status).sort()).toEqual([200,409]);
 const final=await f.api(token,path);expect(final.status).toBe(200);const current=await final.json() as any;
 expect(current.body).toBe(bodies[replies.findIndex(r=>r.status===200)]);expect(current.version).toBe(original.version+1);
 const edits=(await env.DB.prepare("SELECT id FROM issue_activity WHERE issue_id=? AND kind='comment.edited'").bind(issue.id).all<{id:string}>()).results;
 expect(edits).toHaveLength(1);
 expect((await env.DB.prepare("SELECT id FROM audit_records WHERE subject_id=? AND action='comment.edited'").bind(id).all()).results).toHaveLength(1);
 expect((await env.DB.prepare('SELECT event_id FROM notification_events WHERE event_id=?').bind(edits[0].id).all()).results).toHaveLength(1);
 expect((await env.DB.prepare('SELECT id FROM notifications WHERE event_id=? AND recipient_id=?').bind(edits[0].id,peer).all()).results).toHaveLength(1);
 expect((await env.DB.prepare('PRAGMA foreign_key_check').all()).results).toEqual([]);
},180000);
