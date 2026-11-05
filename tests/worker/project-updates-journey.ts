import {Hono} from 'hono';
import {createApiApp} from '../../src/core/app/api';
import {env} from 'cloudflare:workers';
import {applyD1Migrations} from 'cloudflare:test';
import {expect,inject} from 'vitest';
import {roleWorkspace,snapshot} from './role-fixture';
import {request,invite,bindings} from './base-auth-fixture';
import {createServerApp} from '../../src/core/app/server';
import {createUlid} from '../../src/core/shared/ids';
import {beforeBatch} from './administration-fixture';
import {insertHistoricalSample} from './historical-sample-fixture';

const read=async(response:Response,status=200)=>{expect(response.status,await response.clone().text()).toBe(status);return response.json() as Promise<any>;};
const watched=['projects','project_updates','project_activity','project_update_notifications','subject_subscriptions'];
const fresh=()=>({id:createUlid(new Date()),status:'at-risk',body:'## synthetic-vector-9801\n\nThe **settlement** needs attention.\n\n- Retain the receipt\n- Confirm the retry'});

export async function projectUpdatesJourney(){
 const f=await roleWorkspace(),project=(await f.mutate('/settings/projects','POST',{name:'synthetic-vector-9800',leadOperatorId:f.lead.id})).projects.find(p=>p.name==='synthetic-vector-9800')!;
 await f.create({projectId:project.id,teamId:f.team.id});
 const door='/projects/'+project.id+'/updates';
 const follow=async(who:typeof f.member)=>read(await who.call('/subscriptions','POST',{subjectType:'project',subjectId:project.id}),201);
 for(const who of [f.people.owner,f.admin,f.lead,f.member,f.guest])await follow(who);
 const inbox=async(who:typeof f.member)=>(await read(await who.call('/notifications?limit=50'))).items.filter((item:any)=>item.projectId===project.id);
 const original=await read(await f.call('/projects/'+project.id));
 const input=fresh(),saved=await read(await f.lead.call(door,'POST',input),201);
 expect(saved).toMatchObject({...input,projectId:project.id,authorId:f.lead.id});
 expect(saved.authorName).toBeTruthy();expect(Number.isFinite(Date.parse(saved.createdAt))).toBe(true);
 const detail=await read(await f.call('/projects/'+project.id));
 const occupied=detail.activity.find((entry:any)=>entry.kind!=='project.update_posted');expect(occupied).toBeDefined();
 const collisionBefore=await snapshot(watched);await read(await f.lead.call(door,'POST',{...fresh(),id:occupied.id}),409);expect(await snapshot(watched)).toEqual(collisionBefore);
 expect(detail.updates).toEqual([saved]);expect(detail.health).toBe(original.health);expect(detail.progress).toEqual(original.progress);
 for(const who of [f.people.owner,f.admin,f.member,f.guest]) {
  const items=await inbox(who);expect(items).toHaveLength(1);
  expect(items[0]).toMatchObject({eventId:input.id,projectId:project.id,projectUpdateId:input.id,title:project.name,actor:saved.authorName,causes:['project_update']});
 }
 expect(await inbox(f.lead)).toEqual([]);
 const notifications=await snapshot(watched);
 await read(await f.lead.call(door,'POST',input),201);
 expect(await snapshot(watched)).toEqual(notifications);
 const concurrent=fresh();const repeated=await Promise.all([f.lead.call(door,'POST',concurrent),f.lead.call(door,'POST',concurrent)]);
 for(const response of repeated)await read(response,201);
 expect((await inbox(f.member)).map((n:any)=>n.projectUpdateId).filter((id:string)=>id===concurrent.id)).toEqual([concurrent.id]);
 expect(await env.DB.prepare('SELECT count(*) n FROM project_activity WHERE id=?').bind(concurrent.id).first<number>('n')).toBe(1);
 const conflictBefore=await snapshot(watched);
 await read(await f.lead.call(door,'POST',{...concurrent,body:'synthetic-vector-conflicting-replay'}),409);
 expect(await snapshot(watched)).toEqual(conflictBefore);
 const contested=fresh();const competing=await Promise.all([f.lead.call(door,'POST',contested),f.lead.call(door,'POST',{...contested,body:'synthetic-vector-competing-update'})]);
 expect(competing.map(response=>response.status).sort()).toEqual([201,409]);
 const winner=await read(competing.find(response=>response.status===201)! ,201);
 expect((await read(await f.call('/projects/'+project.id))).updates.filter((update:any)=>update.id===contested.id)).toEqual([winner]);
 expect((await inbox(f.member)).filter((notice:any)=>notice.projectUpdateId===contested.id)).toHaveLength(1);

 // All three admitted identities post through the same route; ordinary Members,
 // Guests and Viewers never inherit the broader project editing permission.
 await read(await f.admin.call(door,'POST',fresh()),201);await read(await f.call(door,'POST',fresh()),201);
 const viewerCookie=await invite('synthetic-vector-9802'+'@'+'vector.test',f.cookie,'viewer');
 const refused=async(call:(path:string,method?:string,data?:unknown)=>Promise<Response>,status=403)=>{
  const before=await snapshot(watched);await read(await call(door,'POST',fresh()),status);expect(await snapshot(watched)).toEqual(before);
 };
 await refused(f.member.call);await refused(f.guest.call);
 await refused((path,method,data)=>request('/api'+path,method,data,viewerCookie));
 await f.mutate('/settings/projects/'+project.id,'PATCH',{leadOperatorId:f.member.id});
 await refused(f.lead.call);
 await read(await f.member.call(door,'POST',fresh()),201);
 // Preferences are checked at capture time, and a later unmute or follower never
 // receives historical events when the same stable request is replayed.
 await read(await f.admin.call('/settings/notifications','PATCH',{mutedKinds:['project_update']}));
 const muted=fresh();await read(await f.member.call(door,'POST',muted),201);
 expect((await inbox(f.admin)).some((n:any)=>n.projectUpdateId===muted.id)).toBe(false);
 await read(await f.admin.call('/settings/notifications','PATCH',{mutedKinds:[]}));
 const late=await f.fresh('member');await follow(late);
 const beforeReplay=await snapshot(watched);await read(await f.member.call(door,'POST',muted),201);expect(await snapshot(watched)).toEqual(beforeReplay);
 expect(await inbox(late)).toEqual([]);
 // A failed notification insert rolls back the update and its activity as well.
 await env.DB.exec("CREATE TRIGGER synthetic_vector_update_failure BEFORE INSERT ON project_update_notifications BEGIN SELECT RAISE(ABORT,'synthetic-vector-rollback'); END");
 const rollback=await snapshot(watched);expect((await f.member.call(door,'POST',fresh())).status).toBe(500);expect(await snapshot(watched)).toEqual(rollback);
 await env.DB.exec('DROP TRIGGER synthetic_vector_update_failure');
 // Revoke the native session between admission and the first write.
 const revoke=await f.fresh('member');await f.mutate('/settings/projects/'+project.id,'PATCH',{leadOperatorId:revoke.id});
 const app=createServerApp();
 const revokedBefore=await snapshot(watched);
 const raced=await app.request(bindings.APP_ORIGIN+'/api'+door,{method:'POST',headers:{host:new URL(bindings.APP_ORIGIN).host,Origin:bindings.APP_ORIGIN,cookie:revoke.cookie,'Content-Type':'application/json'},body:JSON.stringify(fresh())},{...bindings,DB:beforeBatch(async()=>{
  await env.DB.prepare('UPDATE oa_sessions SET revoked_at=1 WHERE operator_id=(SELECT auth_id FROM vector_auth_operators WHERE operator_id=?)').bind(revoke.id).run();
 })});
 expect(raced.status,await raced.clone().text()).toBe(401);expect(await snapshot(watched)).toEqual(revokedBefore);
 await f.mutate('/settings/projects/'+project.id,'PATCH',{leadOperatorId:f.lead.id});
 // A follower loses all project reads, Inbox rows and read mutations as soon as
 // the only contributing team becomes private and their membership is removed.
 await f.mutate('/settings/teams/'+f.team.id+'/privacy','PUT',{isPrivate:true});
 await f.mutate('/settings/teams/'+f.team.id+'/members/'+f.member.id,'DELETE');
 expect(await inbox(f.member)).toEqual([]);
 expect((await f.member.call('/projects/'+project.id)).status).toBe(404);
 const hiddenBefore=await snapshot(watched);
 expect((await f.member.call(door,'POST',fresh())).status).toBe(404);
 const hiddenNotice=(notifications.project_update_notifications as any[]).find(n=>n.recipient_id===f.member.id)!;
 expect((await f.member.call('/notifications/'+hiddenNotice.id+'/read','POST')).status).toBe(404);
 expect(await snapshot(watched)).toEqual(hiddenBefore);
 const inaccessible=await f.fresh('member',false);
 const beforeSubscribe=await snapshot(watched);expect((await inaccessible.call('/subscriptions','POST',{subjectType:'project',subjectId:project.id})).status).toBe(404);expect(await snapshot(watched)).toEqual(beforeSubscribe);
 // Lead and visibility are checked again in the commit snapshot, not only at entry.
 const deniedInput=fresh(),raceBefore=await snapshot(['project_updates','project_activity','project_update_notifications']);
 const changed=await app.request(bindings.APP_ORIGIN+'/api'+door,{method:'POST',headers:{host:new URL(bindings.APP_ORIGIN).host,Origin:bindings.APP_ORIGIN,cookie:f.lead.cookie,'Content-Type':'application/json'},body:JSON.stringify(deniedInput)},{...bindings,DB:beforeBatch(async()=>{
  await env.DB.prepare('UPDATE projects SET lead_operator_id=? WHERE id=?').bind(f.owner,project.id).run();
 })});
 expect(changed.status,await changed.clone().text()).toBe(409);expect(await snapshot(['project_updates','project_activity','project_update_notifications'])).toEqual(raceBefore);
 // Withdraw the current lead's last content access after admission. The whole
 // transaction refuses and retains no text, activity or recipient receipt.
 await f.mutate('/settings/projects/'+project.id,'PATCH',{leadOperatorId:f.lead.id});
 const withdrawnBefore=await snapshot(['project_updates','project_activity','project_update_notifications']);
 const withdrawn=await app.request(bindings.APP_ORIGIN+'/api'+door,{method:'POST',headers:{host:new URL(bindings.APP_ORIGIN).host,Origin:bindings.APP_ORIGIN,cookie:f.lead.cookie,'Content-Type':'application/json'},body:JSON.stringify(fresh())},{...bindings,DB:beforeBatch(async()=>{
  await env.DB.prepare('DELETE FROM team_members WHERE team_id=? AND operator_id=?').bind(f.team.id,f.lead.id).run();
 })});
 expect(withdrawn.status,await withdrawn.clone().text()).toBe(404);expect(await snapshot(['project_updates','project_activity','project_update_notifications'])).toEqual(withdrawnBefore);
 await f.mutate('/settings/projects/'+project.id,'PATCH',{leadOperatorId:f.owner});
 // Native removal erases recipient custody. Replaying a capture cannot restore it.
 await read(await f.call('/settings/operators/'+late.id,'DELETE'));
 expect((await late.call('/notifications')).status).toBe(401);
 expect(await env.DB.prepare('SELECT count(*) n FROM project_update_notifications WHERE recipient_id=?').bind(late.id).first<number>('n')).toBe(0);
 await read(await f.call(door,'POST',fresh()),201);
 expect(await env.DB.prepare('SELECT count(*) n FROM project_update_notifications WHERE recipient_id=?').bind(late.id).first<number>('n')).toBe(0);
 // A fresh app instance reads the same immutable update identity and Markdown.
 const restarted=await createServerApp().request(bindings.APP_ORIGIN+'/api/projects/'+project.id,{headers:{host:new URL(bindings.APP_ORIGIN).host,cookie:f.cookie}},bindings);
 expect((await read(restarted)).updates).toContainEqual(saved);
 // Erasing the author retains anonymous historical authorship, never their old name.
 await read(await f.call('/settings/operators/'+f.lead.id,'DELETE'));
 const anonymous=await read(await f.call('/projects/'+project.id));
 expect(anonymous.updates.find((update:any)=>update.id===saved.id)).toMatchObject({authorId:f.lead.id,authorName:'Removed operator',body:saved.body});
 expect((await inbox(f.people.owner)).find((notice:any)=>notice.projectUpdateId===saved.id).actor).toBe('Removed operator');
 const erasedWriterBefore=await snapshot(watched);expect((await f.lead.call(door,'POST',input)).status).toBe(401);expect(await snapshot(watched)).toEqual(erasedWriterBefore);
 // The storage engine supports workspace fencing. A separate workspace fixture
 // owns its own native project; even this workspace's Owner cannot read or post there.
 const workspace=(await env.DB.prepare('SELECT * FROM workspace_settings LIMIT 1').first<Record<string,string|number|null>>())!;
 const foreignWorkspace={...workspace,id:createUlid(new Date()),name:'synthetic-vector-foreign-workspace'};
 const columns=Object.keys(foreignWorkspace);
 await env.DB.prepare('INSERT INTO workspace_settings('+columns.join(',')+') VALUES('+columns.map(()=>'?').join(',')+')').bind(...columns.map(column=>foreignWorkspace[column])).run();
 await env.DB.prepare('UPDATE operators SET workspace_id=? WHERE id=?').bind(foreignWorkspace.id,inaccessible.id).run();
 // Mount the same native API with its real session and authority middleware.
 // Installation bootstrap deliberately supports only one workspace per host;
 // this isolated foreign-record fixture exercises the lower workspace fence.
 const foreignApp=new Hono().route('/api',createApiApp());
 const foreignCall=(path:string,method='GET',body?:unknown,cookie=f.cookie)=>foreignApp.request(bindings.APP_ORIGIN+'/api'+path,{method,headers:{host:new URL(bindings.APP_ORIGIN).host,Origin:bindings.APP_ORIGIN,cookie,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)},bindings);
 const foreignState=await read(await foreignCall('/settings/projects','POST',{name:'synthetic-vector-foreign-project',leadOperatorId:inaccessible.id},inaccessible.cookie));
 const foreignProject=foreignState.projects.find((candidate:any)=>candidate.name==='synthetic-vector-foreign-project');expect(foreignProject).toBeDefined();
 const foreignBefore=await snapshot(watched);
 const foreignRead=await foreignCall('/projects/'+foreignProject.id);expect(foreignRead.status).toBe(404);expect(await foreignRead.text()).not.toContain(foreignProject.name);
 await read(await foreignCall('/projects/'+foreignProject.id+'/updates','POST',fresh()),404);expect(await snapshot(watched)).toEqual(foreignBefore);
 console.log('PROBE PROJ-010 post: native lead posts dated At risk Markdown -> stable saved update, accountable author and unchanged computed health');
 console.log('PROBE PROJ-010 follower: existing native project subscriptions -> one genuine project update Inbox receipt per eligible follower, actor excluded, current access enforced');
}

