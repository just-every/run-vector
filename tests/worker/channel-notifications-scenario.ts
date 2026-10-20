import {env} from 'cloudflare:workers';
import {expect} from 'vitest';
import type {WorkerBindings} from '../../src/core/app/bindings';
import {dispatchWebhooks,outboundService} from '../../src/core/features/integrations/outbound';
import {channelEdge} from './channel-edge-fixture';
import type {setupIntegrations} from './integration-fixture';
import {request,invite,actor} from './base-auth-fixture';
export async function channelNotifications(f:Awaited<ReturnType<typeof setupIntegrations>>,current:WorkerBindings){
 const edge=channelEdge(),team=f.initial.teams[0];
 const state=async()=>await (await f.call('/settings/integrations/channels')).json() as any;
 const bind=async(scope:string,objectId:string,provider='slack',events=['issue.created','issue.status_changed','triage.created'])=>{
  const response=await f.call('/settings/integrations/channels','POST',{scope,objectId,provider,channelName:'delivery',events,...(provider==='slack'?{channelId:'CDELIVERY'}:{webhookUrl:edge.webhook})});expect(response.status,await response.clone().text()).toBe(201);return (await response.json() as {id:string}).id;
 };
 const slack=()=>edge.calls.filter(c=>c.method==='chat.postMessage'),discord=()=>edge.calls.filter(c=>c.method==='discord');
 try{
  expect((await f.call('/settings/integrations/slack','POST',{botToken:edge.token})).status).toBe(200);
  expect((await state()).slack).toMatchObject({connected:true,needsAttention:false});
  expect(JSON.stringify(await state())).not.toContain(edge.token);
  expect(JSON.stringify((await env.DB.prepare('SELECT * FROM vector_integration_secret_keys').all()).results)).not.toContain(edge.token);
  const project=(await f.mutate('/settings/projects','POST',{name:'Delivery',leadOperatorId:f.owner})).projects.find(p=>p.name==='Delivery')!;
  const binding=await bind('project',project.id);
  const issue=await f.create({title:'Ship checkout',description:'Private body never leaves',projectId:project.id,statusId:team.statuses.find(s=>s.category==='unstarted')!.id});
  await dispatchWebhooks(current);await dispatchWebhooks(current);expect(slack()).toHaveLength(1);
  expect(slack()[0].body.text).toContain(issue.identifier+' · Ship checkout');expect(slack()[0].body.text).toContain('Owner: Created');expect(slack()[0].body.text).toContain(current.APP_ORIGIN+'/app/issues/'+issue.identifier);expect(JSON.stringify(slack())).not.toContain('Private body');
  expect((await f.call('/issues/'+issue.identifier,'PATCH',{expectedVersion:issue.version,statusId:team.statuses.find(s=>s.category==='started')!.id})).status).toBe(200);
  await dispatchWebhooks(current);expect(slack()).toHaveLength(2);expect(slack()[1].body.text).toContain('Unstarted → Started');
  await f.create({title:'Unbound project event',statusId:team.statuses.find(s=>s.category==='unstarted')!.id});await dispatchWebhooks(current);expect(slack()).toHaveLength(2);
  await f.call('/settings/integrations/channels/'+binding,'DELETE');await f.create({projectId:project.id});await dispatchWebhooks(current);expect(slack()).toHaveLength(2);
  const discordId=await bind('project',project.id,'discord',['issue.created']);
  await f.create({projectId:project.id,statusId:team.statuses.find(s=>s.category==='unstarted')!.id});await dispatchWebhooks(current);await dispatchWebhooks(current);expect(discord()).toHaveLength(1);
  await f.create({statusId:team.statuses.find(s=>s.category==='unstarted')!.id});await dispatchWebhooks(current);expect(discord()).toHaveLength(1);
  for(const webhookUrl of ['http://discord.com/api/webhooks/a/b','https://discord.com.evil.test/api/webhooks/a/b','https://discord.com/other/a/b'])expect((await f.call('/settings/integrations/channels','POST',{scope:'team',objectId:team.id,provider:'discord',channelName:'bad',events:['issue.created'],webhookUrl})).status).toBe(400);
  await f.call('/settings/integrations/channels/'+discordId,'DELETE');
  const before=edge.calls.filter(c=>c.method==='conversations.create').length;
  await f.mutate('/settings/projects','POST',{name:'Checkout Delivery',leadOperatorId:f.owner,createSlackChannel:true});
  expect(edge.calls.filter(c=>c.method==='conversations.create').slice(before)).toMatchObject([{body:{name:'checkout-delivery',is_private:false}}]);
  const created=(await state()).bindings.find((b:any)=>b.channelId==='CFIXTURE');expect(created.objectName).toBe('Checkout Delivery');
  edge.createError('name_taken');expect((await f.call('/settings/projects','POST',{name:'Duplicate channel',leadOperatorId:f.owner,createSlackChannel:true})).status).toBe(400);expect(edge.calls.filter(c=>c.method==='conversations.create')).toHaveLength(before+2);expect((await f.state()).projects.some(p=>p.name==='Duplicate channel')).toBe(false);edge.createError(null);
  await f.call('/settings/integrations/channels/'+created.id,'DELETE');
  const viewResponse=await f.call('/views','POST',{name:'High delivery',isShared:true,query:{priority:'high'}});expect(viewResponse.status).toBe(201);const view=await viewResponse.json() as {id:string};
  const viewId=await bind('view',view.id);
  await f.create({priority:'low'});await f.create({priority:'high'});await dispatchWebhooks(current);const viewPosts=slack().length;expect(viewPosts).toBe(3);await f.call('/settings/integrations/channels/'+viewId,'DELETE');
  const teamBinding=await bind('team',team.id);edge.postMode('uncertain');await f.create();await dispatchWebhooks(current);const uncertainCount=slack().length;await dispatchWebhooks(current);expect(slack()).toHaveLength(uncertainCount);
  const workspace=await env.DB.prepare('SELECT workspace_id FROM operators WHERE id=?').bind(f.owner).first<string>('workspace_id');
  const uncertain=await env.DB.prepare("SELECT id FROM integration_deliveries WHERE state='uncertain' AND json_extract(envelope,'$.protocol')='slack'").first<{id:string}>();expect(uncertain).not.toBeNull();
  edge.postMode('retry');await f.create();await dispatchWebhooks(current);let retry=await env.DB.prepare("SELECT id,next_at,attempts,max_attempts,state FROM integration_deliveries WHERE state='queued' AND json_extract(envelope,'$.protocol')='slack'").first<any>();expect(retry).not.toBeNull();
  while(retry.state==='queued'){await outboundService(current,workspace!,()=>retry.next_at+1).dispatch(retry.id);retry=await env.DB.prepare('SELECT id,next_at,attempts,max_attempts,state FROM integration_deliveries WHERE id=?').bind(retry.id).first<any>();}expect(retry.attempts).toBe(retry.max_attempts);expect(retry.state).toBe('rejected');
  edge.postMode('accepted');const beforeRemove=slack().length;
  const erased=await f.create();expect((await f.call('/issues/'+erased.identifier,'DELETE',{expectedVersion:erased.version,confirmed:true})).status).toBe(200);await dispatchWebhooks(current);expect(slack()).toHaveLength(beforeRemove);
  expect((await f.call('/settings/integrations/slack','DELETE')).status).toBe(200);await f.create();await dispatchWebhooks(current);expect(slack()).toHaveLength(beforeRemove);
  // A removed binding owner cannot leave a configured destination posting future events.
  expect((await f.call('/settings/integrations/slack','POST',{botToken:edge.token})).status).toBe(200);
  const peerCookie=await invite('channels@vector.test',f.cookie),peer=await actor(peerCookie);
  expect((await request('/api/settings/integrations/channels','POST',{scope:'team',objectId:team.id,provider:'slack',channelId:'CDELIVERY',channelName:'peer-delivery',events:['triage.created']},peerCookie)).status).toBe(201);
  expect((await f.call('/settings/operators/'+peer,'DELETE')).status).toBe(200);await f.create();await dispatchWebhooks(current);expect(slack()).toHaveLength(beforeRemove);
 }finally{edge.restore();}
}
