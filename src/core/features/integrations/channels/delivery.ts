import {channelBindingSource} from './subjects';
import {checkBoundChannel,suspendChannel,suspendedSlackResponses} from './channel-safety';
import type {WorkerBindings} from '../../../app/bindings';
import type {DeliveryProtocol,Envelope,WireRequest} from '../../../../../vendor/base/integrations';
import {IntegrationError} from '../errors';
import {openSecret} from '../secrets';
import {slackToken,discordUrl,classifyProvider,providerSend} from './provider';
import {issueListQuerySchema} from '../../issues/list-schema';
import {browseWhere} from '../../issues/browse-sql';
import {workspaceDate} from '../../issues/browse-access';
import {restoredEffectsHeld} from '../../data/restore-authority';
type Channel={id:string;kind:'slack'|'discord';scope:string;object_id:string;created_by:string;channel_id:string;channel_name:string};
async function currentChannel(env:WorkerBindings,workspace:string,id:string){
 const row=await env.DB.prepare(`SELECT d.id,d.kind,b.scope,b.object_id,b.created_by,b.channel_id,b.channel_name FROM vector_webhook_destinations d JOIN ${channelBindingSource} b ON b.destination_id=d.id JOIN operators o ON o.id=b.created_by AND o.removed_at IS NULL JOIN vector_auth_operators m ON m.operator_id=o.id JOIN oa_operators a ON a.id=m.auth_id AND a.status='active' WHERE d.id=? AND d.workspace_id=? AND d.enabled=1 AND d.revoked_at IS NULL`).bind(id,workspace).first<Channel>();
 if(!row||await restoredEffectsHeld(env.DB))throw new IntegrationError(409,'channel_disabled');
 return row;
}
/** Saved views use the same browse predicates as the member's list, at dispatch. */
export async function channelMatches(env:WorkerBindings,workspace:string,id:string,body:string){
 const channel=await currentChannel(env,workspace,id),event=JSON.parse(body);
 if(channel.scope==='initiative'){
  if(!event.initiativeId||event.initiativeId!==channel.object_id||!event.actorId)return false;
  return Boolean(await env.DB.prepare("SELECT 1 FROM initiatives n JOIN operators o ON o.workspace_id=n.workspace_id JOIN vector_auth_operators m ON m.operator_id=o.id JOIN oa_operators a ON a.id=m.auth_id AND a.status='active' WHERE n.id=? AND n.workspace_id=? AND o.id=? AND o.removed_at IS NULL AND o.role IN('owner','admin','member')").bind(event.initiativeId,workspace,event.actorId).first());
 }
 if(event.initiativeId)return false;
 if(event.actorId&&!await env.DB.prepare('SELECT 1 FROM operators WHERE id=? AND workspace_id=? AND removed_at IS NULL').bind(event.actorId,workspace).first())return false;
 const issue=await env.DB.prepare('SELECT i.id,i.team_id,i.project_id,t.is_private FROM issues i JOIN teams t ON t.id=i.team_id WHERE i.identifier=? AND t.workspace_id=?').bind(event.identifier,workspace).first<{id:string;team_id:string;project_id:string|null;is_private:number}>();
 if(!issue)return false;
 if(issue.is_private && (channel.scope!=='team'||channel.object_id!==issue.team_id||!await env.DB.prepare("SELECT 1 FROM operators WHERE id=? AND removed_at IS NULL AND role IN('owner','admin')").bind(channel.created_by).first()))return false;
 if(channel.scope==='team')return issue.team_id===channel.object_id;
 if(channel.scope==='project')return issue.project_id===channel.object_id&&Boolean(await env.DB.prepare('SELECT 1 FROM projects WHERE id=? AND workspace_id=?').bind(channel.object_id,workspace).first());
 const view=await env.DB.prepare('SELECT filters_json,sort,grouping FROM saved_views WHERE id=? AND workspace_id=? AND (owner_operator_id=? OR is_shared=1)').bind(channel.object_id,workspace,channel.created_by).first<{filters_json:string;sort:string;grouping:string}>();
 if(!view)return false;
 const timezone=await env.DB.prepare('SELECT timezone FROM workspace_settings WHERE id=?').bind(workspace).first<string>('timezone');
 const query=issueListQuerySchema.parse({...JSON.parse(view.filters_json),sort:view.sort,grouping:view.grouping});
 const {relation,values}=browseWhere(query,workspace,workspaceDate(new Date(),timezone!),channel.created_by);
 return Boolean(await env.DB.prepare('SELECT 1 '+relation+' AND i.id=?').bind(...values,issue.id).first());
}
const escapeSlack=(text:string)=>text.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
export async function channelMessage(env:WorkerBindings,kind:string,channelId:string,body:string){
 const event=JSON.parse(body);
 if(event.initiativeId){
  const privateWork=await env.DB.prepare('SELECT 1 FROM initiative_projects ip JOIN issues i ON i.project_id=ip.project_id JOIN teams t ON t.id=i.team_id WHERE ip.initiative_id=? AND t.is_private=1').bind(event.initiativeId).first();
  const change=event.changeKind==='projects'&&privateWork?'Private work changed. Sign in to Vector to view it.':event.change;
  const text=`${event.initiativeName}\n${event.actor}: ${change}\n${env.APP_ORIGIN}/app/initiatives/${encodeURIComponent(event.initiativeId)}`;
  return JSON.stringify(kind==='slack'?{channel:channelId,text:escapeSlack(text),unfurl_links:false,unfurl_media:false,parse:'none',mrkdwn:false}:{content:text,allowed_mentions:{parse:[]},flags:4});
 }
 const link=env.APP_ORIGIN+'/app/issues/'+encodeURIComponent(event.identifier);
 const privateItem=await env.DB.prepare('SELECT 1 FROM issues i JOIN teams t ON t.id=i.team_id WHERE i.identifier=? AND t.is_private=1').bind(event.identifier).first();
 const text=privateItem?'Private work changed. Sign in to Vector to view it.':`${event.identifier} · ${event.title}\n${event.actor}: ${event.change}\n${link}`;
 return JSON.stringify(kind==='slack'?{channel:channelId,text:escapeSlack(text),unfurl_links:false,unfurl_media:false,parse:'none',mrkdwn:false}:{content:text,allowed_mentions:{parse:[]},flags:4});
}
export function channelProtocols(env:WorkerBindings,workspace:string):DeliveryProtocol[]{
 return (['slack','discord'] as const).map(kind=>({id:kind,async prepare(envelope:Envelope):Promise<WireRequest>{
  const current=await currentChannel(env,workspace,envelope.destinationId);
  if(current.kind!==kind)throw new IntegrationError(409,'channel_changed');
  const event=await env.DB.prepare('SELECT body FROM vector_webhook_events WHERE id=? AND workspace_id=?').bind(envelope.id,workspace).first<string>('body');
  if(!event||!await channelMatches(env,workspace,envelope.destinationId,event))throw new IntegrationError(409,'channel_event_disabled');
  const body=envelope.body; // Base keeps its immutable envelope; transport projects current privacy.
  if(kind==='slack'){return {url:'https://slack.com/api/chat.postMessage',body,headers:{'Content-Type':'application/json; charset=utf-8',Authorization:'Bearer '+await slackToken(env,workspace),'vector-channel-destination':envelope.destinationId,'vector-channel-event':envelope.id}};}
  const encrypted=await env.DB.prepare("SELECT encrypted FROM vector_integration_secret_keys WHERE identity=? AND slot='current'").bind('destination:'+envelope.destinationId).first<string>('encrypted');
  if(!encrypted)throw new IntegrationError(409,'discord_needs_attention');
  return {url:discordUrl(await openSecret(env,'destination:'+envelope.destinationId,encrypted))+'?wait=true',body,headers:{'Content-Type':'application/json','vector-channel-destination':envelope.destinationId,'vector-channel-event':envelope.id}};
 },classify(response){return classifyProvider(kind,response);}}));
}
export async function sendChannel(env:WorkerBindings,workspace:string,wire:WireRequest){
 // Repeat all admission checks immediately before the network call.
 const id=wire.headers['vector-channel-event'],destination=wire.headers['vector-channel-destination'];
 if(await env.DB.prepare('SELECT 1 FROM vector_webhook_restore_holds WHERE namespace=? AND id=? UNION ALL SELECT 1 FROM vector_webhook_erasures WHERE namespace=? AND id=?').bind(workspace,id,workspace,id).first())throw new IntegrationError(409,'channel_event_held');
 const current=await currentChannel(env,workspace,destination),protocol=channelProtocols(env,workspace).find(p=>p.id===current.kind)!;
 const fresh=await protocol.prepare({id,tenant:workspace,destinationId:destination,event:'channel.send',protocol:current.kind,body:wire.body},Date.now());
 if(fresh.url!==wire.url)throw new IntegrationError(409,'channel_changed');
 if(current.kind==='slack'){try{await checkBoundChannel(env,workspace,destination,current.channel_id);}catch(error){if(error instanceof IntegrationError)return {status:403,headers:{'vector-channel-refusal':'channel_safety_refused'},body:''};throw error;}}
 await currentChannel(env,workspace,destination);
 const event=await env.DB.prepare('SELECT body FROM vector_webhook_events WHERE workspace_id=? AND id=?').bind(workspace,id).first<string>('body');if(!event||!await channelMatches(env,workspace,destination,event))throw new IntegrationError(409,'channel_event_disabled');
 fresh.body=await channelMessage(env,current.kind,current.channel_id,event);
 const headers={...fresh.headers};delete headers['vector-channel-event'];delete headers['vector-channel-destination'];
 if(env.RER_DEMO==='1'){const {demoEffect}=await import('../../../../../vendor/base/demo/index.mjs');return demoEffect(()=>providerSend({...fresh,headers}),()=>({status:200,headers:{},body:current.kind==='slack'?'{"ok":true}':''}));}
 const response=await providerSend({...fresh,headers});
 if(current.kind==='slack'){try{const result=JSON.parse(response.body);if(result.ok===false&&suspendedSlackResponses.has(result.error))await suspendChannel(env,workspace,destination,'slack_'+result.error);}catch(error){if(!(error instanceof SyntaxError))throw error;}}
 return response;
}
