import {slackThreadImport} from './slack-thread-import';
import {env} from 'cloudflare:workers';
import {expect} from 'vitest';
import {bindings,origin,request} from './base-auth-fixture';
import {dispatchWebhooks,outboundService} from '../../src/core/features/integrations/outbound';
import type {setupIntegrations} from './integration-fixture';
import {slackIntakeFixture,setupSlackIntake} from './slack-events-scenario';
type Call={method:string;body:any};
/** One signed transport journey follows two independent Slack threads through
 * the mounted discussion doors and durable provider delivery with receipts. */
export async function slackThreadSync(f:Awaited<ReturnType<typeof setupIntegrations>>,intake:Awaited<ReturnType<typeof setupSlackIntake>>,secret:string,member:string,identifier:string,calls:Call[],threadEdge:{status:number;permalink?:string;onInfo?:(()=>Promise<void>)}){
 const {read,send,snapshot,payload}=intake;
 const workspace=(await env.DB.prepare('SELECT workspace_id FROM operators WHERE id=?').bind(f.owner).first<string>('workspace_id'))!;
 const discussion=async()=>(await read(await f.call('/issues/'+identifier+'/discussion'))).comments as any[];
 let comments=await discussion();
 const root=comments.find(c=>!c.parentId);
 expect(root.body).toContain('Fix the intake defect');expect(root.body).toContain(slackIntakeFixture.user);expect(root.body).toContain('https://synthetic-vector.slack.com/archives/'+slackIntakeFixture.channel+'/p1730000000000001');
 const issue=await env.DB.prepare('SELECT id,description,version FROM issues WHERE identifier=?').bind(identifier).first<any>();expect(issue.description).toContain(root.body);
 const mapped=(await env.DB.prepare('SELECT * FROM vector_slack_threads WHERE issue_id=?').bind(issue.id).all<any>()).results;
 expect(mapped).toHaveLength(1);expect(mapped[0].root_comment_id).toBe(root.id);
 const event=(id:string,ts:string,text:string,thread=payload.event.ts)=>({...payload,event_id:id,event:{...payload.event,type:'message',ts,thread_ts:thread,text}});
 const firstReply=event('synthetic-vector-thread-1','1730000000.000010','Slack reply one');
 expect(await read(await send(firstReply))).toMatchObject({identifier,rootCommentId:root.id});
 comments=await discussion();expect(comments.filter(c=>c.parentId===root.id).map(c=>c.body)).toEqual(['Slack reply one']);
 const afterReply=await snapshot();
 await read(await send(firstReply),409);expect(await snapshot()).toEqual(afterReply);
 f.restart();await read(await send({...firstReply,event_id:'synthetic-vector-thread-duplicate'}),409);expect(await snapshot()).toEqual(afterReply);
 const concurrent=event('synthetic-vector-thread-concurrent','1730000000.000011','Concurrent Slack reply');
 const results=await Promise.all([send(concurrent),send(concurrent)]);expect(results.map(r=>r.status).sort()).toEqual([200,409]);
 expect((await discussion()).filter(c=>c.body==='Concurrent Slack reply')).toHaveLength(1);
 const echoBefore=await snapshot();await read(await send({...event('synthetic-vector-thread-echo','1730000000.000012','Bot echo'),event:{...concurrent.event,ts:'1730000000.000012',bot_id:'synthetic-vector-echo',subtype:'bot_message'}}));expect(await snapshot()).toEqual(echoBefore);
 const posts=()=>calls.filter(c=>c.method==='chat.postMessage'&&c.body.thread_ts);
 const beforePosts=posts().length;
 const native=await read(await request('/api/issues/'+identifier+'/comments','POST',{body:'Vector reply one',parentId:root.id},member),201);
 await read(await f.call('/issues/'+identifier+'/comments','POST',{body:'Separate top-level comment'}),201);
 await dispatchWebhooks(bindings);await dispatchWebhooks(bindings);f.restart();await dispatchWebhooks(bindings);
 expect(posts().slice(beforePosts)).toEqual([expect.objectContaining({body:expect.objectContaining({channel:slackIntakeFixture.channel,thread_ts:payload.event.ts,text:expect.stringContaining('Vector reply one')})})]);
 const delivery=await env.DB.prepare('SELECT state,attempts FROM integration_deliveries WHERE namespace=? AND id=?').bind(workspace,native.id+':slack-thread').first();expect(delivery).toMatchObject({state:'accepted',attempts:1});
 // An erased reply cannot be read from a captured queue body or sent later.
 const erased=await read(await f.call('/issues/'+identifier+'/comments','POST',{body:'Erased queued Slack reply',parentId:root.id}),201);
 await read(await f.call('/issues/'+identifier+'/comments/'+erased.id,'DELETE'));
 const erasedMark=posts().length;await Promise.all([dispatchWebhooks(bindings),dispatchWebhooks(bindings)]);
 expect(posts()).toHaveLength(erasedMark);
 expect((await env.DB.prepare('SELECT body FROM issue_comments WHERE id=?').bind(erased.id).first<any>()).body).toBeNull();
 // A 429 posts nothing and may retry after restart; a 503 is uncertain and never resent.
 const retry=await read(await f.call('/issues/'+identifier+'/comments','POST',{body:'Retry-safe native reply',parentId:root.id}),201);
 threadEdge.status=429;await dispatchWebhooks(bindings);
 const retryId=retry.id+':slack-thread',queued=await env.DB.prepare('SELECT state,attempts,next_at FROM integration_deliveries WHERE namespace=? AND id=?').bind(workspace,retryId).first<any>();
 expect(queued).toMatchObject({state:'queued',attempts:1});
 threadEdge.status=200;f.restart();await outboundService(bindings,workspace,()=>queued.next_at+1).dispatch(retryId);await outboundService(bindings,workspace,()=>queued.next_at+2).dispatch(retryId);
 expect(await env.DB.prepare('SELECT state,attempts FROM integration_deliveries WHERE namespace=? AND id=?').bind(workspace,retryId).first()).toMatchObject({state:'accepted',attempts:2});
 expect(posts().filter(c=>c.body.text.includes('Retry-safe native reply'))).toHaveLength(2);
 const uncertain=await read(await f.call('/issues/'+identifier+'/comments','POST',{body:'Uncertain native reply',parentId:root.id}),201);
 threadEdge.status=503;await dispatchWebhooks(bindings);threadEdge.status=200;f.restart();await dispatchWebhooks(bindings);
 expect(await env.DB.prepare('SELECT state,attempts FROM integration_deliveries WHERE namespace=? AND id=?').bind(workspace,uncertain.id+':slack-thread').first()).toMatchObject({state:'uncertain',attempts:1});
 expect(posts().filter(c=>c.body.text.includes('Uncertain native reply'))).toHaveLength(1);
 // Add a second Slack message through the existing-issue mention command.
 const secondTs='1730000001.000001';
 const second=await read(await send({...payload,event_id:'synthetic-vector-thread-second',event:{...payload.event,ts:secondTs,text:'<@'+slackIntakeFixture.bot+'> add '+identifier+' Second source message'}}));
 expect(second.identifier).toBe(identifier);expect(second.rootCommentId).not.toBe(root.id);
 await read(await send(event('synthetic-vector-thread-second-reply','1730000001.000002','Second thread reply',secondTs)));
 comments=await discussion();expect(comments.filter(c=>c.parentId===second.rootCommentId).map(c=>c.body)).toEqual(['Second thread reply']);expect(comments.filter(c=>c.parentId===root.id).every(c=>c.body!=='Second thread reply')).toBe(true);
 const beforeSecond=posts().length;
 await read(await f.call('/issues/'+identifier+'/comments','POST',{body:'Vector second-thread reply',parentId:second.rootCommentId}),201);
 await dispatchWebhooks(bindings);expect(posts().slice(beforeSecond).map(c=>c.body.thread_ts)).toEqual([secondTs]);
 const resolution='/issues/'+identifier+'/comments/'+root.id+'/resolution';
 await read(await f.call(resolution,'POST',{resolved:true}));await read(await f.call(resolution,'POST',{resolved:true}));
 await dispatchWebhooks(bindings);expect(posts().filter(c=>c.body.text===identifier+' · Thread resolved')).toHaveLength(1);
 const current=await env.DB.prepare('SELECT version FROM issues WHERE identifier=?').bind(identifier).first<number>('version');
 const status=f.initial.teams[0].statuses.find(s=>s.category==='started')!;
 await read(await f.call('/issues/'+identifier,'PATCH',{expectedVersion:current,statusId:status.id}));
 await dispatchWebhooks(bindings);await dispatchWebhooks(bindings);
 expect(posts().filter(c=>c.body.text===identifier+' · '+status.name).map(c=>c.body.thread_ts).sort()).toEqual([payload.event.ts,secondTs].sort());
 const beforeForeign=await snapshot();threadEdge.permalink='https://receiver.example.com/foreign';
 await read(await send({...payload,event_id:'synthetic-vector-foreign-permalink',event:{...payload.event,ts:'1730000005.000001',text:'Foreign permalink refusal'}}),503);
 expect(await snapshot()).toEqual(beforeForeign);threadEdge.permalink=undefined;
 // Two simultaneous source roots create one issue and reserve only one identifier.
 const sequenceBefore=await env.DB.prepare('SELECT last_sequence FROM team_issue_sequences WHERE team_id=?').bind(f.initial.teams[0].id).first<number>('last_sequence');
 const concurrentRoot={...payload,event_id:'synthetic-vector-concurrent-root',event:{...payload.event,ts:'1730000004.000001',text:'Concurrent source root'}};
 const rootResults=await Promise.all([send(concurrentRoot),send(concurrentRoot)]);expect(rootResults.map(r=>r.status).sort()).toEqual([200,409]);
 expect(await env.DB.prepare("SELECT count(*) n FROM issues WHERE title='Concurrent source root'").first<number>('n')).toBe(1);
 expect(await env.DB.prepare('SELECT last_sequence FROM team_issue_sequences WHERE team_id=?').bind(f.initial.teams[0].id).first<number>('last_sequence')).toBe(sequenceBefore!+1);
 // Distinct simultaneous captures must both survive the shared identifier allocator.
 const separate=['1730000004.000002','1730000004.000003'].map((ts,index)=>({...payload,event_id:'synthetic-vector-distinct-root-'+index,event:{...payload.event,ts,text:'Distinct concurrent source '+index}}));
 const distinct=await Promise.all(separate.map(value=>send(value)));
 expect(distinct.map(response=>response.status)).toEqual([200,200]);
 expect(new Set(await Promise.all(distinct.map(async response=>(await response.json() as any).identifier))).size).toBe(2);
 expect(await env.DB.prepare('SELECT last_sequence FROM team_issue_sequences WHERE team_id=?').bind(f.initial.teams[0].id).first<number>('last_sequence')).toBe(sequenceBefore!+3);
 // Signed message shortcut shares the same transactional intake, without a rate bucket write on refusal.
 const shortcut={type:'message_action',callback_id:'vector_create_issue',trigger_id:'synthetic-vector-shortcut',team:{id:slackIntakeFixture.team},user:{id:slackIntakeFixture.user},channel:{id:slackIntakeFixture.channel},message:{user:slackIntakeFixture.unlinked,ts:'1730000002.000001',text:'Message shortcut source'}};
 const signShortcut=async(value:unknown,unsigned=false)=>{
  const body=new URLSearchParams({payload:JSON.stringify(value)}).toString(),timestamp=String(Math.floor(Date.now()/1000)),encoder=new TextEncoder();
  const key=await crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const signature='v0='+Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',key,encoder.encode('v0:'+timestamp+':'+body))),b=>b.toString(16).padStart(2,'0')).join('');
  return f.app.request(origin+'/api/integrations/slack/interactive',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded',...(!unsigned?{'x-slack-request-timestamp':timestamp,'x-slack-signature':signature}:{})},body},bindings);
 };
 let before=await snapshot();expect((await signShortcut(shortcut,true)).status).toBe(401);expect(await snapshot()).toEqual(before);
 expect((await signShortcut({...shortcut,user:{id:slackIntakeFixture.unlinked}})).status).toBe(403);expect(await snapshot()).toEqual(before);
 expect((await signShortcut(shortcut)).status).toBe(200);before=await snapshot();expect((await signShortcut(shortcut)).status).toBe(409);expect(await snapshot()).toEqual(before);
 const shortcutRoot=await env.DB.prepare("SELECT c.body,c.actor_operator_id FROM vector_slack_threads m JOIN issue_comments c ON c.id=m.root_comment_id WHERE m.thread_ts='1730000002.000001'").first<any>();
 expect(shortcutRoot.body).toContain('Message shortcut source');expect(shortcutRoot.body).toContain('Slack author: '+slackIntakeFixture.unlinked);
 expect(shortcutRoot.actor_operator_id).toBe(await env.DB.prepare('SELECT operator_id FROM vector_slack_member_links WHERE slack_user_id=?').bind(slackIntakeFixture.user).first('operator_id'));
 await slackThreadImport(f,intake);
 // Queue while public, then make the issue private: final transport must redact.
 const person=await env.DB.prepare('SELECT operator_id FROM vector_slack_member_links WHERE slack_user_id=?').bind(slackIntakeFixture.user).first<string>('operator_id');
 expect((await f.call('/settings/teams/'+f.initial.teams[0].id+'/members/'+person,'PUT',{role:'member'})).status).toBe(200);
 await read(await f.call('/issues/'+identifier+'/comments','POST',{body:'Private content must not leave',parentId:root.id}),201);
 expect((await f.call('/settings/teams/'+f.initial.teams[0].id+'/privacy','PUT',{isPrivate:true})).status).toBe(200);
 const privateBefore=posts().length;
 await dispatchWebhooks(bindings);expect(posts()).toHaveLength(privateBefore);
 const version=await env.DB.prepare('SELECT version FROM issues WHERE identifier=?').bind(identifier).first<number>('version');
 const nextStatus=f.initial.teams[0].statuses.find(s=>s.category==='completed')!;
 await read(await f.call('/issues/'+identifier,'PATCH',{expectedVersion:version,statusId:nextStatus.id}));
 await dispatchWebhooks(bindings);expect(posts().slice(privateBefore).map(c=>c.body.text)).toEqual([identifier+' · '+nextStatus.name,identifier+' · '+nextStatus.name]);
 // Withdraw the original mapper's membership; neither a queued native reply nor signed intake can act.
 expect((await f.call('/settings/teams/'+f.initial.teams[0].id+'/members/'+person,'DELETE')).status).toBe(200);
 const withdrawn=await snapshot();await read(await send(event('synthetic-vector-thread-withdrawn','1730000000.000040','Refused private reply')),403);expect(await snapshot()).toEqual(withdrawn);
 const mark=posts().length;await dispatchWebhooks(bindings);expect(posts()).toHaveLength(mark);
 // Restore holds suppress a queued status and refuse signed intake without changing any table.
 await env.DB.prepare("INSERT INTO vector_restore_status(id,import_id,effects_held) VALUES(1,'synthetic-vector-thread-hold',1)").run();
 const held=await snapshot();await read(await send(event('synthetic-vector-thread-held','1730000000.000041','Refused held reply')),403);expect(await snapshot()).toEqual(held);
 await dispatchWebhooks(bindings);expect(posts()).toHaveLength(mark);expect(await snapshot()).toEqual(held);
 await env.DB.prepare('DELETE FROM vector_restore_status').run();
 // Return the original public-team setup for the existing role and removal proofs.
 expect((await f.call('/settings/teams/'+f.initial.teams[0].id+'/privacy','PUT',{isPrivate:false})).status).toBe(200);
 // Revoking the source link while the channel safety request is in flight prevents the post.
 await read(await f.call('/issues/'+identifier+'/comments','POST',{body:'Revoked during safety lookup',parentId:root.id}),201);
 threadEdge.onInfo=async()=>{threadEdge.onInfo=undefined;expect((await f.call('/settings/integrations/slack/app/members/'+person,'DELETE')).status).toBe(200);};
 const beforeRevocation=posts().length;await dispatchWebhooks(bindings);expect(posts()).toHaveLength(beforeRevocation);
 expect((await f.call('/settings/integrations/slack/app/members','POST',{operatorId:person,slackTeamId:slackIntakeFixture.team,slackUserId:slackIntakeFixture.user})).status).toBe(200);
 await dispatchWebhooks(bindings);expect(posts()).toHaveLength(beforeRevocation);
}
