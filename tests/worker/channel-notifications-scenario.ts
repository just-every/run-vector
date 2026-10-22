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
  for(const unsafe of [{is_member:false},{is_channel:false},{is_shared:true},{is_ext_shared:true},{is_org_shared:true},{is_pending_ext_shared:true},{is_archived:true},{is_frozen:true},{is_frozen:'false'},{is_shared:undefined}]){
   edge.safety(unsafe);const refused=await f.call('/settings/integrations/channels','POST',{scope:'team',objectId:team.id,provider:'slack',channelId:'CDELIVERY',channelName:'unsafe',events:['issue.created']});expect(refused.status).toBe(409);expect((await state()).bindings).toHaveLength(0);
  }edge.safety();
  const project=(await f.mutate('/settings/projects','POST',{name:'Delivery',leadOperatorId:f.owner})).projects.find(p=>p.name==='Delivery')!;
  let binding=await bind('project',project.id);
  const memberCookie=await invite('synthetic-vector-301@vector.test',f.cookie),member=(path:string,method='GET',body?:unknown)=>request('/api'+path,method,body,memberCookie);
  const beforeUnapproved=edge.calls.length;
  expect((await member('/projects/'+project.id+'/slack-channel','POST',{channelId:'CUNAPPROVED'})).status).toBe(403);
  expect(edge.calls).toHaveLength(beforeUnapproved);
  const memberBinding=await member('/projects/'+project.id+'/slack-channel','POST',{channelId:'CDELIVERY'});
  expect(memberBinding.status,await memberBinding.clone().text()).toBe(201);binding=((await memberBinding.json()) as {id:string}).id;
  const createdIssue=await member('/issues','POST',{title:'Ship checkout',description:'Private body never leaves',teamId:team.id,projectId:project.id,statusId:team.statuses.find(s=>s.category==='unstarted')!.id});
  expect(createdIssue.status).toBe(201);const issue=await createdIssue.json() as {identifier:string;version:number};
  await dispatchWebhooks(current);await dispatchWebhooks(current);expect(slack()).toHaveLength(1);
  expect(slack()[0].body.text).toContain(issue.identifier+' · Ship checkout');expect(slack()[0].body.text).toContain('synthetic-vector-301: Created');expect(slack()[0].body.text).toContain(current.APP_ORIGIN+'/app/issues/'+issue.identifier);expect(JSON.stringify(slack())).not.toContain('Private body');
  expect((await f.call('/issues/'+issue.identifier,'PATCH',{expectedVersion:issue.version,statusId:team.statuses.find(s=>s.category==='started')!.id})).status).toBe(200);
  await dispatchWebhooks(current);expect(slack()).toHaveLength(2);expect(slack()[1].body.text).toContain(team.statuses.find(s=>s.category==='unstarted')!.name+' → '+team.statuses.find(s=>s.category==='started')!.name);
  edge.safety({is_ext_shared:true});await f.create({title:'Became shared',projectId:project.id});await dispatchWebhooks(current);expect(slack()).toHaveLength(2);expect((await state()).bindings.find((b:any)=>b.id===binding).suspendedReason).not.toBeNull();
  edge.safety();binding=await bind('project',project.id);await dispatchWebhooks(current);expect(slack()).toHaveLength(2);
  await f.create({title:'Unbound project event',statusId:team.statuses.find(s=>s.category==='unstarted')!.id});await dispatchWebhooks(current);expect(slack()).toHaveLength(2);
  await f.call('/settings/integrations/channels/'+binding,'DELETE');await f.create({projectId:project.id});await dispatchWebhooks(current);expect(slack()).toHaveLength(2);
  let discordId=await bind('project',project.id,'discord',['issue.created']);
  await f.create({projectId:project.id,statusId:team.statuses.find(s=>s.category==='unstarted')!.id});await dispatchWebhooks(current);await dispatchWebhooks(current);expect(discord()).toHaveLength(1);
  await f.create({statusId:team.statuses.find(s=>s.category==='unstarted')!.id});await dispatchWebhooks(current);expect(discord()).toHaveLength(1);
  const retiredDiscord=discordId;discordId=await bind('project',project.id,'discord',['issue.created']);expect(await env.DB.prepare('SELECT 1 FROM vector_integration_secret_keys WHERE identity=?').bind('destination:'+retiredDiscord).first()).toBeNull();
  for(const webhookUrl of ['http://discord.com/api/webhooks/a/b','https://discord.com.evil.test/api/webhooks/a/b','https://discord.com/other/a/b'])expect((await f.call('/settings/integrations/channels','POST',{scope:'team',objectId:team.id,provider:'discord',channelName:'bad',events:['issue.created'],webhookUrl})).status).toBe(400);
  edge.postMode('redirect');await f.create({projectId:project.id});await dispatchWebhooks(current);expect(discord()).toHaveLength(2);expect((await env.DB.prepare("SELECT state FROM integration_deliveries WHERE json_extract(envelope,'$.protocol')='discord' ORDER BY created_at DESC,id DESC LIMIT 1").first())?.state).toBe('rejected');edge.postMode('accepted');
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
  await bind('team',team.id);
  const triageSource=await f.source('channel-triage'),triageBefore=slack().length;
  const triage=await f.signed(triageSource,{teamId:team.id,title:'Customer checkout incident',summary:'Private intake evidence',sourceRecordId:'channel-incident',sourceRevisionId:'one',observedAt:new Date().toISOString()});expect(triage.status,await triage.clone().text()).toBe(200);await dispatchWebhooks(current);expect(slack()).toHaveLength(triageBefore+1);expect(slack().at(-1)!.body.text).toContain('Customer checkout incident');
  edge.postMode('uncertain');await f.create();await dispatchWebhooks(current);const uncertainCount=slack().length;await dispatchWebhooks(current);expect(slack()).toHaveLength(uncertainCount);
  const workspace=await env.DB.prepare('SELECT workspace_id FROM operators WHERE id=?').bind(f.owner).first<string>('workspace_id');
  const uncertain=await env.DB.prepare("SELECT id FROM integration_deliveries WHERE state='uncertain' AND json_extract(envelope,'$.protocol')='slack'").first<{id:string}>();expect(uncertain).not.toBeNull();
  edge.postMode('retry');await f.create();await dispatchWebhooks(current);let retry=await env.DB.prepare("SELECT id,next_at,attempts,max_attempts,state FROM integration_deliveries WHERE state='queued' AND json_extract(envelope,'$.protocol')='slack'").first<any>();expect(retry).not.toBeNull();
  while(retry.state==='queued'){await outboundService(current,workspace!,()=>retry.next_at+1).dispatch(retry.id);retry=await env.DB.prepare('SELECT id,next_at,attempts,max_attempts,state FROM integration_deliveries WHERE id=?').bind(retry.id).first<any>();}expect(retry.attempts).toBe(retry.max_attempts);expect(retry.state).toBe('rejected');
  edge.postMode('accepted');const beforeRemove=slack().length;
  const erased=await f.create();expect((await f.call('/issues/'+erased.identifier,'DELETE',{expectedVersion:erased.version,confirmed:true})).status).toBe(200);await dispatchWebhooks(current);expect(slack()).toHaveLength(beforeRemove);
  expect((await f.call('/settings/integrations/slack','DELETE')).status).toBe(200);expect(edge.calls.filter(c=>c.method==='auth.revoke')).toHaveLength(1);await f.create();await dispatchWebhooks(current);expect(slack()).toHaveLength(beforeRemove);
  edge.renew();
  // A removed binding owner cannot leave a configured destination posting future events;
  // binding channels is an Admin's (role matrix), so the peer is invited as one.
  expect((await f.call('/settings/integrations/slack','POST',{botToken:edge.token})).status).toBe(200);
  const peerCookie=await invite('channels@vector.test',f.cookie,'admin'),peer=await actor(peerCookie);
  expect((await request('/api/settings/integrations/channels','POST',{scope:'team',objectId:team.id,provider:'slack',channelId:'CDELIVERY',channelName:'peer-delivery',events:['triage.created']},peerCookie)).status).toBe(201);
  expect((await f.call('/settings/operators/'+peer,'DELETE')).status).toBe(200);await f.create();await dispatchWebhooks(current);expect(slack()).toHaveLength(beforeRemove);
  await bind('team',team.id);
  await env.DB.prepare("UPDATE vector_integration_secret_keys SET encrypted=? WHERE identity=?").bind('00'.repeat(12)+':'+'ab'.repeat(32),'slack:'+workspace).run();
  await f.create();await dispatchWebhooks(current);expect(slack()).toHaveLength(beforeRemove);expect((await state()).slack).toMatchObject({connected:false,needsAttention:true});
  expect((await f.call('/settings/integrations/slack','POST',{botToken:edge.token})).status).toBe(200);await dispatchWebhooks(current);expect(slack()).toHaveLength(beforeRemove+1);
  const statusState=await f.mutate('/settings/teams/'+team.id+'/statuses','POST',{name:'Validation',category:'started'}),validation=statusState.teams.find(t=>t.id===team.id)!.statuses.find(s=>s.name==='Validation')!;
  const workflowIssue=await f.create({statusId:validation.id});await dispatchWebhooks(current);const workflowBefore=slack().length;
  expect((await f.call('/settings/teams/'+team.id+'/statuses/'+validation.id,'DELETE',{destinationStatusId:team.statuses.find(s=>s.category==='started')!.id})).status).toBe(200);await dispatchWebhooks(current);expect(slack()).toHaveLength(workflowBefore+1);expect(slack().at(-1)!.body.text).toContain('Validation → '+team.statuses.find(s=>s.category==='started')!.name);


  const archivedBefore=slack().length;edge.postMode('archived');await f.create();await dispatchWebhooks(current);expect(slack()).toHaveLength(archivedBefore+1);expect((await state()).bindings.find((b:any)=>b.scope==='team').suspendedReason).not.toBeNull();
  await f.create();await dispatchWebhooks(current);expect(slack()).toHaveLength(archivedBefore+1);edge.postMode('accepted');await bind('team',team.id);await dispatchWebhooks(current);expect(slack()).toHaveLength(archivedBefore+1);await f.create();await dispatchWebhooks(current);expect(slack()).toHaveLength(archivedBefore+2);
 }finally{edge.restore();}
}
