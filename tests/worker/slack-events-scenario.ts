import {env} from 'cloudflare:workers';
import {expect} from 'vitest';
import {bindings,origin,request,actor,invite} from './base-auth-fixture';
import type {setupIntegrations} from './integration-fixture';
export const slackIntakeFixture={team:'TSYNTHETIC33',user:'USYNTHETIC33',bot:'USYNTHETIC34',channel:'CSYNTHETIC33',unlinked:'USYNTHETIC35',unmapped:'CSYNTHETIC36',self:'USYNTHETIC37',guest:'USYNTHETIC38',otherTeam:'TSYNTHETIC39',suspended:'USYNTHETIC40',owner:'USYNTHETIC41',remapped:'USYNTHETIC42',privileged:'USYNTHETIC43'};
export async function setupSlackIntake(f:Awaited<ReturnType<typeof setupIntegrations>>,secret:string,operatorId:string){
 const read=async(response:Response,status=200)=>{expect(response.status,await response.clone().text()).toBe(status);return response.json() as Promise<any>;};
 await read(await f.call('/settings/integrations/channels','POST',{scope:'team',objectId:f.initial.teams[0].id,provider:'slack',channelId:slackIntakeFixture.channel,channelName:'synthetic-vector-33001',events:['issue.created']}),201);
 const send=async(payload:unknown,options:{timestamp?:string;secret?:string;unsigned?:boolean}={})=>{
  const body=JSON.stringify(payload),timestamp=options.timestamp??String(Math.floor(Date.now()/1000));
  const encoder=new TextEncoder(),key=await crypto.subtle.importKey('raw',encoder.encode(options.secret??secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const digest=new Uint8Array(await crypto.subtle.sign('HMAC',key,encoder.encode('v0:'+timestamp+':'+body)));
  const signature='v0='+Array.from(digest,b=>b.toString(16).padStart(2,'0')).join('');
  return f.app.request(origin+'/api/integrations/slack/events',{method:'POST',headers:{'content-type':'application/json',...(!options.unsigned?{'x-slack-request-timestamp':timestamp,'x-slack-signature':signature}:{})},body},bindings);
 };
 const snapshot=async()=>{
  const names=(await env.DB.prepare("SELECT name FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY name").all<{name:string}>()).results;
  const rows=await env.DB.batch(names.map(({name})=>env.DB.prepare('SELECT * FROM "'+name.replaceAll('"','""')+'"')));
  const state:Record<string,unknown>={};for(const [index,{name}] of names.entries())state[name]=rows[index].results.map(row=>JSON.stringify(row)).sort();
  return state;
 };
 const payload={type:'event_callback',team_id:slackIntakeFixture.team,event_id:'synthetic-vector-33002',event:{type:'app_mention',user:slackIntakeFixture.user,channel:slackIntakeFixture.channel,text:'<@'+slackIntakeFixture.bot+'> Fix the intake defect'}};
 return {read,send,snapshot,payload};
}
export async function slackEventIntake(f:Awaited<ReturnType<typeof setupIntegrations>>,secret:string,operatorId:string){
 const {read,send,snapshot,payload}=await setupSlackIntake(f,secret,operatorId);
 const before=await snapshot();
 expect(await read(await send({type:'url_verification',challenge:'synthetic-vector-33003'}))).toEqual({challenge:'synthetic-vector-33003'});
 for(const options of [{unsigned:true},{secret:'synthetic-vector-33004'},{timestamp:String(Math.floor(Date.now()/1000)-301)}]){await read(await send(payload,options),401);expect(await snapshot()).toEqual(before);}
 const created=await read(await send(payload));
 const issue=await env.DB.prepare('SELECT i.team_id,i.title,a.actor_operator_id FROM issues i JOIN issue_activity a ON a.issue_id=i.id AND a.kind=\'issue.created\' WHERE i.identifier=?').bind(created.identifier).first();
 expect(issue).toMatchObject({team_id:f.initial.teams[0].id,title:'Fix the intake defect',actor_operator_id:operatorId});
 expect(await env.DB.prepare('SELECT count(*) n FROM vector_slack_event_receipts').first<number>('n')).toBe(1);
 const delivered=await snapshot();
 await read(await send(payload),409);expect(await snapshot()).toEqual(delivered);
 // A provider retry signed at a different time is still the same durable event.
 await read(await send(payload,{timestamp:String(Math.floor(Date.now()/1000)+1)}),409);expect(await snapshot()).toEqual(delivered);
 const unlinked={...payload,event_id:'synthetic-vector-33005',event:{...payload.event,user:slackIntakeFixture.unlinked}};
 await read(await send(unlinked),403);expect(await snapshot()).toEqual(delivered);
 const unmapped={...payload,event_id:'synthetic-vector-33006',event:{...payload.event,channel:slackIntakeFixture.unmapped}};
 await read(await send(unmapped),403);expect(await snapshot()).toEqual(delivered);
 // Each signed action re-resolves the target's current native role and active state.
 const other=(await f.mutate('/settings/teams','POST',{name:'synthetic-vector-slack-guests',identifierPrefix:'SGUEST'})).teams.find(team=>team.name==='synthetic-vector-slack-guests')!;
 const guest=await invite('synthetic-vector-intake-guest@vector.test',f.cookie),guestId=await actor(guest);
 expect((await f.call('/settings/operators/'+guestId+'/role','PATCH',{role:'guest',teamIds:[other.id]})).status).toBe(200);
 await read(await f.call('/settings/integrations/slack/app/members','POST',{operatorId:guestId,slackTeamId:slackIntakeFixture.team,slackUserId:slackIntakeFixture.guest}));
 const guestPayload={...payload,event_id:'synthetic-vector-guest-event',event:{...payload.event,user:slackIntakeFixture.guest}};
 const nativeState=async()=>({issues:(await env.DB.prepare('SELECT * FROM issues ORDER BY id').all()).results,receipts:(await env.DB.prepare('SELECT * FROM vector_slack_event_receipts ORDER BY event_key').all()).results});
 const beforeNative=await nativeState();
 // Native reads/writes conceal the uninvited team with 404; Slack returns its fixed 403 refusal.
 expect((await request('/api/issues','POST',{teamId:f.initial.teams[0].id,title:'synthetic-vector-guest-refusal'},guest)).status).toBe(404);
 expect(await nativeState()).toEqual(beforeNative);
 const beforeGuest=await snapshot();
 await read(await send(guestPayload),403);expect(await snapshot()).toEqual(beforeGuest);
 expect((await f.call('/settings/operators/'+operatorId+'/role','PATCH',{role:'guest',teamIds:[other.id]})).status).toBe(200);
 const demoted=await snapshot();
 await read(await send({...payload,event_id:'synthetic-vector-demoted-event'}),403);expect(await snapshot()).toEqual(demoted);
 const suspendedCookie=await invite('synthetic-vector-intake-suspend@vector.test',f.cookie),suspendedId=await actor(suspendedCookie);
 await read(await f.call('/settings/integrations/slack/app/members','POST',{operatorId:suspendedId,slackTeamId:slackIntakeFixture.team,slackUserId:slackIntakeFixture.suspended}));
 const active=await read(await send({...payload,event_id:'synthetic-vector-active-event',event:{...payload.event,user:slackIntakeFixture.suspended}}));
 expect(await env.DB.prepare("SELECT a.actor_operator_id FROM issues i JOIN issue_activity a ON a.issue_id=i.id AND a.kind='issue.created' WHERE i.identifier=?").bind(active.identifier).first()).toMatchObject({actor_operator_id:suspendedId});
 expect((await f.call('/settings/operators/'+suspendedId,'DELETE')).status).toBe(200);
 const suspended=await snapshot();
 await read(await send({...payload,event_id:'synthetic-vector-suspended-event',event:{...payload.event,user:slackIntakeFixture.suspended}}),403);expect(await snapshot()).toEqual(suspended);

}

export async function slackMemberMapping(f:Awaited<ReturnType<typeof setupIntegrations>>,admin:string,member:string,viewer:string){
 const memberId=await actor(member),body={operatorId:memberId,slackTeamId:slackIntakeFixture.team,slackUserId:slackIntakeFixture.user};
 const path='/api/settings/integrations/slack/app/members';
 const state=async()=>({links:(await env.DB.prepare('SELECT * FROM vector_slack_member_links ORDER BY operator_id').all()).results,audit:(await env.DB.prepare("SELECT * FROM audit_records WHERE action IN ('slack.member_mapped','slack.member_unmapped','slack.member_unlinked') ORDER BY id").all()).results});
 const before=await state();
 for(const cookie of [member,viewer]){
  expect((await request(path,'GET',undefined,cookie)).status).toBe(403);
  expect((await request(path,'POST',body,cookie)).status).toBe(403);
  expect((await request(path+'/'+memberId,'DELETE',undefined,cookie)).status).toBe(403);
  expect(await state()).toEqual(before);
 }
 expect((await f.call('/settings/integrations/slack/app/members','POST',body)).status).toBe(200);
 expect((await state()).links).toEqual([expect.objectContaining({operator_id:memberId,slack_team_id:body.slackTeamId,slack_user_id:body.slackUserId})]);
 expect((await state()).audit).toHaveLength(1);
 expect((await request(path+'/'+memberId,'DELETE',undefined,admin)).status).toBe(200);
 expect((await state()).links).toEqual([]);expect((await state()).audit).toHaveLength(2);
 expect((await request(path,'POST',body,admin)).status).toBe(200);
 expect((await state()).audit).toHaveLength(3);
 const beforeOwner=await state();
 expect((await request(path,'POST',{...body,operatorId:f.owner},admin)).status).toBe(403);
 expect(await state()).toEqual(beforeOwner);expect((await state()).links.some(row=>row.operator_id===f.owner)).toBe(false);
 const listed=await (await request(path,'GET',undefined,admin)).json() as {mappings:unknown[]};
 expect(listed.mappings).toEqual([expect.objectContaining({operatorId:memberId,slackUserId:body.slackUserId})]);
 // ct 10:10Z: privileged targets, workspace binding, either-party revocation and one audit per change.
 const adminId=await actor(admin),otherAdmin=await invite('synthetic-vector-other-admin@vector.test',f.cookie,'admin'),otherAdminId=await actor(otherAdmin);
 const refused=await state();
 expect((await request(path,'POST',{...body,operatorId:otherAdminId,slackUserId:slackIntakeFixture.privileged},admin)).status).toBe(403);
 expect(await state()).toEqual(refused);expect((await state()).links.some(row=>row.operator_id===otherAdminId)).toBe(false);
 expect((await request(path,'POST',{...body,operatorId:f.owner,slackUserId:slackIntakeFixture.privileged},admin)).status).toBe(403);
 expect(await state()).toEqual(refused);expect((await state()).links.some(row=>row.operator_id===f.owner)).toBe(false);
 expect((await request(path,'POST',{...body,slackTeamId:slackIntakeFixture.otherTeam},admin)).status).toBe(403);
 expect(await state()).toEqual(refused);
 expect((await state()).audit).toEqual(expect.arrayContaining([
  expect.objectContaining({actor_operator_id:f.owner,subject_id:memberId,action:'slack.member_mapped'}),
  expect.objectContaining({actor_operator_id:adminId,subject_id:memberId,action:'slack.member_unmapped'}),
  expect.objectContaining({actor_operator_id:adminId,subject_id:memberId,action:'slack.member_mapped'}),
 ]));
 const change=async(cookie:string,method:string,target:string,input?:unknown)=>{
  const before=await state(),actorId=await actor(cookie);
  expect((await request(method==='POST'?path:path+'/'+target,method,input,cookie)).status).toBe(200);
  const after=await state(),added=after.audit.filter(row=>!before.audit.some(old=>old.id===row.id));
  expect(added).toEqual([expect.objectContaining({actor_operator_id:actorId,subject_id:target,action:method==='POST'?'slack.member_mapped':'slack.member_unmapped'})]);
  if(method==='POST')expect(after.links.filter(row=>row.operator_id===target)).toEqual([expect.objectContaining({operator_id:target,slack_team_id:slackIntakeFixture.team,slack_user_id:(input as typeof body).slackUserId})]);
  else expect(after.links.some(row=>row.operator_id===target)).toBe(false);
 };
 await change(admin,'POST',adminId,{...body,operatorId:adminId,slackUserId:slackIntakeFixture.self});
 await change(f.cookie,'POST',f.owner,{...body,operatorId:f.owner,slackUserId:slackIntakeFixture.owner});
 const guest=await invite('synthetic-vector-map-guest@vector.test',f.cookie),guestId=await actor(guest);
 expect((await f.call('/settings/operators/'+guestId+'/role','PATCH',{role:'guest',teamIds:[f.initial.teams[0].id]})).status).toBe(200);
 await change(admin,'POST',guestId,{...body,operatorId:guestId,slackUserId:slackIntakeFixture.guest});
 const selfRevoke=async(cookie:string,target:string,user:string)=>{
  const own=await request('/api/settings/notifications','GET',undefined,cookie);expect(own.status).toBe(200);
  expect(await own.json()).toMatchObject({slack:{link:{slackTeamId:slackIntakeFixture.team,slackUserId:user}}});
  const before=await state();
  expect((await request('/api/settings/notifications/slack/link','DELETE',{},cookie)).status).toBe(200);
  const after=await state();expect(after.links.some(row=>row.operator_id===target)).toBe(false);
  expect(after.audit.filter(row=>!before.audit.some(old=>old.id===row.id))).toEqual([expect.objectContaining({actor_operator_id:target,subject_id:target,action:'slack.member_unlinked'})]);
 };
 await change(admin,'POST',memberId,{...body,slackUserId:slackIntakeFixture.remapped});
 await change(admin,'POST',memberId,body);
 await selfRevoke(member,memberId,body.slackUserId);
 await change(admin,'POST',memberId,body);
 await change(admin,'DELETE',memberId);
 await selfRevoke(guest,guestId,slackIntakeFixture.guest);
 await change(admin,'POST',memberId,body);
 expect((await f.call('/settings/operators/'+memberId+'/role','PATCH',{role:'viewer'})).status).toBe(200);
 await selfRevoke(member,memberId,body.slackUserId);
 return memberId;
}
