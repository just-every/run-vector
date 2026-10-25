import {env} from 'cloudflare:workers';
import {expect} from 'vitest';
import {bindings,origin,request,actor} from './base-auth-fixture';
import type {setupIntegrations} from './integration-fixture';
export const slackIntakeFixture={team:'TSYNTHETIC33',user:'USYNTHETIC33',bot:'USYNTHETIC34',channel:'CSYNTHETIC33',unlinked:'USYNTHETIC35',unmapped:'CSYNTHETIC36'};
export async function slackEventIntake(f:Awaited<ReturnType<typeof setupIntegrations>>,secret:string,operatorId:string){
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
}

export async function slackMemberMapping(f:Awaited<ReturnType<typeof setupIntegrations>>,admin:string,member:string,viewer:string){
 const memberId=await actor(member),body={operatorId:memberId,slackTeamId:slackIntakeFixture.team,slackUserId:slackIntakeFixture.user};
 const path='/api/settings/integrations/slack/app/members';
 const state=async()=>({links:(await env.DB.prepare('SELECT * FROM vector_slack_member_links ORDER BY operator_id').all()).results,audit:(await env.DB.prepare("SELECT * FROM audit_records WHERE action IN ('slack.member_mapped','slack.member_unmapped') ORDER BY id").all()).results});
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
 expect((await request(path,'POST',{...body,operatorId:f.owner},admin)).status).toBe(403);
 const listed=await (await request(path,'GET',undefined,admin)).json() as {mappings:unknown[]};
 expect(listed.mappings).toEqual([expect.objectContaining({operatorId:memberId,slackUserId:body.slackUserId})]);
 return memberId;
}
