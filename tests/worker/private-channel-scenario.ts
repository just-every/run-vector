import {env} from 'cloudflare:workers';
import {expect} from 'vitest';
import type {WorkerBindings} from '../../src/core/app/bindings';
import {dispatchWebhooks,outboundService} from '../../src/core/features/integrations/outbound';
import {channelEdge} from './channel-edge-fixture';
import {request,invite,actor} from './base-auth-fixture';
import type {setupIntegrations} from './integration-fixture';

export async function privateChannelRouting(f:Awaited<ReturnType<typeof setupIntegrations>>,current:WorkerBindings){
 const edge=channelEdge();let destination:string|undefined;
 try {
  expect((await f.call('/settings/integrations/slack','POST',{botToken:edge.token})).status).toBe(200);
  const team=(await f.mutate('/settings/teams','POST',{name:'synthetic-vector-975',identifierPrefix:'SYNSEC'})).teams.find(t=>t.name==='synthetic-vector-975')!;
  const project=(await f.mutate('/settings/projects','POST',{name:'synthetic-vector-976',leadOperatorId:f.owner})).projects.find(p=>p.name==='synthetic-vector-976')!;
  const viewResponse=await f.call('/views','POST',{name:'synthetic-vector-977',isShared:true,query:{team:team.id}});expect(viewResponse.status).toBe(201);const view=await viewResponse.json() as {id:string};
  for(const [scope,objectId,channelId] of [['team',team.id,'CPRIVATE'],['project',project.id,'CPROJECT'],['view',view.id,'CVIEW']])expect((await f.call('/settings/integrations/channels','POST',{scope,objectId,provider:'slack',channelId,channelName:'synthetic-vector-978',events:['issue.created','issue.status_changed']})).status).toBe(201);
  const registered=await f.call('/settings/integrations/destinations','POST',{name:'synthetic-vector-994',url:'https://synthetic-vector-994.example.com/events'});expect(registered.status).toBe(201);destination=(await registered.json() as {id:string}).id;
  const posts=()=>edge.calls.filter(c=>c.method==='chat.postMessage');
  // The immutable queued envelope still has public text. Final delivery must re-project it.
  edge.postMode('retry');
  const issue=await f.create({teamId:team.id,projectId:project.id,title:'synthetic-vector-979',statusId:team.statuses.find(s=>s.category==='unstarted')!.id});
  const webhookCalls:string[]=[];
  const blockedEdge={...current,INTEGRATION_EGRESS:{async send(wire:{body:string}){webhookCalls.push(wire.body);return {status:429,headers:{'retry-after':'1'},body:''};}}};
  await dispatchWebhooks(blockedEdge);expect(posts().filter(p=>p.body.text?.includes('synthetic-vector-979'))).toHaveLength(3);
  const pendingWebhooks=(await env.DB.prepare("SELECT id,next_at FROM integration_deliveries WHERE state='queued' AND json_extract(envelope,'$.protocol')='webhook' AND json_extract(json_extract(envelope,'$.body'),'$.identifier')=?").bind(issue.identifier).all<{id:string;next_at:number}>()).results;
  expect(pendingWebhooks.length).toBeGreaterThan(0);
  expect((await f.call(`/settings/teams/${team.id}/privacy`,'PUT',{isPrivate:true})).status).toBe(200);
  const workspace=(await env.DB.prepare('SELECT workspace_id FROM operators WHERE id=?').bind(f.owner).first<string>('workspace_id'))!;
  const queued=(await env.DB.prepare("SELECT id,next_at FROM integration_deliveries WHERE state='queued' AND json_extract(envelope,'$.protocol')='slack' AND json_extract(json_extract(envelope,'$.body'),'$.text') LIKE '%synthetic-vector-979%'").all<{id:string;next_at:number}>()).results;
  const sentBefore=webhookCalls.length;
  for(const item of pendingWebhooks){const outcome=await outboundService(blockedEdge,workspace,()=>item.next_at+1).dispatch(item.id);expect(outcome?.state).toBe('rejected');}
  expect(webhookCalls).toHaveLength(sentBefore);
  edge.postMode('accepted');const before=posts().length;
  for(const item of queued)await outboundService(current,workspace,()=>item.next_at+1).dispatch(item.id);
  const privatePosts=posts().slice(before);expect(privatePosts).toHaveLength(1);expect(privatePosts[0].body.channel).toBe('CPRIVATE');expect(privatePosts[0].body.text).toBe('Private work changed. Sign in to Vector to view it.');
  for(const secret of ['synthetic-vector-979',issue.identifier,'Sarah','Unstarted'])expect(JSON.stringify(privatePosts)).not.toContain(secret);
  const now=await f.create({teamId:team.id,projectId:project.id,title:'synthetic-vector-982'});const next=posts().length;
  await dispatchWebhooks(current);expect(posts().slice(next)).toHaveLength(1);expect(posts().at(-1)!.body.channel).toBe('CPRIVATE');
  expect(await env.DB.prepare("SELECT count(*) n FROM vector_webhook_events e JOIN vector_webhook_destinations d ON d.id=e.destination_id WHERE d.kind='webhook' AND json_extract(e.body,'$.identifier')=?").bind(now.identifier).first('n')).toBe(0);
  // Explicitly mapped DMs also become generic, and membership withdrawal suppresses them.
  const email='synthetic-vector-983@vector.test',cookie=await invite(email,f.cookie),person=await actor(cookie),send=(path:string,method='GET',body?:unknown)=>request('/api'+path,method,body,cookie);
  edge.users(email,'UPRIVATE','synthetic-vector-983');
  expect((await send('/settings/notifications/slack/link','POST',{slackUserId:'UPRIVATE'})).status).toBe(200);
  expect((await send('/settings/notifications/channels','PUT',{channels:[{kind:'assignment',emailMode:'off',slack:true}]})).status).toBe(200);
  expect((await f.call(`/settings/teams/${team.id}/members/${person}`,'PUT',{role:'member'})).status).toBe(200);
  const count=posts().length;
  const assigned=await f.create({teamId:team.id,title:'synthetic-vector-984',assigneeOperatorId:person});
  const dms=posts().slice(count).filter(p=>String(p.body.channel).startsWith('D'));expect(dms).toHaveLength(1);expect(dms[0].body.text).toBe('Private work changed. Sign in to Vector to view it.');expect(JSON.stringify(dms)).not.toContain('synthetic-vector-984');
  expect((await f.call(`/settings/teams/${team.id}/members/${person}`,'DELETE')).status).toBe(200);
  const prior=posts().length;
  expect((await f.call(`/issues/${assigned.identifier}`,'PATCH',{expectedVersion:assigned.version,assigneeOperatorId:null})).status).toBe(200);
  const version=await env.DB.prepare('SELECT version FROM issues WHERE id=?').bind(assigned.id).first<number>('version');
  expect((await f.call(`/issues/${assigned.identifier}`,'PATCH',{expectedVersion:version,assigneeOperatorId:person})).status).toBe(200);
  expect(posts().slice(prior).filter(p=>String(p.body.channel).startsWith('D'))).toEqual([]);
  // A bound view is evaluated at dispatch over its binder's current visibility: a nonmember Admin's
  // NOT related=none never matches through a relation to hidden private work, and withdrawal removes it again.
  const adminCookie=await invite('synthetic-vector-985@vector.test',f.cookie,'admin'),admin=await actor(adminCookie),asAdmin=(path:string,method='GET',body?:unknown)=>request('/api'+path,method,body,adminCookie);
  const secret=(await f.mutate('/settings/teams','POST',{name:'synthetic-vector-986',identifierPrefix:'SYNREL',isPrivate:true})).teams.find(t=>t.name==='synthetic-vector-986')!;
  const publicIssue=await f.create({title:'synthetic-vector-987'}),hiddenIssue=await f.create({teamId:secret.id,title:'synthetic-vector-988'});
  expect((await f.call(`/issues/${publicIssue.identifier}/dependencies`,'POST',{direction:'related',relatedIdentifier:hiddenIssue.identifier,expectedVersion:publicIssue.version,relatedVersion:hiddenIssue.version})).status).toBe(200);
  const query={q:'synthetic-vector-987',expression:'NOT related=none'},linked=await asAdmin('/views','POST',{name:'synthetic-vector-989',query});expect(linked.status).toBe(201);
  expect((await asAdmin('/settings/integrations/channels','POST',{scope:'view',objectId:(await linked.json() as {id:string}).id,provider:'slack',channelId:'CLINKED',channelName:'synthetic-vector-989',events:['issue.status_changed']})).status).toBe(201);
  const statuses=['started','unstarted','started'].map(c=>f.initial.teams[0].statuses.find(s=>s.category===c)!),linkedPosts:number[]=[];
  const move=async(n:number)=>{
   const version=await env.DB.prepare('SELECT version FROM issues WHERE id=?').bind(publicIssue.id).first<number>('version');
   expect((await f.call(`/issues/${publicIssue.identifier}`,'PATCH',{expectedVersion:version,statusId:statuses[n].id})).status).toBe(200);
   await dispatchWebhooks(current);linkedPosts.push(posts().filter(p=>p.body.channel==='CLINKED').length);
  };
  expect((await asAdmin(`/issues?${new URLSearchParams(query)}`).then(r=>r.json()) as {total:number}).total).toBe(0);
  await move(0);
  expect((await f.call(`/settings/teams/${secret.id}/members/${admin}`,'PUT',{role:'member'})).status).toBe(200);await move(1);
  expect((await f.call(`/settings/teams/${secret.id}/members/${admin}`,'DELETE')).status).toBe(200);await move(2);
  expect(linkedPosts).toEqual([0,1,1]);
 }finally{if(destination)expect((await f.call('/settings/integrations/destinations/'+destination,'DELETE')).status).toBe(200);edge.restore();}
}