export async function projectUpdateUpgrade(){
 const db=(env as unknown as {PROJECT_UPDATE_UPGRADE_DB:D1Database}).PROJECT_UPDATE_UPGRADE_DB,migrations=inject('migrations'),boundary=migrations.findIndex(m=>m.name==='0126_project_updates.sql');
 await applyD1Migrations(db,migrations.slice(0,boundary));await insertHistoricalSample(db,new Date('2026-10-01T00:00:00Z'));
 const owner=(await db.prepare('SELECT id FROM operators LIMIT 1').first<{id:string}>())!;
 const project=(await db.prepare('SELECT id FROM projects LIMIT 1').first<{id:string}>())!;
 await db.batch([
  db.prepare("INSERT INTO subject_subscriptions(id,operator_id,subject_type,subject_id,start_revision,created_at) SELECT ?,?,'project',?,revision,? FROM subscription_clock WHERE id=1").bind('01K00000000000000000009801',owner.id,project.id,'2026-10-01T00:00:00.000Z'),
  db.prepare("INSERT OR IGNORE INTO notification_type_mutes(operator_id,kind) VALUES(?,'comment')").bind(owner.id),
 ]);
 const before=await Promise.all(['projects','issues','project_activity','subject_subscriptions','notification_type_mutes'].map(async name=>(await db.prepare('SELECT * FROM '+name+' ORDER BY rowid').all()).results));
 expect(before[0].length).toBeGreaterThan(0);expect(before[1].length).toBeGreaterThan(0);
 await applyD1Migrations(db,migrations.slice(boundary));
 for(const [index,name] of ['projects','issues','project_activity','subject_subscriptions','notification_type_mutes'].entries())expect((await db.prepare('SELECT * FROM '+name+' ORDER BY rowid').all()).results).toEqual(before[index]);
 for(const table of ['project_updates','project_update_notifications'])expect(await db.prepare('SELECT count(*) n FROM '+table).first<number>('n')).toBe(0);
 expect((await db.prepare('PRAGMA foreign_key_check').all()).results).toEqual([]);
}
