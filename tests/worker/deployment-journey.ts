import {env} from 'cloudflare:workers';
import {expect} from 'vitest';
import {setupIntegrations} from './integration-fixture';
import {bindings,origin,request,invite,actor} from './base-auth-fixture';
import {sampleOwner} from './sample-auth-fixture';
import {provePopulatedUpgrade} from './populated-upgrade';
import {createVectorArchive} from '../../src/core/features/data/archive-service.mjs';
import {readArchive} from '@runeditrun/rer/modules/portability';
import {applyD1Migrations,reset} from 'cloudflare:test';
import {inject} from 'vitest';
import {nativeTargets} from '../../src/core/features/data/import/native-targets';

/** One mounted journey covers reporting, admission, durability and portable history. */
export async function deploymentJourney(){
 // This journey crosses a historical schema and restores a second database.
 // Reset only the test runtime so the existing API registrations keep fresh fixtures.
 await reset();
 try{await runDeploymentJourney();}finally{await reset();}
}
async function runDeploymentJourney(){
 await provePopulatedUpgrade('0126_workers_deployments.sql',{
  added:['table vector_deployment_reports','table vector_issue_deployments','index vector_deployment_issue','index sqlite_autoindex_vector_deployment_reports_1','index sqlite_autoindex_vector_deployment_reports_2','index sqlite_autoindex_vector_issue_deployments_1'].filter(id=>!id.includes('sqlite_autoindex')),
  removed:[],until:'0126_workers_deployments.sql',
 });
 await invite(bindings.FIRST_OWNER_EMAIL!,await sampleOwner(),'owner');
 const f=await setupIntegrations(),team=f.initial.teams[0];
 const first=await f.create({title:'synthetic-vector-18001 exact merge'}),second=await f.create({title:'synthetic-vector-18002 ancestry merge'}),unmerged=await f.create({title:'synthetic-vector-18003 unmerged work'});
 const res=await f.call('/settings/integrations/github','POST',{name:'synthetic-vector-18004',repository:'synthetic-vector-18004/source'});expect(res.status).toBe(201);
 const repository=await res.json() as {id:string;secret:string;receiver:string};
 const otherRes=await f.call('/settings/integrations/github','POST',{name:'synthetic-vector-18005',repository:'synthetic-vector-18005/source'});expect(otherRes.status).toBe(201);const other=await otherRes.json() as {id:string};
 const send=async(body:unknown,event='pull_request')=>{
  const text=JSON.stringify(body),key=await crypto.subtle.importKey('raw',new TextEncoder().encode(repository.secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const signed=new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(text)));
  const response=await f.app.request(repository.receiver,{method:'POST',headers:{'Content-Type':'application/json','X-Hub-Signature-256':'sha256='+[...signed].map(n=>n.toString(16).padStart(2,'0')).join(''),'X-GitHub-Event':event,'X-GitHub-Delivery':crypto.randomUUID()},body:text},bindings);
  expect(response.status,await response.clone().text()).toBe(200);return response.json();
 };
 const sha=(n:number)=>n.toString(16).padStart(40,'0');
 for(const [index,issue] of [first,second,unmerged].entries())await send({action:index===2?'opened':'closed',number:index+1,repository:{full_name:'synthetic-vector-18004/source'},pull_request:{number:index+1,title:'Fixes '+issue.identifier,body:null,state:index===2?'open':'closed',merged:index!==2,merge_commit_sha:index===2?null:sha(index+1),head:{ref:issue.identifier.toLowerCase(),sha:sha(index+1)},updated_at:'2026-10-01T12:00:00.000Z',html_url:'https://github.com/synthetic-vector-18004/source/pull/'+(index+1)}});
 const push=(before:string,after:string,forced?:boolean)=>({ref:'refs/heads/main',before,after,...(forced===undefined?{}:{forced}),repository:{full_name:'synthetic-vector-18004/source',default_branch:'main'},commits:[]});
 await send(push(sha(2),sha(4),false),'push');await send(push(sha(4),sha(5),false),'push');
 await send(push(sha(1),sha(6),true),'push');await send(push(sha(1),sha(7)),'push');
 expect((await f.call('/settings/teams/'+team.id+'/statuses','POST',{name:'synthetic-vector-18006 Shipped',category:'completed'})).status).toBe(200);
 const shipped=(await f.state()).teams.find(t=>t.id===team.id)!.statuses.find(s=>s.name==='synthetic-vector-18006 Shipped')!;
 expect((await f.call('/settings/teams/'+team.id,'PATCH',{githubAutomation:{trigger:'deploy',statusId:shipped.id,allowReopen:false,expectedVersion:0,environment:'live'}})).status).toBe(200);
 const token=await f.issueToken(['deployments:write'],'synthetic-vector-18007');
 const legacy=await f.issueToken(['issues:write','metadata:read'],'synthetic-vector-18008');
 const report=(deploymentId:string,commit=sha(1),environment='staging')=>({provider:'cloudflare-workers',repositoryId:repository.id,accountId:'synthetic-vector-18009',workerId:'synthetic-vector-18010',deploymentId,sha:commit,environment,state:'success',deployedAt:'2026-10-11T14:15:16+02:00'});
 const post=async(body:unknown,bearer=token.token,status=200,overrides={})=>{const response=await f.api(bearer,'/deployments','POST',body,overrides);expect(response.status,await response.clone().text()).toBe(status);return response.json() as Promise<any>;};
 const detail=async(issue=first)=>{const response=await f.call('/issues/'+issue.identifier);expect(response.status).toBe(200);return response.json() as Promise<any>;};
 const tables=(await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT GLOB '_cf_*' AND name NOT IN('integration_token_usage','access_rate_limits') ORDER BY name").all<{name:string}>()).results;
 const storage=async()=>Object.fromEntries(await Promise.all(tables.map(async({name})=>[name,(await env.DB.prepare('SELECT * FROM "'+name+'"').all()).results.map(r=>JSON.stringify(r)).sort()])));
 const refused=async(body:unknown,bearer:string,status:number)=>{const before=await storage();await post(body,bearer,status);expect(await storage()).toEqual(before);};
 const initial=await detail();
 const staging=report('synthetic-vector-18011');const receipt=await post(staging);expect(receipt).toMatchObject({reused:false,linked:1});
 const afterStaging=await detail();expect(afterStaging.version).toBe(initial.version);expect(afterStaging.status.id).toBe(initial.status.id);
 expect(afterStaging.deployments).toContainEqual({provider:'cloudflare-workers',repository:'synthetic-vector-18004/source',accountId:staging.accountId,workerId:staging.workerId,deploymentId:staging.deploymentId,sha:sha(1),environment:'staging',deployedAt:'2026-10-11T12:15:16.000Z'});
 const publicProjection=await f.call('/issues/'+first.identifier+'/github');expect((await publicProjection.json() as any).deployments).toEqual(afterStaging.deployments);
 const production=report('synthetic-vector-18012',sha(1),'LiVe');expect(await post(production)).toMatchObject({linked:1,reused:false});
 const deployed=await detail();expect(deployed.status.id).toBe(shipped.id);expect(deployed.version).toBe(initial.version+1);
 expect(deployed.activity.filter((a:any)=>a.kind==='issue.status_changed'&&a.nextValue?.trigger==='deploy')).toHaveLength(1);
 const stable=await storage();expect(await post(production)).toMatchObject({reused:true,linked:1});f.restart();expect(await post(production)).toMatchObject({reused:true,linked:1});expect(await storage()).toEqual(stable);
 for(const change of [{sha:sha(2)},{environment:'production'},{deployedAt:'2026-10-12T12:00:00.000Z'}])await refused({...production,...change},token.token,409);
 const ancestry=report('synthetic-vector-18013',sha(5),'live');expect(await post(ancestry)).toMatchObject({linked:1});expect((await detail(second)).status.id).toBe(shipped.id);expect((await detail(second)).deployments[0]).toMatchObject({sha:sha(5),environment:'live',provider:'cloudflare-workers'});
 for(const commit of [sha(3),sha(6),sha(7),sha(8)])expect(await post(report('synthetic-vector-18014-'+commit.slice(-1),commit,'live'))).toMatchObject({linked:0});
 expect((await detail(unmerged)).deployments).toEqual([]);expect((await detail()).deployments).toHaveLength(2);
 // Later evidence never turns a consumed, previously unproven report into a new effect.
 await send({action:'closed',number:3,repository:{full_name:'synthetic-vector-18004/source'},pull_request:{number:3,title:'Fixes '+unmerged.identifier,body:null,state:'closed',merged:true,merge_commit_sha:sha(3),updated_at:'2026-10-02T12:00:00.000Z',html_url:'https://github.com/synthetic-vector-18004/source/pull/3'}});
 expect(await post(report('synthetic-vector-18014-3',sha(3),'live'))).toMatchObject({reused:true,linked:0});
 expect((await detail(unmerged)).deployments).toEqual([]);
 const concurrent=report('synthetic-vector-18027',sha(3),'live');
 const races=await Promise.all([post(concurrent),post(concurrent)]);
 expect(races.map(row=>row.reused).sort()).toEqual([false,true]);
 expect((await detail(unmerged)).activity.filter((entry:any)=>entry.nextValue?.trigger==='deploy')).toHaveLength(1);
 expect(await post({...report('synthetic-vector-18015'),repositoryId:other.id})).toMatchObject({linked:0});
 await refused(report('synthetic-vector-18016'),legacy.token,401);
 expect(JSON.parse((await env.DB.prepare('SELECT scopes FROM integration_tokens WHERE id=?').bind(legacy.credential.id).first<string>('scopes'))!)).toEqual(['issues:write','metadata:read']);
 for(const body of [{...staging,state:'failure'},{...staging,provider:'cloudflare-pages'},{...staging,sha:'invalid'},{...staging,unknown:true},{...staging,sha:'0'.repeat(40)}])await refused(body,token.token,400);
 const peerCookie=await invite(['synthetic-vector-18017','vector.test'].join('@'),f.cookie),peer=await actor(peerCookie);
 const minted=await request('/api/settings/integrations/tokens','POST',{name:'synthetic-vector-18018',scopes:['deployments:write']},peerCookie);expect(minted.status).toBe(201);const peerToken=(await minted.json() as any).token;
 expect((await f.call('/settings/teams/'+team.id+'/privacy','PUT',{isPrivate:true})).status).toBe(200);
 for(const role of ['member','admin','viewer','guest'] as const){
  expect((await f.call('/settings/operators/'+peer+'/role','PATCH',{role,teamIds:role==='guest'?[f.initial.teams.find(t=>t.id!==team.id)!.id]:[]})).status).toBe(200);
  await refused(report('synthetic-vector-18019'),peerToken,403);
  expect((await request('/api/issues/'+first.identifier+'/github','GET',undefined,peerCookie)).status).toBe(404);
 }
 // A foreign repository never gains authority from knowing its stable ID.
 const foreign='01K00000000000000000000180',foreignRepository='01K00000000000000000000181';
 await env.DB.batch([env.DB.prepare("INSERT INTO workspace_settings(id,name,timezone,created_at,updated_at) SELECT ?,'synthetic-vector-18020',timezone,created_at,updated_at FROM workspace_settings LIMIT 1").bind(foreign),env.DB.prepare("INSERT INTO vector_github_repositories(id,workspace_id,name,repository,created_at,updated_at) VALUES(?,?,'synthetic-vector-18021','synthetic-vector-18021/source',?,?)").bind(foreignRepository,foreign,'2026-10-01T00:00:00Z','2026-10-01T00:00:00Z')]);
 // The outer installation guard supports one workspace. Mount the same API to
 // exercise its own workspace fence against this intentionally foreign fixture.
 const {createIntegrationApi}=await import('../../src/core/features/integrations/api');const {Hono}=await import('hono');const mounted=new Hono();mounted.route('/api/v1',createIntegrationApi());
 const foreignBefore=await storage();const foreignResponse=await mounted.request(origin+'/api/v1/deployments',{method:'POST',headers:{Authorization:'Bearer '+token.token,'Content-Type':'application/json'},body:JSON.stringify({...staging,repositoryId:foreignRepository})},bindings);expect(foreignResponse.status).toBe(404);expect(await storage()).toEqual(foreignBefore);
 await env.DB.batch([env.DB.prepare('DELETE FROM vector_github_repositories WHERE id=?').bind(foreignRepository),env.DB.prepare('DELETE FROM workspace_settings WHERE id=?').bind(foreign)]);
 // Trigger failures test the final transaction fence, after preparation.
 for(const [name,sql,status] of [
  ['deployment_fault',"SELECT RAISE(ABORT,'synthetic-vector-18022');",503],
  ['deployment_revoked','UPDATE integration_tokens SET revoked_at=1 WHERE revoked_at IS NULL;',401],
  ['deployment_role',"UPDATE operators SET role='member' WHERE id='"+f.owner+"';",503],
  ['deployment_repository',"UPDATE vector_github_repositories SET enabled=0 WHERE id='"+repository.id+"';",503],
 ] as const){
  await env.DB.prepare('CREATE TRIGGER '+name+' AFTER INSERT ON vector_deployment_reports BEGIN '+sql+' END').run();
  try{await refused(report('synthetic-vector-18023'),token.token,status);}finally{await env.DB.prepare('DROP TRIGGER '+name).run();}
 }
 // Replay also rechecks restore custody. A granted historical person still
 // cannot report while effects are held.
 await env.DB.prepare("INSERT INTO vector_restore_status(id,import_id,effects_held) VALUES(1,'synthetic-vector-18024',1)").run();
 await env.DB.prepare('INSERT INTO vector_restore_operator_grants(auth_id,approved_at) SELECT auth_id,? FROM vector_auth_operators WHERE operator_id=?').bind('2026-10-11T12:00:00.000Z',f.owner).run();
 await refused(staging,token.token,403);await refused(report('synthetic-vector-18025'),token.token,403);
 await env.DB.batch([env.DB.prepare('DELETE FROM vector_restore_operator_grants'),env.DB.prepare('DELETE FROM vector_restore_status')]);
 // Added relationships participate in retained native import snapshots and
 // optimistic rollback predicates, without altering pre-feature empty values.
 await env.DB.prepare("INSERT INTO vector_import_revisions(issue_id,revision) VALUES(?,'synthetic-vector-18026') ON CONFLICT DO NOTHING").bind(first.id).run();
 const snapshot=await nativeTargets.read(env.DB,(await env.DB.prepare('SELECT workspace_id FROM teams WHERE id=?').bind(team.id).first<string>('workspace_id'))!,'issue',first.id);
 expect((snapshot!.value as any).providerDeployments).toHaveLength(2);
 const matches=nativeTargets.matches(snapshot,snapshot!.destination,'issue',first.id);expect(await env.DB.prepare('SELECT 1 WHERE '+matches.sql).bind(...matches.params!).first()).toBeTruthy();
 await env.DB.prepare('DELETE FROM vector_issue_deployments WHERE report_id=? AND issue_id=?').bind(receipt.id,first.id).run();
 expect(await env.DB.prepare('SELECT 1 WHERE '+matches.sql).bind(...matches.params!).first()).toBeNull();
 await env.DB.prepare('INSERT INTO vector_issue_deployments VALUES(?,?)').bind(receipt.id,first.id).run();
 await deploymentArchive();
 const current=await detail(),reportCount=await env.DB.prepare('SELECT count(*) n FROM vector_deployment_reports').first('n');
 const deleted=await f.call('/issues/'+first.identifier,'DELETE',{expectedVersion:current.version,confirmed:true});expect(deleted.status,await deleted.clone().text()).toBe(200);
 expect(await env.DB.prepare('SELECT count(*) n FROM vector_issue_deployments WHERE issue_id=?').bind(first.id).first('n')).toBe(0);
 const erased=await storage();expect(await post(production)).toMatchObject({reused:true,linked:0});expect(await storage()).toEqual(erased);
 expect(await env.DB.prepare('SELECT count(*) n FROM vector_deployment_reports').first('n')).toBe(reportCount);
 expect((await f.call('/issues/'+first.identifier+'/github')).status).toBe(404);
 expect((await f.call('/settings/integrations/github/'+repository.id,'DELETE')).status).toBe(200);await refused(staging,token.token,404);
 expect((await f.call('/settings/integrations/tokens/'+token.credential.id,'DELETE')).status).toBe(200);await refused(staging,token.token,401);
 expect((await env.DB.prepare('PRAGMA foreign_key_check').all()).results).toEqual([]);
 console.log('PROBE RELEASE-002 report: authenticated POST /api/v1/deployments -> exact merged SHA and recorded two-hop non-forced ancestry attach provider identity, environment and time; staging preserves status; selected live rule moves once.');
 console.log('PROBE RELEASE-002 refusal: conflicts, missing proof, forced push, unknown SHA, foreign repository, private non-owner, revoked token, role withdrawal and restore hold -> no unauthorized attachments or changed refused storage; injected persistence failure rolls back.');
 console.log('PROBE RELEASE-002 recovery: populated upgrade, restart, native snapshot predicate and archive round trip -> retained inert deployment history and excluded credentials.');
}

async function deploymentArchive(){
 const target=env as unknown as {ARCHIVE_TARGET_DB:D1Database;ARCHIVE_TARGET_FILES:R2Bucket};
 await applyD1Migrations(target.ARCHIVE_TARGET_DB,inject('migrations'));
 const source=await createVectorArchive({db:env.DB,files:env.FILES}),destination=await createVectorArchive({db:target.ARCHIVE_TARGET_DB,files:target.ARCHIVE_TARGET_FILES});
 const exported=await source.exports.create();while((await source.exports.advance(exported,{maxParts:16})).phase==='building'){}
 const records:any[]=[];for await(const record of readArchive(await source.exports.download(exported)))records.push(record);await source.exports.abort(exported);
 const id=await destination.imports.create(records[0]);for(const part of records.filter(row=>row.kind==='part'))await destination.imports.uploadPart(id,part.index,part);
 await destination.imports.finalize(id,{contentHash:records.at(-1).contentHash,archiveHash:records.at(-1).archiveHash});
 for(const table of ['vector_deployment_reports','vector_issue_deployments'])expect((await target.ARCHIVE_TARGET_DB.prepare('SELECT * FROM '+table+' ORDER BY 1,2').all()).results).toEqual((await env.DB.prepare('SELECT * FROM '+table+' ORDER BY 1,2').all()).results);
 expect(await target.ARCHIVE_TARGET_DB.prepare('SELECT count(*) n FROM integration_tokens').first('n')).toBe(0);
 expect(await target.ARCHIVE_TARGET_DB.prepare('SELECT effects_held FROM vector_restore_status').first('effects_held')).toBe(1);
 expect((await target.ARCHIVE_TARGET_DB.prepare('PRAGMA foreign_key_check').all()).results).toEqual([]);
}
