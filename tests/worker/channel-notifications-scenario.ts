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
  const memberCookie=await invite('synthetic-vector-301'+String.fromCharCode(64)+'vector.test',f.cookie),member=(path:string,method='GET',body?:unknown)=>request('/api'+path,method,body,memberCookie);
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
  const peerCookie=await invite('channels'+String.fromCharCode(64)+'vector.test',f.cookie,'admin'),peer=await actor(peerCookie);
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
  await initiativeChannels(f,current,edge);
  await scopedInitiativeChannels(f,current,edge);
 }finally{edge.restore();}
}

/** Both real provider edges receive only the bound initiative's selected writes. */
export async function initiativeChannels(f:Awaited<ReturnType<typeof setupIntegrations>>,current:WorkerBindings,edge:ReturnType<typeof channelEdge>){
 const json=async(response:Response,status=200)=>{expect(response.status,await response.clone().text()).toBe(status);return response.json() as Promise<any>;};
 const workspace=(await env.DB.prepare('SELECT workspace_id FROM operators WHERE id=?').bind(f.owner).first<string>('workspace_id'))!;
 const root=await json(await f.call('/initiatives','POST',{name:'synthetic-vector-1810',description:'synthetic-vector-1811 confidential direction',ownerOperatorId:f.owner}),201);
 const other=await json(await f.call('/initiatives','POST',{name:'synthetic-vector-1812',ownerOperatorId:f.owner}),201);
 const project=(await f.mutate('/settings/projects','POST',{name:'synthetic-vector-1813 secret project',leadOperatorId:f.owner})).projects.find(p=>p.name==='synthetic-vector-1813 secret project')!;
 const team=f.initial.teams[0];await f.create({projectId:project.id,teamId:team.id});
 const bind=async(provider:string,events=['initiative.updated'])=>(await json(await f.call('/settings/integrations/channels','POST',{scope:'initiative',objectId:root.id,provider,channelName:'initiative-delivery',events,...(provider==='slack'?{channelId:'CINITIATIVE'}:{webhookUrl:edge.webhook})}),201)).id as string;
 const update=async(id=root.id)=>{const old=await json(await f.call('/initiatives/'+id));return json(await f.call('/initiatives/'+id,'PATCH',{expectedVersion:old.version,description:'synthetic-vector-1814 confidential update'}));};
 const posts=()=>edge.calls.filter(c=>(c.method==='chat.postMessage'||c.method==='discord')&&(String(c.body.text??c.body.content).includes('/app/initiatives/'+root.id)||String(c.body.text??c.body.content).includes('Private work changed. Sign in to Vector to view it.')));
 const events=async(destination:string)=>(await env.DB.prepare('SELECT id,body FROM vector_webhook_events WHERE destination_id=? ORDER BY created_at,id').bind(destination).all<{id:string;body:string}>()).results;
 // An object posts only the events it produces; a mismatch is refused before any provider call, seal or write.
 const stored=()=>Promise.all(['vector_channel_bindings','vector_initiative_channel_bindings','vector_webhook_destinations','vector_integration_secret_keys','audit_records'].map(table=>env.DB.prepare('SELECT COUNT(*) n FROM '+table).first<number>('n')));
 for(const [scope,objectId,mismatched] of [['initiative',root.id,['issue.created']],['team',team.id,['initiative.updated']]] as const)for(const provider of ['slack','discord']){
  const before=await stored(),calls=edge.calls.length,refused=await f.call('/settings/integrations/channels','POST',{scope,objectId,provider,channelName:'synthetic-vector-1817',events:mismatched,...(provider==='slack'?{channelId:'CMISMATCH'}:{webhookUrl:edge.webhook})});
  expect(refused.status,scope+' '+provider+' mismatch').toBe(400);expect(((await refused.json()) as {error:string}).error).toBe('channel_event_scope');
  expect(await stored(),'refused binding writes nothing').toEqual(before);expect(edge.calls,'refused binding calls no provider').toHaveLength(calls);
 }
 await json(await f.call('/settings/integrations/channels','POST',{scope:'team',objectId:team.id,provider:'slack',channelId:'CDELIVERY',channelName:'delivery',events:['triage.created','issue.created','issue.status_changed']}),201);
 for(const provider of ['slack','discord']){
  const creationBefore=posts().length,creationBinding=await bind(provider,['initiative.created']);
  const creationEvents=await events(creationBinding);expect(creationEvents,'selected creation is enqueued by the public binding door').toHaveLength(1);
  expect(JSON.parse(creationEvents[0].body)).toMatchObject({initiativeId:root.id,actorId:f.owner,change:'Initiative created'});
  await dispatchWebhooks(current);await dispatchWebhooks(current);await outboundService(current,workspace).dispatch(creationEvents[0].id);
  expect(posts(),'selected creation posts exactly once per provider after repeated dispatch').toHaveLength(creationBefore+1);
  const creationMessage=posts().at(-1)!;expect(creationMessage.method).toBe(provider==='slack'?'chat.postMessage':'discord');
  expect(creationMessage.body.text??creationMessage.body.content).toBe(root.name+'\n'+f.initial.operators.find(o=>o.id===f.owner)!.name+': Initiative created\n'+current.APP_ORIGIN+'/app/initiatives/'+root.id);
  await json(await f.call('/settings/integrations/channels/'+creationBinding,'DELETE'));
  let binding=await bind(provider),before=posts().length;
  const state=await json(await f.call('/settings/integrations/channels'));expect(state.objects).toContainEqual({id:root.id,name:root.name,scope:'initiative'});expect(state.bindings.find((b:any)=>b.id===binding)).toMatchObject({scope:'initiative',objectName:root.name,events:['initiative.updated']});
  const old=await json(await f.call('/initiatives/'+root.id));
  await json(await f.call('/initiatives/'+root.id+'/projects','PUT',{expectedVersion:old.version,projectIds:[project.id]}));
  await update(other.id);await dispatchWebhooks(current);
  expect(await events(binding),'unselected project change and another initiative enqueue nothing').toHaveLength(0);expect(posts()).toHaveLength(before);
  const updated=await update();const queued=await events(binding);expect(queued).toHaveLength(1);expect(JSON.parse(queued[0].body)).toMatchObject({initiativeId:root.id,initiativeName:root.name,actorId:f.owner,change:expect.stringContaining('Initiative updated')});
  expect((await f.call('/initiatives/'+root.id,'PATCH',{expectedVersion:old.version,status:'active'})).status).toBe(409);expect(await events(binding),'stale writes enqueue nothing').toEqual(queued);
  await dispatchWebhooks(current);await dispatchWebhooks(current);
  await outboundService(current,workspace).dispatch(queued[0].id);await outboundService(current,workspace).dispatch(queued[0].id);
  expect(posts(),'re-dispatch never repeats an accepted initiative event').toHaveLength(before+1);
  const message=posts().at(-1)!.body,text=message.text??message.content;expect(text).toContain(root.name);expect(text).toContain(f.initial.operators.find(o=>o.id===f.owner)!.name+': Initiative updated');expect(text).toContain(current.APP_ORIGIN+'/app/initiatives/'+root.id);expect(text).not.toContain('confidential');expect(text).not.toContain(project.name);expect(message).not.toHaveProperty('identifier');
  if(provider==='slack')expect(message).toMatchObject({channel:'CINITIATIVE',unfurl_links:false,unfurl_media:false,parse:'none',mrkdwn:false});else expect(message).toMatchObject({allowed_mentions:{parse:[]},flags:4});
  const retired=binding;binding=await bind(provider,['initiative.projects_changed']);expect(await env.DB.prepare('SELECT 1 FROM vector_integration_secret_keys WHERE identity=?').bind('destination:'+retired).first()).toBeNull();
  // Visibility changes after production are checked at dispatch, with no project names projected.
  await json(await f.call('/initiatives/'+root.id+'/projects','PUT',{expectedVersion:updated.version,projectIds:[project.id]}));
  await f.mutate('/settings/teams/'+team.id+'/privacy','PUT',{isPrivate:true});await dispatchWebhooks(current);expect(posts()).toHaveLength(before+2);expect(posts().at(-1)!.body,'complete private notice at '+provider+' edge').toEqual(provider==='slack'?{channel:'CINITIATIVE',text:'Private work changed. Sign in to Vector to view it.',unfurl_links:false,unfurl_media:false,parse:'none',mrkdwn:false}:{content:'Private work changed. Sign in to Vector to view it.',allowed_mentions:{parse:[]},flags:4});expect(JSON.stringify(posts())).not.toContain(project.name);
  await f.mutate('/settings/teams/'+team.id+'/privacy','PUT',{isPrivate:false});
  binding=await bind(provider);await update();edge.postMode('uncertain');await dispatchWebhooks(current);edge.postMode('accepted');
  const unknown=(await events(binding))[0];expect((await outboundService(current,workspace).get(unknown.id))?.state).toBe('uncertain');await outboundService(current,workspace).dispatch(unknown.id);expect(posts(),'uncertain initiative send is never retried').toHaveLength(before+3);
  await json(await f.call('/settings/integrations/channels/'+binding,'DELETE'));
  binding=await bind(provider);await update();edge.postMode('redirect');await dispatchWebhooks(current);edge.postMode('accepted');
  const rejected=(await events(binding))[0];expect((await outboundService(current,workspace).get(rejected.id))?.state).toBe('rejected');await outboundService(current,workspace).dispatch(rejected.id);expect(posts(),'terminal initiative refusal stays terminal').toHaveLength(before+4);
  await json(await f.call('/settings/integrations/channels/'+binding,'DELETE'));
  binding=await bind(provider);await update();await json(await f.call('/settings/integrations/channels/'+binding,'DELETE'));await dispatchWebhooks(current);expect(posts(),'revoked pending destination posts nothing').toHaveLength(before+4);
  binding=await bind(provider);await update();
  await env.DB.prepare('INSERT OR REPLACE INTO vector_restore_status(id,import_id,effects_held) VALUES(1,?,1)').bind('synthetic-vector-1815').run();
  await dispatchWebhooks(current);expect(posts(),'restore-held effects post nothing').toHaveLength(before+4);
  await env.DB.prepare('DELETE FROM vector_restore_status').run();
  await json(await f.call('/settings/integrations/channels/'+binding,'DELETE'));
  binding=await bind(provider);
  const cookie=await invite('synthetic-vector-1816-'+provider+String.fromCharCode(64)+'vector.test',f.cookie),memberId=await actor(cookie),oldMember=await json(await f.call('/initiatives/'+root.id));
  await json(await request('/api/initiatives/'+root.id,'PATCH',{expectedVersion:oldMember.version,status:'active'},cookie));
  await json(await f.call('/settings/operators/'+memberId+'/role','PATCH',{role:'guest',teamIds:[team.id]}));
  await dispatchWebhooks(current);expect(posts(),'actor lost initiative access before dispatch').toHaveLength(before+4);
  await json(await f.call('/settings/integrations/channels/'+binding,'DELETE'));
 }
}

