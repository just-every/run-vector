import { env } from 'cloudflare:workers';
import { expect } from 'vitest';
import { setupIntegrations } from './integration-fixture';
import { beforeBatch } from './administration-fixture';
import { actor, invite, request, origin, bindings } from './base-auth-fixture';

/** One installed identity crosses the mounted native management and issue doors. */
export async function appActorJourney(f:Awaited<ReturnType<typeof setupIntegrations>>) {
 const team=f.initial.teams[0],issue=await f.create({title:'synthetic-vector-19201'});
 const path='/issues/'+issue.identifier;
 const adminCookie=await invite(['synthetic-vector-19202','vector.test'].join('@'),f.cookie,'admin'),admin=await actor(adminCookie);
 const manage=(cookie:string,p='',method='GET',body?:unknown)=>request('/api/settings/app-actors'+p,method,body,cookie);
 const install=async(cookie=f.cookie,write=true)=>{
  const r=await manage(cookie,'','POST',{name:'synthetic-vector-19203',teamId:team.id,scopes:write?['issues:read','issues:title:write']:['issues:read']});
  expect(r.status,await r.clone().text()).toBe(201);return r.json() as Promise<{id:string;token:string}>;
 };
 const storage=async()=>Object.fromEntries(await Promise.all(['issues','issue_activity','audit_records','vector_app_actors','vector_app_actor_credentials','issue_followers','notifications'].map(async name=>[name,(await env.DB.prepare('SELECT * FROM '+name+' ORDER BY rowid').all()).results])));
 const active=await install(adminCookie);
 const read=async()=>{const r=await f.api(active.token,path);expect(r.status,await r.clone().text()).toBe(200);return r.json() as Promise<any>;};
 const nativeRead=async()=>{const r=await f.call(path);expect(r.status).toBe(200);return r.json() as Promise<any>;};
 const patch=(credential:string,version:number,title:string)=>f.api(credential,path,'PATCH',{expectedVersion:version,title});
 expect((await manage(adminCookie)).status).toBe(200);
 expect(JSON.stringify(await (await manage(adminCookie)).json())).not.toContain(active.token);
 expect(await env.DB.prepare('SELECT token_hash FROM vector_app_actor_credentials WHERE actor_id=?').bind(active.id).first<string>('token_hash')).not.toBe(active.token);
 const before=await read();
 expect((await patch(active.token,before.version,'synthetic-vector-19204')).status).toBe(200);
 f.restart();
 const changed=await nativeRead(),activity=changed.activity.find((a:any)=>a.nextValue?.title==='synthetic-vector-19204');
 expect(changed.title).toBe('synthetic-vector-19204');expect(activity.actor).toBe('synthetic-vector-19203 · installed by synthetic-vector-19202');
 const saved=await env.DB.prepare('SELECT actor_operator_id,actor_name,app_actor_id,app_installer_id,app_installer_name FROM issue_activity WHERE id=?').bind(activity.id).first();
 expect(saved).toEqual({actor_operator_id:null,actor_name:'synthetic-vector-19203',app_actor_id:active.id,app_installer_id:admin,app_installer_name:'synthetic-vector-19202'});
 const audits=await (await f.call('/settings/audit?kind=agent&subject='+issue.id)).json() as any;
 expect(audits.entries).toContainEqual(expect.objectContaining({actorRef:'app-agent:'+active.id,actorKind:'agent',actorName:activity.actor,action:'issue.updated'}));
 // Replay, stale writes, unselected mutations and scope failures change nothing.
 let retained=await storage();
 expect((await patch(active.token,before.version,'synthetic-vector-19205')).status).toBe(409);
 expect((await f.api(active.token,path,'PATCH',{expectedVersion:changed.version,title:'synthetic-vector-19205',priority:'urgent'})).status).toBe(400);
 expect((await f.api(active.token,'/issues','POST',{teamId:team.id,title:'synthetic-vector-19206'})).status).toBe(403);
 expect((await f.api(active.token,path+'/comments','POST',{body:'synthetic-vector-19207'})).status).toBe(403);
 expect((await f.api(active.token,'/issues')).status).toBe(403);
 expect(await storage()).toEqual(retained);
 const readonly=await install(f.cookie,false);retained=await storage();
 expect((await f.api(readonly.token,path)).status).toBe(200);
 expect((await patch(readonly.token,changed.version,'synthetic-vector-19208')).status).toBe(403);
 expect(await storage()).toEqual(retained);
 const other=await f.call('/settings/teams','POST',{name:'synthetic-vector-19209',identifierPrefix:'ACT'});expect(other.status).toBe(200);
 const another=(await f.state()).teams.find(t=>t.name==='synthetic-vector-19209')!;
 const foreign=await f.create({teamId:another.id,title:'synthetic-vector-19210'});retained=await storage();
 expect((await f.api(active.token,'/issues/'+foreign.identifier)).status).toBe(404);
 expect((await f.api(active.token,'/issues/'+foreign.identifier,'PATCH',{expectedVersion:foreign.version,title:'synthetic-vector-19211'})).status).toBe(404);
 expect(await storage()).toEqual(retained);
 // Current role, membership and private access remain the installer's ceiling.
 expect((await f.call('/settings/teams/'+team.id+'/members/'+admin,'PUT',{role:'member'})).status).toBe(200);
 expect((await f.call('/settings/teams/'+team.id+'/privacy','PUT',{isPrivate:true})).status).toBe(200);
 expect((await read()).title).toBe('synthetic-vector-19204');
 expect((await f.call('/settings/teams/'+team.id+'/members/'+admin,'DELETE')).status).toBe(200);
 retained=await storage();expect((await f.api(active.token,path)).status).toBe(401);
 expect((await patch(active.token,changed.version,'synthetic-vector-19212')).status).toBe(401);expect(await storage()).toEqual(retained);
 expect((await f.call('/settings/teams/'+team.id+'/members/'+admin,'PUT',{role:'member'})).status).toBe(200);
 for(const role of ['viewer','guest'] as const){
  expect((await f.call('/settings/operators/'+admin+'/role','PATCH',{role,teamIds:[team.id]})).status).toBe(200);
  retained=await storage();expect((await f.api(active.token,path)).status).toBe(401);expect((await patch(active.token,changed.version,'synthetic-vector-19213')).status).toBe(401);
  expect((await manage(adminCookie,'','POST',{name:'synthetic-vector-19214',teamId:team.id,scopes:['issues:read']})).status).toBe(403);
  expect((await manage(adminCookie,'/'+active.id,'PATCH',{state:'revoked'})).status).toBe(403);expect(await storage()).toEqual(retained);
 }
 expect((await f.call('/settings/operators/'+admin+'/role','PATCH',{role:'member'})).status).toBe(200);
 expect((await f.api(active.token,path)).status).toBe(200);
 expect((await manage(adminCookie)).status).toBe(403);
 expect((await manage(adminCookie,'','POST',{name:'synthetic-vector-19214',teamId:team.id,scopes:['issues:read']})).status).toBe(403);
 expect((await f.call('/settings/operators/'+admin+'/role','PATCH',{role:'admin'})).status).toBe(200);
 // Native session, origin and personal-token authority cannot manage this actor.
 const personal=await f.issueToken(['issues:read','issues:write'],'synthetic-vector-19219');retained=await storage();
 expect((await manage('','/'+active.id,'PATCH',{state:'revoked'})).status).toBe(401);
 expect((await f.app.request(origin+'/api/settings/app-actors/'+active.id,{method:'PATCH',headers:{Authorization:'Bearer '+personal.token,Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({state:'revoked'})},bindings)).status).toBe(401);
 expect((await f.app.request(origin+'/api/settings/app-actors/'+active.id,{method:'PATCH',headers:{Cookie:adminCookie,Origin:'https://synthetic-vector-19215.example.test','Content-Type':'application/json'},body:JSON.stringify({state:'revoked'})},bindings)).status).toBe(403);
 expect((await f.app.request(origin+'/api/session',{headers:{Authorization:'Bearer '+active.token}},bindings)).status).toBe(401);expect(await storage()).toEqual(retained);
 // A native Admin pause that wins before commit aborts the complete edit batch.
 const race=await install(adminCookie),raceBefore=await storage();
 const fenced=beforeBatch(async()=>{expect((await manage(adminCookie,'/'+race.id,'PATCH',{state:'paused'})).status).toBe(200);});
 expect((await f.api(race.token,path,'PATCH',{expectedVersion:changed.version,title:'synthetic-vector-19216'},{DB:fenced})).status).toBe(401);
 expect((await nativeRead()).title).toBe(changed.title);
 expect((await storage()).issue_activity).toEqual(raceBefore.issue_activity);
 expect((await storage()).audit_records.filter((a:any)=>a.actor_kind==='agent')).toEqual((raceBefore.audit_records as any[]).filter(a=>a.actor_kind==='agent'));
 expect((await f.api(race.token,path)).status).toBe(401);
 // The final commit guard also rolls back revocation injected after activity.
 const atomic=await install(adminCookie),atomicBefore=await storage();
 await env.DB.prepare("CREATE TRIGGER deny_app_commit AFTER INSERT ON issue_activity WHEN NEW.app_actor_id IS NOT NULL BEGIN UPDATE vector_app_actors SET state='revoked' WHERE id=NEW.app_actor_id; END").run();
 expect((await patch(atomic.token,changed.version,'synthetic-vector-19217')).status).toBe(401);
 expect(await storage()).toEqual(atomicBefore);await env.DB.prepare('DROP TRIGGER deny_app_commit').run();
 // A paused identity stays stopped and revocation retains all attributed history.
 expect((await manage(adminCookie,'/'+active.id,'PATCH',{state:'paused'})).status).toBe(200);
 expect((await f.api(active.token,path)).status).toBe(401);
 expect((await manage(adminCookie,'/'+active.id,'PATCH',{state:'revoked'})).status).toBe(200);f.restart();
 retained=await storage();expect((await patch(active.token,changed.version,'synthetic-vector-19218')).status).toBe(401);expect(await storage()).toEqual(retained);
 expect((await nativeRead()).activity).toContainEqual(expect.objectContaining({id:activity.id,actor:activity.actor}));
 const current=await (await f.call('/settings/audit?kind=agent&subject='+issue.id)).json() as any;expect(current.entries).toEqual(audits.entries);
 expect((await f.api(atomic.token,path)).status).toBe(200);
 // Erasing the accountable installer revokes remaining credentials and redacts
 // saved personal names, while preserving the app's own immutable provenance.
 expect((await f.call('/settings/operators/'+admin,'DELETE')).status).toBe(200);retained=await storage();
 expect((await f.api(atomic.token,path)).status).toBe(401);expect(await storage()).toEqual(retained);
 expect((await nativeRead()).activity).toContainEqual(expect.objectContaining({id:activity.id,actor:'synthetic-vector-19203 · installed by Erased person'}));
 expect((await (await f.call('/settings/audit?kind=agent&subject='+issue.id)).json() as any).entries[0].actorName).toBe('synthetic-vector-19203 · installed by Erased person');
 expect((await f.call('/settings/teams/'+team.id+'/privacy','PUT',{isPrivate:false})).status).toBe(200);
 expect((await env.DB.prepare('PRAGMA foreign_key_check').all()).results).toEqual([]);
 console.info('PROBE ROLE-006 native actor: install -> versioned title edit -> own activity and audit with installer; pause and revoke -> next call refused; stale, scope, private, role, session and commit races leave product state unchanged; restart retains history; installer erasure cannot restore access.');
}
