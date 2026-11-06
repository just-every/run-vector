import {env} from 'cloudflare:workers';
import {expect} from 'vitest';
import {createServerApp} from '../../src/core/app/server';
import {bindings} from './base-auth-fixture';
import {destination,targetBindings,targetCall} from './http-archive-fixture';

type Call=(path:string,method?:string,body?:unknown)=>Promise<Response>;
export async function seedAppActorArchive(call:Call,teamId:string) {
 const install=await call('/settings/app-actors','POST',{name:'synthetic-vector-19231',teamId,scopes:['issues:read','issues:title:write']});
 expect(install.status).toBe(201);const actor=await install.json() as {id:string;token:string};
 const created=await call('/issues','POST',{title:'synthetic-vector-19232',teamId});expect(created.status).toBe(201);const issue=await created.json() as any;
 const changed=await createServerApp().request(bindings.APP_ORIGIN+'/api/v1/issues/'+issue.identifier,{method:'PATCH',headers:{Authorization:'Bearer '+actor.token,'Content-Type':'application/json'},body:JSON.stringify({expectedVersion:issue.version,title:'synthetic-vector-19233'})},bindings);
 expect(changed.status).toBe(200);
 const tables=['vector_app_actors','issue_activity','audit_records'];
 const rows=await Promise.all(tables.map(async table=>(await env.DB.prepare('SELECT * FROM '+table+" WHERE "+(table==='vector_app_actors'?'id=?':table==='issue_activity'?'app_actor_id=?':"actor_reference='app-agent:'||?")+ ' ORDER BY rowid').bind(actor.id).all()).results));
 return {actor,issue,tables,rows};
}
export async function restoredAppActorArchive(saved:Awaited<ReturnType<typeof seedAppActorArchive>>,cookie:string,records:unknown[]) {
 const text=JSON.stringify(records);
 expect(text.includes(saved.actor.token)).toBe(false);
 expect(text.includes('vector_app_actor_credentials')).toBe(false);
 expect(await destination.ARCHIVE_TARGET_DB.prepare('SELECT count(*) n FROM vector_app_actor_credentials').first('n')).toBe(0);
 for(const [index,table] of saved.tables.entries()){
  const rows=(await destination.ARCHIVE_TARGET_DB.prepare('SELECT * FROM '+table+' WHERE '+(table==='vector_app_actors'?'id=?':table==='issue_activity'?'app_actor_id=?':"actor_reference='app-agent:'||?")+' ORDER BY rowid').bind(saved.actor.id).all()).results;
  expect(rows).toEqual(saved.rows[index]);
 }
 const list=await targetCall('/api/settings/app-actors','GET',undefined,cookie);expect(list.status).toBe(200);
 expect((await list.json() as any).actors).toContainEqual(expect.objectContaining({id:saved.actor.id,requiresReentry:1}));
 const native=await targetCall('/api/issues/'+saved.issue.identifier,'GET',undefined,cookie);expect(native.status).toBe(200);
 expect((await native.json() as any).activity).toContainEqual(expect.objectContaining({actor:expect.stringContaining('synthetic-vector-19231 · installed by ')}));
 const app=createServerApp(),url=targetBindings.APP_ORIGIN+'/api/v1/issues/'+saved.issue.identifier;
 expect((await app.request(url,{headers:{Authorization:'Bearer '+saved.actor.token}},targetBindings)).status).toBe(401);
 expect((await app.request(url,{method:'PATCH',headers:{Authorization:'Bearer '+saved.actor.token,'Content-Type':'application/json'},body:JSON.stringify({expectedVersion:2,title:'synthetic-vector-19234'})},targetBindings)).status).toBe(401);
 console.info('PROBE ROLE-006 archive: native HTTP export and pristine restore -> saved actor, installer, activity and audit unchanged; credentials excluded and historical calls refused.');
}