/** ct 27 Oct (INIT-001): a Member binds only to an Owner- or Admin-approved destination, rechecked before every post. */
export async function scopedInitiativeChannels(f:Awaited<ReturnType<typeof setupIntegrations>>,current:WorkerBindings,edge:ReturnType<typeof channelEdge>){
 const json=async(response:Response,status=200)=>{expect(response.status,await response.clone().text()).toBe(status);return response.json() as Promise<any>;};
 const workspace=(await env.DB.prepare('SELECT workspace_id FROM operators WHERE id=?').bind(f.owner).first<string>('workspace_id'))!;
 edge.workspace('TSYNTHETICA');await json(await f.call('/settings/integrations/slack','POST',{botToken:edge.token}));
 const root=await json(await f.call('/initiatives','POST',{name:'synthetic-vector-1830',ownerOperatorId:f.owner}),201);
 const other=await json(await f.call('/initiatives','POST',{name:'synthetic-vector-1831',ownerOperatorId:f.owner}),201);
 const approve=async(body:Record<string,string>)=>json(await f.call('/settings/integrations/channels/initiative-approvals','POST',{audience:'workspace',...body}),201);
 const source=(await json(await f.call('/settings/integrations/channels','POST',{scope:'initiative',objectId:other.id,provider:'discord',channelName:'synthetic-vector-1832',events:['initiative.projects_changed'],webhookUrl:edge.webhook}),201)).id as string;
 const ownerProject=(await f.mutate('/settings/projects','POST',{name:'synthetic-vector-1833',leadOperatorId:f.owner})).projects.find(p=>p.name==='synthetic-vector-1833')!;
 await json(await f.call('/settings/integrations/channels','POST',{scope:'project',objectId:ownerProject.id,provider:'slack',channelId:'COWNERONLY',channelName:'delivery',events:['issue.created']}),201);
 const approvalRows=async()=>(await env.DB.prepare('SELECT * FROM vector_initiative_destination_approvals ORDER BY id').all()).results;
 const approvalAudits=async()=>(await env.DB.prepare("SELECT * FROM audit_records WHERE action='channel.initiative_destination_approved' ORDER BY id").all()).results;
 const firstRows=await approvalRows(),firstAudits=await approvalAudits();
 expect(await approve({provider:'slack',initiativeId:root.id,channelId:'CSCOPED'})).toMatchObject({approved:true,changed:true});
 expect(await approvalRows()).toHaveLength(firstRows.length+1);expect(await approvalAudits()).toHaveLength(firstAudits.length+1);
 const usableRows=await approvalRows(),usableAudits=await approvalAudits();
 expect(await approve({provider:'slack',initiativeId:root.id,channelId:'CSCOPED'})).toMatchObject({changed:false});
 expect(await approvalRows(),'usable approval writes no row').toEqual(usableRows);expect(await approvalAudits(),'usable approval writes no audit').toEqual(usableAudits);
 await approve({provider:'discord',initiativeId:root.id,destinationId:source});await approve({provider:'slack',initiativeId:other.id,channelId:'COTHERINIT'});
 const webhook=new URL(edge.webhook).pathname.split('/')[3];
 const cookie=await invite('synthetic-vector-1834'+String.fromCharCode(64)+'vector.test',f.cookie),memberId=await actor(cookie),member=(path:string,method='GET',body?:unknown)=>request('/api'+path,method,body,cookie);
 const door='/initiatives/'+root.id+'/channel-binding',bindingState=async()=>json(await member(door));
 const slackPosts=()=>edge.calls.filter(c=>c.method==='chat.postMessage'&&c.body.channel==='CSCOPED'),discordPosts=()=>edge.calls.filter(c=>c.method==='discord'&&String(c.body.content).includes('/app/initiatives/'+root.id));
 const edit=async(by:(path:string,method?:string,body?:unknown)=>Promise<Response>)=>{const old=await json(await f.call('/initiatives/'+root.id));return json(await by('/initiatives/'+root.id,'PATCH',{expectedVersion:old.version,description:'synthetic-vector-1835 confidential '+old.version}));};
 const custody=async()=>Promise.all(['vector_initiative_destination_approvals','vector_initiative_channel_bindings','vector_initiative_scoped_bindings','vector_webhook_destinations','vector_webhook_events','audit_records'].map(async table=>(await env.DB.prepare('SELECT * FROM '+table+' ORDER BY 1').all()).results));
 let state=await bindingState();
 expect(state.destinations.map((d:any)=>d.provider+':'+d.channelId).sort(),'only destinations approved for this initiative').toEqual(['discord:'+webhook,'slack:CSCOPED']);
 // (b) Approval for another initiative, an Owner's unrelated binding and a borrowed display name all refuse with no row and no provider call.
 const refusedBefore=await custody(),callsBefore=edge.calls.length;
 for(const channelId of ['COTHERINIT','COWNERONLY','CDISPLAYNAME'])expect((await member(door,'PUT',{provider:'slack',channelId,channelName:'delivery',events:['initiative.updated'],expectedVersion:null})).status,'unapproved '+channelId).toBe(403);
 expect(await custody()).toEqual(refusedBefore);expect(edge.calls).toHaveLength(callsBefore);
 // (a) The Member binds each approved destination, edits, and each provider edge receives exactly one post.
 let saved=await json(await member(door,'PUT',{provider:'slack',channelId:'CSCOPED',events:['initiative.updated'],expectedVersion:null}));
 await edit(member);await dispatchWebhooks(current);await dispatchWebhooks(current);
 for(const event of (await env.DB.prepare('SELECT id FROM vector_webhook_events WHERE destination_id=?').bind(saved.id).all<{id:string}>()).results)await outboundService(current,workspace).dispatch(event.id);
 expect(slackPosts(),'one Slack post through the scoped binding; replay adds none').toHaveLength(1);
 expect(slackPosts()[0].body.text).toBe(root.name+'\nsynthetic-vector-1834: Initiative updated · Description changed\n'+current.APP_ORIGIN+'/app/initiatives/'+root.id);
 saved=await json(await member(door,'PUT',{provider:'discord',channelId:webhook,events:['initiative.updated','initiative.projects_changed'],expectedVersion:saved.version}));
 await edit(member);await dispatchWebhooks(current);await dispatchWebhooks(current);
 expect(discordPosts(),'one Discord post through the scoped binding; replay adds none').toHaveLength(1);expect(slackPosts()).toHaveLength(1);
 expect((await bindingState()).binding).toMatchObject({provider:'discord',channelId:webhook,events:['initiative.updated','initiative.projects_changed'],live:true});
 // (c) A demoted binder is refused at the door and their saved binding posts nothing; removal does the same.
 await json(await f.call('/settings/operators/'+memberId+'/role','PATCH',{role:'guest',teamIds:[f.initial.teams[0].id]}));
 expect((await member(door,'PUT',{provider:'discord',channelId:webhook,events:['initiative.updated'],expectedVersion:saved.version})).status).toBe(403);
 expect((await json(await f.call(door))).binding).toMatchObject({live:false,notPosting:{code:'binder_cannot_edit'}});
 expect((await json(await f.call('/settings/integrations/channels'))).bindings.find((b:any)=>b.id===saved.id)).toMatchObject({needsAttention:false,scoped:true,notPosting:{code:'binder_cannot_edit'}});
 await edit(f.call);await dispatchWebhooks(current);expect(discordPosts(),'demoted binder posts nothing').toHaveLength(1);
 await json(await f.call('/settings/operators/'+memberId+'/role','PATCH',{role:'member',teamIds:[]}));
 // (e) Withdrawal stops the pending and later events; re-approval replays nothing until the Member binds again.
 saved=await json(await member(door,'PUT',{provider:'slack',channelId:'CSCOPED',events:['initiative.updated'],expectedVersion:saved.version}));
 await edit(f.call);expect((await env.DB.prepare('SELECT count(*) n FROM vector_webhook_events WHERE destination_id=?').bind(saved.id).first<number>('n')),'pending event').toBe(1);
 const settings=await json(await f.call('/settings/integrations/channels')),approval=settings.approvals.find((a:any)=>a.initiativeId===root.id&&a.channelId==='CSCOPED');
 await json(await f.call('/settings/integrations/channels/initiative-approvals/'+approval.id,'DELETE'));
 await dispatchWebhooks(current);await edit(f.call);await dispatchWebhooks(current);expect(slackPosts(),'withdrawn approval: pending and later events post nothing').toHaveLength(1);
 expect((await bindingState()).binding).toMatchObject({provider:'slack',channelId:'CSCOPED',live:false,notPosting:{code:'approval_withdrawn'}});
 await approve({provider:'slack',initiativeId:root.id,channelId:'CSCOPED'});await dispatchWebhooks(current);await edit(f.call);await dispatchWebhooks(current);
 expect(slackPosts(),'re-approval never replays or revives the withdrawn binding').toHaveLength(1);
 expect((await bindingState()).binding).toMatchObject({live:false,notPosting:{code:'approved_again'}});
 state=await bindingState();saved=await json(await member(door,'PUT',{provider:'slack',channelId:'CSCOPED',events:['initiative.updated'],expectedVersion:state.version}));
 await edit(f.call);await dispatchWebhooks(current);expect(slackPosts(),'fresh binding posts only the new event').toHaveLength(2);
 expect((await env.DB.prepare("SELECT action,count(*) n FROM audit_records WHERE action IN('channel.initiative_destination_approved','channel.initiative_destination_withdrawn') GROUP BY action ORDER BY action").all()).results).toEqual([{action:'channel.initiative_destination_approved',n:4},{action:'channel.initiative_destination_withdrawn',n:1}]);
 // A replacement source leaves the old approval present but unusable until an explicit approval and save.
 saved=await json(await member(door,'PUT',{provider:'discord',channelId:webhook,events:['initiative.updated'],expectedVersion:saved.version}));
 const discordApproval=(await approvalRows()).find(row=>row.initiative_id===root.id&&row.provider==='discord')!;
 const destinationRow=(id:string)=>env.DB.prepare('SELECT enabled,revoked_at FROM vector_webhook_destinations WHERE id=?').bind(id).first();
 await edit(f.call);
 expect(await env.DB.prepare('SELECT count(*) n FROM vector_webhook_events WHERE destination_id=? AND enqueued_at IS NULL').bind(saved.id).first<number>('n')).toBe(1);
 const replacement=(await json(await f.call('/settings/integrations/channels','POST',{scope:'initiative',objectId:other.id,provider:'discord',channelName:'synthetic-vector-1832',events:['initiative.projects_changed'],webhookUrl:edge.webhook}),201)).id as string;
 expect(await destinationRow(source)).toMatchObject({enabled:0,revoked_at:expect.any(String)});
 expect(await destinationRow(replacement)).toMatchObject({enabled:1,revoked_at:null});
 expect(await destinationRow(saved.id)).toMatchObject({enabled:1,revoked_at:null});
 expect((await approvalRows()).find(row=>row.id===discordApproval.id)).toEqual(discordApproval);
 const sourceChanged=async(approvalId:unknown,available:boolean)=>{
  const reason={code:'source_changed',sourceAvailable:available},settings=await json(await f.call('/settings/integrations/channels'));
  expect((await bindingState()).binding).toMatchObject({id:saved.id,live:false,notPosting:reason});
  expect((await bindingState()).destinations.some((d:any)=>d.provider==='discord')).toBe(false);
  expect(settings.approvals.find((a:any)=>a.id===approvalId)).toMatchObject({usable:false,notPosting:reason});
  expect(settings.bindings.find((b:any)=>b.id===saved.id)).toMatchObject({scoped:true,needsAttention:false,notPosting:reason});
  const rows=await custody(),calls=edge.calls.length;
  expect((await member(door,'PUT',{provider:'discord',channelId:webhook,events:['initiative.updated'],expectedVersion:saved.version})).status).toBe(403);
  expect(await custody()).toEqual(rows);expect(edge.calls).toHaveLength(calls);
 };
 await sourceChanged(discordApproval.id,true);
 await dispatchWebhooks(current);await edit(f.call);await dispatchWebhooks(current);expect(discordPosts()).toHaveLength(1);
 const beforeSourceRows=(await approvalRows()).length,beforeSourceAudits=(await approvalAudits()).length;
 expect(await approve({provider:'discord',initiativeId:root.id,destinationId:replacement})).toMatchObject({changed:true});
 const replacementApproval=(await approvalRows()).find(row=>row.initiative_id===root.id&&row.provider==='discord')!;
 expect(replacementApproval.id).not.toBe(discordApproval.id);expect(replacementApproval.source_destination_id).toBe(replacement);
 expect(await approvalRows()).toHaveLength(beforeSourceRows);expect(await approvalAudits()).toHaveLength(beforeSourceAudits+1);
 expect((await bindingState()).binding).toMatchObject({live:false,notPosting:{code:'approved_again'}});
 await dispatchWebhooks(current);await edit(f.call);await dispatchWebhooks(current);expect(discordPosts(),'replacement approval does not replay held work').toHaveLength(1);
 saved=await json(await member(door,'PUT',{provider:'discord',channelId:webhook,events:['initiative.updated'],expectedVersion:saved.version}));
 await dispatchWebhooks(current);expect(discordPosts()).toHaveLength(1);
 await edit(f.call);await dispatchWebhooks(current);await dispatchWebhooks(current);expect(discordPosts(),'explicit save posts subsequent work once').toHaveLength(2);
 await json(await f.call('/settings/integrations/channels/'+replacement,'DELETE'));
 expect(await destinationRow(replacement)).toMatchObject({enabled:0,revoked_at:expect.any(String)});
 expect((await approvalRows()).find(row=>row.id===replacementApproval.id)).toEqual(replacementApproval);
 await sourceChanged(replacementApproval.id,false);
 await edit(f.call);await dispatchWebhooks(current);expect(discordPosts()).toHaveLength(2);
 saved=await json(await member(door,'PUT',{provider:'slack',channelId:'CSCOPED',events:['initiative.updated'],expectedVersion:saved.version}));
 // A disabled or absent installation is disconnected even when its identity was the approved workspace.
 const slackApproval=(await approvalRows()).find(row=>row.initiative_id===root.id&&row.channel_id==='CSCOPED')!;
 for(const present of [true,false]){
  if(present)await env.DB.prepare('UPDATE vector_slack_installations SET enabled=0 WHERE workspace_id=?').bind(workspace).run();
  else await env.DB.prepare('DELETE FROM vector_slack_installations WHERE workspace_id=?').bind(workspace).run();
  expect(await env.DB.prepare('SELECT enabled FROM vector_slack_installations WHERE workspace_id=?').bind(workspace).first()).toEqual(present?{enabled:0}:null);
  expect(await destinationRow(saved.id)).toMatchObject({enabled:1,revoked_at:null});
  expect((await approvalRows()).find(row=>row.id===slackApproval.id)).toEqual(slackApproval);
  const disconnected=await bindingState(),settings=await json(await f.call('/settings/integrations/channels'));
  expect(disconnected).toMatchObject({destinations:[],binding:{id:saved.id,live:false,notPosting:{code:'slack_disconnected'}}});
  expect(settings.slack).toMatchObject({connected:false,needsAttention:false});
  for(const row of settings.approvals.filter((a:any)=>a.provider==='slack'))expect(row).toMatchObject({usable:false,notPosting:{code:'slack_disconnected'}});
  expect(settings.bindings.find((b:any)=>b.id===saved.id)).toMatchObject({scoped:true,needsAttention:false,notPosting:{code:'slack_disconnected'}});
  const rows=await custody(),calls=edge.calls.length;
  expect((await member(door,'PUT',{provider:'slack',channelId:'CSCOPED',events:['initiative.updated'],expectedVersion:saved.version})).status).toBe(403);
  expect(await custody()).toEqual(rows);expect(edge.calls).toHaveLength(calls);
 }
 await json(await f.call('/settings/integrations/slack','POST',{botToken:edge.token}));
 expect((await bindingState()).binding).toMatchObject({id:saved.id,live:true,notPosting:null});
 // Workspace identity is part of approval: reconnecting to B cannot carry A's approval across.
 await edit(f.call);
 expect(await env.DB.prepare('SELECT count(*) n FROM vector_webhook_events WHERE destination_id=? AND enqueued_at IS NULL').bind(saved.id).first<number>('n'),'workspace A has a pending event').toBe(1);
 edge.workspace('TSYNTHETICB','Harbor Slack');edge.safety({name:'checkout-updates'});await json(await f.call('/settings/integrations/slack','POST',{botToken:edge.token}));
 const beforeWorkspaceSave=await custody(),beforeWorkspaceCalls=edge.calls.length;
 expect((await member(door,'PUT',{provider:'slack',channelId:'CSCOPED',events:['initiative.updated'],expectedVersion:saved.version})).status,'workspace B refuses workspace A approval').toBe(403);
 expect(await custody(),'refused workspace change preserves custody').toEqual(beforeWorkspaceSave);expect(edge.calls).toHaveLength(beforeWorkspaceCalls);
 expect((await bindingState()).binding).toMatchObject({live:false,notPosting:{code:'workspace_changed',currentWorkspace:'Harbor Slack'}});
 expect((await json(await f.call('/settings/integrations/channels'))).bindings.find((b:any)=>b.id===saved.id)).toMatchObject({needsAttention:false,notPosting:{code:'workspace_changed'}});
 expect((await json(await f.call('/settings/integrations/channels'))).approvals.find((a:any)=>a.id===slackApproval.id)).toMatchObject({usable:false,notPosting:{code:'workspace_changed'}});
 expect((await bindingState()).destinations.some((d:any)=>d.provider==='slack'),'workspace A approval is no longer offered').toBe(false);
 await dispatchWebhooks(current);await edit(f.call);await dispatchWebhooks(current);
 expect(slackPosts(),'changed workspace stops pending and future posts').toHaveLength(2);
 const oldApproval=(await json(await f.call('/settings/integrations/channels'))).approvals.find((a:any)=>a.initiativeId===root.id&&a.channelId==='CSCOPED');
 const staleRow=await env.DB.prepare('SELECT * FROM vector_initiative_destination_approvals WHERE id=?').bind(oldApproval.id).first();
 const staleCount=(await approvalRows()).length,staleAudits=(await approvalAudits()).length;
 expect(await approve({provider:'slack',initiativeId:root.id,channelId:'CSCOPED'})).toMatchObject({changed:true});
 const freshRow=await env.DB.prepare('SELECT * FROM vector_initiative_destination_approvals WHERE initiative_id=? AND provider=? AND channel_id=?').bind(root.id,'slack','CSCOPED').first();
 expect(freshRow?.id,'stale approval is replaced').not.toBe(staleRow?.id);
 expect(freshRow).toMatchObject({provider_workspace:'TSYNTHETICB',channel_name:'checkout-updates'});
 expect(await approvalRows()).toHaveLength(staleCount);expect(await approvalAudits()).toHaveLength(staleAudits+1);
 expect((await bindingState()).destinations).toContainEqual({provider:'slack',channelId:'CSCOPED',channelName:'checkout-updates'});
 expect((await bindingState()).binding).toMatchObject({live:false,notPosting:{code:'approved_again'}});
 await dispatchWebhooks(current);await edit(f.call);await dispatchWebhooks(current);
 expect(slackPosts(),'fresh workspace B approval alone never replays or revives held events').toHaveLength(2);
 state=await bindingState();saved=await json(await member(door,'PUT',{provider:'slack',channelId:'CSCOPED',events:['initiative.updated'],expectedVersion:state.version}));
 await dispatchWebhooks(current);expect(slackPosts(),'explicit binding still does not replay held events').toHaveLength(2);
 await edit(f.call);await dispatchWebhooks(current);await dispatchWebhooks(current);
 expect(slackPosts(),'explicit workspace B binding posts subsequent work once').toHaveLength(3);expect(slackPosts()[2].workspace).toBe('TSYNTHETICB');
 await json(await f.call('/settings/operators/'+memberId,'DELETE'));await edit(f.call);await dispatchWebhooks(current);expect(slackPosts(),'removed binder posts nothing').toHaveLength(3);
}
