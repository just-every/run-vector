import {env} from 'cloudflare:workers';
import {it,expect} from 'vitest';
import {Hono} from 'hono';
import {createApiApp} from '../../src/core/app/api';
import {beforeBatch} from './administration-fixture';
import {actor,bindings,invite,request,origin} from './base-auth-fixture';
import {bitbucketFixture,bitbucketBody,bitbucketSnapshot,bitbucketTables,bitbucketIdentity} from './bitbucket-fixture';
import {exerciseBitbucketArchive} from './bitbucket-archive-scenario';

it('signed Bitbucket PRs use configured team rules with durable links, follower Inbox and unchanged refused storage',async()=>{
 const f=await bitbucketFixture(),team=f.initial.teams[0];
 const started=team.statuses.find(status=>status.category==='started')!,done=team.statuses.find(status=>status.category==='completed')!;
 for(const [trigger,status] of [['review',started.id],['merged',done.id]])expect((await f.call('/settings/teams/'+team.id,'PATCH',{githubAutomation:{trigger,statusId:status,allowReopen:false,expectedVersion:0}})).status).toBe(200);
 const issue=await f.create({title:'synthetic-vector-187 target'}),opened=bitbucketBody(issue.identifier),merged=bitbucketBody(issue.identifier,'MERGED','2026-10-01T02:00:00.000Z');
 const read=async()=>(await(await f.call('/issues/'+issue.identifier)).json()) as {status:{id:string};version:number;activity:{kind:string;actor:string}[]};
 const initial=await bitbucketSnapshot();
 for(const response of [await f.send(opened,crypto.randomUUID(),{},true),await f.send({...opened,repository:{...opened.repository,uuid:'{33333333-3333-4333-8333-333333333187}'}}),await f.send({...opened,pullrequest:{...opened.pullrequest,destination:{repository:{...opened.repository,full_name:'synthetic-vector-187/foreign'}}}}),await f.send({...opened,pullrequest:{...opened.pullrequest,links:{html:{href:'https://untrusted.invalid/pr/17'}}}}),await f.send(opened,crypto.randomUUID(),{},false,'pullrequest:fulfilled')])expect([400,401]).toContain(response.status);
 expect(await bitbucketSnapshot()).toBe(initial);
 const delivery=crypto.randomUUID(),accepted=await f.send(opened,delivery);expect(accepted.status,await accepted.clone().text()).toBe(200);
 expect((await read()).status.id).toBe(started.id);
 const first=await bitbucketSnapshot();
 expect((await f.send(opened,delivery)).status).toBe(200);f.restart();expect((await f.send(opened,delivery)).status).toBe(200);
 expect((await f.send({...opened,pullrequest:{...opened.pullrequest,title:'Changed '+issue.identifier}},delivery)).status).toBe(409);
 expect(await bitbucketSnapshot()).toBe(first);
 const mergeDelivery=crypto.randomUUID(),raced=await Promise.all([f.send(merged,mergeDelivery),f.send(merged,mergeDelivery)]);
 expect(raced.map(response=>response.status)).toEqual([200,200]);
 const finished=await read();expect(finished.status.id).toBe(done.id);
 expect(finished.activity.filter(row=>row.kind==='issue.status_changed'&&row.actor==='Bitbucket automation')).toHaveLength(2);
 expect(finished.activity.filter(row=>row.kind==='bitbucket.pr_linked')).toHaveLength(1);
 const notices=(await env.DB.prepare('SELECT actor_id,actor_name,recipient_id,causes_json FROM notifications WHERE issue_id=? ORDER BY created_at,id').bind(issue.id).all()).results;
 expect(notices).toHaveLength(2);expect(notices.every(row=>row.actor_id===null&&row.actor_name==='Bitbucket automation'&&row.recipient_id===f.owner)).toBe(true);
 expect(notices.map(row=>JSON.parse(String(row.causes_json)))).toEqual(expect.arrayContaining([['status'],['completed']]));
 const inbox=await f.call('/notifications');expect(inbox.status).toBe(200);expect(await inbox.text()).toContain(issue.identifier);
 const link=await f.call('/issues/'+issue.identifier+'/bitbucket');expect(link.status).toBe(200);expect(await link.json()).toEqual({pullRequests:[{repository:bitbucketIdentity.repository,number:17,title:'Fixes '+issue.identifier,url:opened.pullrequest.links.html.href,state:'MERGED',updatedAt:merged.pullrequest.updated_on}]});
 // New request UUIDs and older provider states cannot repeat status transitions.
 expect((await f.send(merged)).status).toBe(200);expect((await f.send(opened)).status).toBe(200);
 expect((await f.send(bitbucketBody(issue.identifier,'OPEN','2026-10-03T00:00:00.000Z'))).status).toBe(200);
 expect((await read()).version).toBe(finished.version);expect((await read()).status.id).toBe(done.id);
 const conflicting=bitbucketBody(issue.identifier,'OPEN',merged.pullrequest.updated_on);expect((await f.send(conflicting)).status).toBe(200);
 expect((await read()).version).toBe(finished.version);
 // A receipt failure rolls back link, move, notices and activity together.
 const rollback=await f.create({title:'synthetic-vector-188 rollback'}),beforeRollback=await bitbucketSnapshot();
 await env.DB.prepare("CREATE TRIGGER refuse_bitbucket_receipt BEFORE INSERT ON vector_bitbucket_deliveries BEGIN SELECT RAISE(ABORT,'synthetic-vector-187'); END").run();
 try{expect((await f.send(bitbucketBody(rollback.identifier,'OPEN','2026-10-02T00:00:00.000Z',18))).status).toBe(503);}finally{await env.DB.prepare('DROP TRIGGER refuse_bitbucket_receipt').run();}
 expect(await bitbucketSnapshot()).toBe(beforeRollback);
 // Current reader authority hides private links after membership withdrawal.
 const email='synthetic-vector-187'+bindings.FIRST_OWNER_EMAIL!.slice(bindings.FIRST_OWNER_EMAIL!.indexOf('@')),memberCookie=await invite(email,f.cookie),member=await actor(memberCookie);
 expect((await f.call('/settings/teams/'+team.id+'/members/'+member,'PUT',{role:'member'})).status).toBe(200);
 expect((await request('/api/issues/'+issue.identifier+'/bitbucket','GET',undefined,memberCookie)).status).toBe(200);
 expect((await f.call('/settings/teams/'+team.id+'/privacy','PUT',{isPrivate:true})).status).toBe(200);
 expect((await f.call('/settings/teams/'+team.id+'/members/'+member,'DELETE')).status).toBe(200);
 const privateBefore=await bitbucketSnapshot();
 const hidden=await request('/api/issues/'+issue.identifier+'/bitbucket','GET',undefined,memberCookie);expect(hidden.status).toBe(404);expect(await hidden.text()).not.toContain('Fixes');
 expect(await bitbucketSnapshot()).toBe(privateBefore);
 // Members, invited Guests and Viewers cannot manage workspace connections.
 for(const role of ['member','guest','viewer']){
  if(role!=='member')expect((await f.call('/settings/operators/'+member+'/role','PATCH',{role,...(role==='guest'?{teamIds:[team.id]}:{})})).status).toBe(200);
  const before=await bitbucketSnapshot();
  for(const [path,method,body] of [['/settings/integrations/bitbucket','GET',undefined],['/settings/integrations/bitbucket','POST',{name:'synthetic-vector-189',...bitbucketIdentity}],['/settings/integrations/bitbucket/'+f.config.id,'DELETE',undefined],['/settings/integrations/bitbucket/'+f.config.id+'/reenter','POST',{}]] as const)expect((await request('/api'+path,method,body,memberCookie)).status).toBe(403);
  expect(await bitbucketSnapshot()).toBe(before);
 }
 expect((await f.call('/settings/operators/'+member+'/role','PATCH',{role:'admin'})).status).toBe(200);
 expect((await request('/api/settings/integrations/bitbucket','GET',undefined,memberCookie)).status).toBe(200);
 // Workspace-scoped admin reads cannot discover another workspace's connection.
 const workspace=(await env.DB.prepare('SELECT workspace_id FROM operators WHERE id=?').bind(member).first<string>('workspace_id'))!,foreign='01K00000000000000000000187';
 await env.DB.prepare("INSERT INTO workspace_settings(id,name,timezone,created_at,updated_at) SELECT ?,'synthetic-vector-189',timezone,created_at,updated_at FROM workspace_settings WHERE id=?").bind(foreign,workspace).run();
 await env.DB.prepare('UPDATE operators SET workspace_id=? WHERE id=?').bind(foreign,member).run();
 try{const app=new Hono().route('/api',createApiApp());const response=await app.request(origin+'/api/settings/integrations/bitbucket',{headers:{Cookie:memberCookie,Origin:origin,host:new URL(origin).host}},bindings);expect(response.status).toBe(200);expect(await response.json()).toEqual({repositories:[]});}finally{await env.DB.prepare('UPDATE operators SET workspace_id=? WHERE id=?').bind(workspace,member).run();await env.DB.prepare('DELETE FROM workspace_settings WHERE id=?').bind(foreign).run();}
 // Deletion retains replay custody without retaining or recreating the issue link.
 const erased=await f.create({title:'synthetic-vector-190 erasure'}),eraseBody=bitbucketBody(erased.identifier,'OPEN','2026-10-04T00:00:00.000Z',19),eraseDelivery=crypto.randomUUID();
 expect((await f.send(eraseBody,eraseDelivery)).status).toBe(200);
 const eraseCurrent=await(await f.call('/issues/'+erased.identifier)).json() as {version:number};
 expect((await f.call('/issues/'+erased.identifier,'DELETE',{confirmed:true,expectedVersion:eraseCurrent.version})).status).toBe(200);
 const erasedSnapshot=await bitbucketSnapshot();expect((await f.send(eraseBody,eraseDelivery)).status).toBe(200);expect(await bitbucketSnapshot()).toBe(erasedSnapshot);
 expect(await env.DB.prepare('SELECT count(*) n FROM vector_bitbucket_issue_links WHERE issue_id=?').bind(erased.id).first<number>('n')).toBe(0);
 expect((await f.call('/issues/'+erased.identifier+'/bitbucket')).status).toBe(404);
 await exerciseBitbucketArchive(f,opened,delivery);
 const beforeRevocation=await bitbucketSnapshot(env.DB,bitbucketTables.filter(name=>name!=='vector_bitbucket_repositories'&&name!=='audit_records'));
 const intercepted=beforeBatch(async()=>{expect((await f.call('/settings/integrations/bitbucket/'+f.config.id,'DELETE')).status).toBe(200);});
 expect((await f.send(bitbucketBody(rollback.identifier,'OPEN','2026-10-02T00:00:00.000Z',18),crypto.randomUUID(),{DB:intercepted})).status).toBe(401);
 expect(await bitbucketSnapshot(env.DB,bitbucketTables.filter(name=>name!=='vector_bitbucket_repositories'&&name!=='audit_records'))).toBe(beforeRevocation);
 const revoked=await bitbucketSnapshot();expect((await f.send(merged,mergeDelivery)).status).toBe(401);expect(await bitbucketSnapshot()).toBe(revoked);
 expect((await env.DB.prepare('PRAGMA foreign_key_check').all()).results).toEqual([]);
 console.log('PROBE BITBUCKET-001 opened: signed native receiver -> configured started status, provider-labelled link, attributed activity and one eligible follower notice');
 console.log('PROBE BITBUCKET-001 merged: signed native receiver -> configured completion and once-only follower Inbox; replay, stale, conflict, rollback, private withdrawal and revoked receiver fences pass');
},180000);
