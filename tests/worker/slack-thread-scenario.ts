import {env} from 'cloudflare:workers';
import {expect} from 'vitest';
import type {setupIntegrations} from './integration-fixture';
import {bindings,origin,request} from './base-auth-fixture';
import {setupSlackIntake,slackIntakeFixture as slack} from './slack-events-scenario';
import {dispatchWebhooks,outboundService} from '../../src/core/features/integrations/outbound';
import {slackThreadSafety} from './slack-thread-safety';
export async function slackThreadScenario(f:Awaited<ReturnType<typeof setupIntegrations>>,secret:string,member:string,operatorId:string,calls:{method:string;body:any}[]){
 const {read,send,snapshot}=await setupSlackIntake(f,secret,operatorId);
 let sequence=0;
 const callback=(event:Record<string,unknown>)=>({type:'event_callback',team_id:slack.team,event_id:'synthetic-vector-thread-'+(++sequence),event:{user:slack.user,channel:slack.channel,...event}});
 const rootTs='1794124900.000001';
 const first=callback({type:'app_mention',ts:rootTs,text:'<@'+slack.bot+'> Investigate the mapped failure'});
 const created=await read(await send(first));
 const identifier=created.identifier,root=created.rootId;
 const issue={...await read(await f.call('/issues/'+identifier)),teamId:f.initial.teams[0].id};
 expect(issue.description).toContain('Investigate the mapped failure');
 expect(issue.description).toContain('Slack author: '+slack.user);
 expect(issue.description).toContain('https://synthetic-vector.slack.com/archives/'+slack.channel+'/p'+rootTs.replace('.',''));
 const discussion=async()=>((await read(await request('/api/issues/'+identifier+'/discussion','GET',undefined,member))) as any).comments as any[];
 expect((await discussion()).filter(row=>row.parentId===null)).toEqual([expect.objectContaining({id:root,actor:'Slack · '+slack.user,body:issue.description})]);
 expect(await env.DB.prepare('SELECT count(*) n FROM vector_slack_threads WHERE issue_id=?').bind(issue.id).first('n')).toBe(1);
 const afterCreate=await snapshot();
 for(const event of [first,{...first,event_id:'synthetic-vector-thread-renamed'}]){await read(await send(event),409);expect(await snapshot()).toEqual(afterCreate);}
 const inbound=callback({type:'message',ts:'1794124900.000002',thread_ts:rootTs,text:'Slack first reply'});
 await read(await send(inbound));f.restart();
 const afterReply=await snapshot();await read(await send(inbound),409);expect(await snapshot()).toEqual(afterReply);
 const concurrent=callback({type:'message',ts:'1794124900.000003',thread_ts:rootTs,text:'Slack concurrent reply'});
 expect((await Promise.all([send(concurrent),send(concurrent)])).map(r=>r.status).sort()).toEqual([200,409]);
 expect((await discussion()).filter(row=>row.parentId===root).map(row=>row.body)).toEqual(['Slack first reply','Slack concurrent reply']);
 const nativeReply=async(body:string,parentId?:string)=>read(await f.call('/issues/'+identifier+'/comments','POST',{body,...(parentId?{parentId}:{})}),201);
 await nativeReply('Vector mapped reply',root);
 await nativeReply('Separate Vector comment');
 const countIntents=()=>env.DB.prepare("SELECT count(*) n FROM vector_webhook_events WHERE event='slack.thread' AND json_extract(body,'$.issueId')=?").bind(issue.id).first<number>('n');
 expect(await countIntents()).toBe(1);
 const posts=()=>calls.filter(c=>c.method==='chat.postMessage'&&c.body.thread_ts);
 await Promise.all([dispatchWebhooks(bindings),dispatchWebhooks(bindings)]);await dispatchWebhooks(bindings);
 expect(posts().map(c=>({thread:c.body.thread_ts,text:c.body.text}))).toEqual([{thread:rootTs,text:'Vector mapped reply'}]);
 const delivery=await env.DB.prepare("SELECT id,state,attempts FROM integration_deliveries WHERE json_extract(envelope,'$.protocol')='slack_thread'").first<any>();
 expect(delivery).toMatchObject({state:'accepted',attempts:1});
 expect((await outboundService(bindings,(await env.DB.prepare('SELECT workspace_id FROM teams WHERE id=?').bind(issue.teamId).first<string>('workspace_id'))!).log(delivery.id)).length).toBe(1);
 // A second Slack source is linked explicitly, never guessed from a title.
 const secondTs='1794124900.000100';
 const second=await read(await send(callback({type:'app_mention',ts:secondTs,text:'<@'+slack.bot+'> link '+identifier})));
 expect(second.identifier).toBe(identifier);expect(second.rootId).not.toBe(root);
 await read(await send(callback({type:'message',ts:'1794124900.000101',thread_ts:secondTs,text:'Only the second thread'})));
 const rows=await discussion();expect(rows.find(row=>row.body==='Only the second thread').parentId).toBe(second.rootId);
 expect(rows.filter(row=>row.parentId===root).some(row=>row.body==='Only the second thread')).toBe(false);
 await nativeReply('Vector second-thread reply',second.rootId);await dispatchWebhooks(bindings);
 expect(posts().at(-1)?.body).toMatchObject({thread_ts:secondTs,text:'Vector second-thread reply'});
 const resolve=()=>f.call('/issues/'+identifier+'/comments/'+root+'/resolution','POST',{resolved:true});
 await read(await resolve());await read(await resolve());await dispatchWebhooks(bindings);
 expect(posts().filter(c=>c.body.text===identifier+' · Thread resolved')).toEqual([expect.objectContaining({body:expect.objectContaining({thread_ts:rootTs})})]);
 const statuses=(await env.DB.prepare("SELECT id,name FROM workflow_statuses WHERE team_id=? AND category IN ('started','completed') ORDER BY position").bind(issue.teamId).all<any>()).results;
 for(const status of statuses.slice(0,2)){
  const current=await read(await f.call('/issues/'+identifier));
  await read(await f.call('/issues/'+identifier,'PATCH',{expectedVersion:current.version,statusId:status.id}));
 }
 await dispatchWebhooks(bindings);await dispatchWebhooks(bindings);
 for(const status of statuses.slice(0,2))expect(posts().filter(c=>c.body.text===identifier+' · Status: '+status.name).map(c=>c.body.thread_ts).sort()).toEqual([rootTs,secondTs].sort());
 // Echoes and unrelated channel messages are acknowledged without stored effects.
 for(const event of [callback({type:'message',bot_id:slack.bot,subtype:'bot_message',ts:'1794124900.000004',thread_ts:rootTs,text:'Vector echo'}),callback({type:'message',ts:'1794124900.000005',text:'Unmapped top-level message'})]){
  const before=await snapshot();expect(await read(await send(event))).toMatchObject({ignored:true});expect(await snapshot()).toEqual(before);
 }
 const shortcut=async(message:Record<string,unknown>,options:{user?:string;channel?:string;secret?:string}={})=>{
  const payload={type:'message_action',callback_id:'vector_create_issue',team:{id:slack.team},user:{id:options.user??slack.user},channel:{id:options.channel??slack.channel},message:{user:slack.unlinked,...message}},body=new URLSearchParams({payload:JSON.stringify(payload)}).toString(),timestamp=String(Math.floor(Date.now()/1000));
  const encoder=new TextEncoder(),key=await crypto.subtle.importKey('raw',encoder.encode(options.secret??secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const signature='v0='+Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',key,encoder.encode('v0:'+timestamp+':'+body))),b=>b.toString(16).padStart(2,'0')).join('');
  return f.app.request(origin+'/api/integrations/slack/interactive',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded','x-slack-request-timestamp':timestamp,'x-slack-signature':signature},body},bindings);
 };
 const selected={ts:'1794124900.000200',text:'Original selected message'};
 for(const [options,status] of [[{secret:'synthetic-vector-wrong-signature'},401],[{user:slack.unlinked},403],[{channel:slack.unmapped},403]] as const){
  const before=await snapshot();expect((await shortcut(selected,options)).status).toBe(status);expect(await snapshot()).toEqual(before);
 }
 expect((await shortcut(selected)).status).toBe(200);
 const selectedRoot=await env.DB.prepare('SELECT c.body,c.imported_author_name FROM vector_slack_threads m JOIN issue_comments c ON c.id=m.root_comment_id WHERE m.thread_ts=?').bind(selected.ts).first<any>();
 expect(selectedRoot).toMatchObject({imported_author_name:'Slack · '+slack.unlinked});expect(selectedRoot.body).toContain(selected.text);expect(selectedRoot.body).toContain('Slack author: '+slack.unlinked);
 const shortcutSaved=await snapshot();expect((await shortcut(selected)).status).toBe(409);expect(await snapshot()).toEqual(shortcutSaved);
 await slackThreadSafety({f,read,send,snapshot,callback,identifier,issue,root,rootTs,secondTs,operatorId,member,calls,nativeReply,posts});
}
