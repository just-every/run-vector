import type {WorkerBindings} from '../../../app/bindings';
import type {DeliveryProtocol,DeliveryService,Outcome,WireRequest,WireResponse} from '../../../../../vendor/base/integrations';
import {activeRecipient} from '../../notifications/events';
import {IntegrationError} from '../errors';
import {classifyProvider,providerSend,slackToken} from '../channels/provider';
import {credentialProblem} from '../channels/settings';
import {directBody,kindHeadline,type DirectIssue} from './message';
import {signingIdentity} from './signing';
import {directDestination} from './intent';
import seed from '../../../../../seed.json';
/** Mirrors immediate mail: three attempts, Cron retries after one and then five minutes. */
const retryPolicy={maxAttempts:3,retryDelaysMs:[60_000,300_000]};
type Target={identifier:string;title:string;version:number;dueDate:string|null;statusId:string;statusCategory:string;teamId:string;actor:string|null;slackUserId:string;assignment:number;mention:number};
const routed=(kind:string)=>`EXISTS(SELECT 1 FROM json_each(n.causes_json) cause WHERE cause.value='${kind}' AND cause.value IN(SELECT value FROM json_each(l.dm_kinds))
 AND NOT EXISTS(SELECT 1 FROM notification_type_mutes mute WHERE mute.operator_id=o.id AND mute.kind=cause.value))`;
/** NOTIFY-006's admission rules, with the member's Slack link and choice in place of the email preference. */
export async function directTarget(env:WorkerBindings,workspace:string,id:string):Promise<Target|null>{
 const row=await env.DB.prepare(`SELECT i.identifier,i.title,i.version,i.due_date AS dueDate,i.status_id AS statusId,st.category AS statusCategory,i.team_id AS teamId,n.actor_name AS actor,l.slack_user_id AS slackUserId,
  ${routed('assignment')} AS assignment,${routed('mention')} AS mention
  FROM vector_webhook_events e JOIN notifications n ON n.id=json_extract(e.body,'$.notificationId') AND n.recipient_id=json_extract(e.body,'$.recipientId')
  JOIN issues i ON i.id=n.issue_id JOIN workflow_statuses st ON st.id=i.status_id JOIN teams t ON t.id=i.team_id AND t.workspace_id=e.workspace_id
  JOIN operators o ON o.id=n.recipient_id AND o.workspace_id=t.workspace_id
  JOIN vector_slack_member_links l ON l.operator_id=o.id AND l.workspace_id=t.workspace_id
  JOIN vector_slack_installations s ON s.workspace_id=t.workspace_id AND s.enabled=1
  WHERE e.id=? AND e.workspace_id=? AND e.event='slack.dm' AND ${activeRecipient} AND (n.actor_id IS NULL OR n.actor_id<>o.id)
  AND (json_extract(e.body,'$.actorId') IS NULL OR EXISTS(SELECT 1 FROM operators actor WHERE actor.id=json_extract(e.body,'$.actorId') AND actor.removed_at IS NULL))
  AND NOT EXISTS(SELECT 1 FROM vector_restore_status WHERE effects_held=1)
  AND NOT EXISTS(SELECT 1 FROM vector_webhook_restore_holds h WHERE h.namespace=e.workspace_id AND h.id=e.id)
  AND NOT EXISTS(SELECT 1 FROM vector_webhook_erasures h WHERE h.namespace=e.workspace_id AND h.id=e.id)
  AND NOT EXISTS(SELECT 1 FROM issue_notification_mutes m WHERE m.issue_id=i.id AND m.operator_id=o.id)`).bind(id,workspace).first<Target>();
 return row&&(row.assignment||row.mention)?row:null;
}
/** The statuses the issue-edit door accepts as a next status, in workflow order. */
export async function directIssue(env:WorkerBindings,issue:Omit<DirectIssue,'statuses'>&{teamId:string}):Promise<DirectIssue>{
 const statuses=(await env.DB.prepare("SELECT id,name FROM workflow_statuses WHERE team_id=? AND category IN('backlog','unstarted','started','completed','canceled') ORDER BY position,id").bind(issue.teamId).all<{id:string;name:string}>()).results;
 return {identifier:issue.identifier,title:issue.title,version:issue.version,dueDate:issue.dueDate,statusId:issue.statusId,statusCategory:issue.statusCategory,statuses};
}
/** Ineligible intents are consumed without a send; eligible ones are queued with their exact body.
 * Like mail, a committed mutation's own intents are bounded by workspace capacity; Cron takes 20. */
export async function enqueueDirectMessages(env:WorkerBindings,workspace:string,service:DeliveryService,ids?:string[]){
 const pending=(await env.DB.prepare(`SELECT e.id FROM vector_webhook_events e WHERE e.workspace_id=? AND e.event='slack.dm' AND e.enqueued_at IS NULL${ids?' AND e.id IN(SELECT value FROM json_each(?))':''}
  AND NOT EXISTS(SELECT 1 FROM vector_webhook_restore_holds h WHERE h.namespace=e.workspace_id AND h.id=e.id) AND NOT EXISTS(SELECT 1 FROM vector_webhook_erasures h WHERE h.namespace=e.workspace_id AND h.id=e.id) ORDER BY e.created_at,e.id LIMIT ?`).bind(workspace,...(ids?[JSON.stringify(ids)]:[]),ids?seed.limits.operators:20).all<{id:string}>()).results;
 const actions=!await credentialProblem(env,signingIdentity(workspace)),queued:string[]=[];
 for(const {id} of pending){
  const target=await directTarget(env,workspace,id);
  if(target){
   const body=directBody(env.APP_ORIGIN,await directIssue(env,target),kindHeadline(Boolean(target.assignment),Boolean(target.mention)),target.actor,actions);
   try{await service.enqueue({id,tenant:workspace,destinationId:directDestination,event:'slack.dm',protocol:'slack_dm',body},retryPolicy);}
   catch(error){if(error instanceof IntegrationError)continue;throw error;}
   queued.push(id);
  }
  await env.DB.prepare('UPDATE vector_webhook_events SET enqueued_at=COALESCE(enqueued_at,?) WHERE id=? AND workspace_id=?').bind(new Date().toISOString(),id,workspace).run();
 }
 return queued;
}
export function directProtocol(env:WorkerBindings,workspace:string):DeliveryProtocol{
 return {id:'slack_dm',async prepare(envelope){
  return {url:'https://slack.com/api/chat.postMessage',body:envelope.body,headers:{'Content-Type':'application/json; charset=utf-8',Authorization:'Bearer '+await slackToken(env,workspace),'vector-dm-event':envelope.id}};
 },classify:classifyDirect};
}
const refused=(reason:string):WireResponse=>({status:409,headers:{'vector-dm-refusal':reason},body:''});
/** conversations.open, then chat.postMessage. Admission is repeated before each provider call. */
export async function sendDirect(env:WorkerBindings,workspace:string,wire:WireRequest):Promise<WireResponse>{
 const id=wire.headers['vector-dm-event'],headers={...wire.headers};delete headers['vector-dm-event'];
 const send=async()=>{
  const target=wire.body==='{}'?null:await directTarget(env,workspace,id);
  if(!target)return refused('suppressed');
  let opened:WireResponse;
  try{opened=await providerSend({url:'https://slack.com/api/conversations.open',headers,body:JSON.stringify({users:target.slackUserId})});}catch{return refused('open_unknown');}
  let channel:string|null=null;
  try{const value=JSON.parse(opened.body);if(opened.status===200&&value.ok===true&&typeof value.channel?.id==='string'&&/^D[A-Z0-9]{2,30}$/.test(value.channel.id))channel=value.channel.id;}catch{return refused('open_unknown');}
  if(!channel)return {...opened,headers:{...opened.headers,'vector-dm-stage':'open'}};
  if(!await directTarget(env,workspace,id))return refused('suppressed');
  return providerSend({url:wire.url,headers,body:'{"channel":'+JSON.stringify(channel)+','+wire.body.slice(1)});
 };
 if(env.RER_DEMO==='1'){const {demoEffect}=await import('../../../../../vendor/base/demo/index.mjs');return demoEffect(send,()=>({status:200,headers:{},body:'{"ok":true}'}));}
 return send();
}
/** An unanswered or refused conversations.open posted nothing, so it may retry; chat.postMessage
 * keeps the channel rules: rate limits retry, unknown results stay uncertain and are never resent. */
export function classifyDirect(response:WireResponse):Outcome{
 const refusal=response.headers['vector-dm-refusal'],{status}=response;
 if(refusal==='suppressed')return {kind:'rejected',code:'slack_dm_suppressed'};
 if(refusal==='open_unknown')return {kind:'retryable',code:'slack_dm_open_unknown'};
 if(response.headers['vector-dm-stage']!=='open')return classifyProvider('slack',response);
 const retryAfterMs=Math.min(86400001,Math.max(0,Number(response.headers['retry-after']||60))*1000);
 if(status===429)return {kind:'retryable',code:'provider_rate_limited',status,retryAfterMs};
 if(status>=500)return {kind:'retryable',code:'slack_dm_open_unavailable',status};
 let error='rejected';try{const value=JSON.parse(response.body);if(typeof value.error==='string'&&/^[a-z_]{1,80}$/.test(value.error))error=value.error;}catch{return {kind:'retryable',code:'slack_dm_open_unknown',status};}
 return ['ratelimited','rate_limited'].includes(error)?{kind:'retryable',code:'provider_rate_limited',status,retryAfterMs}:{kind:'rejected',code:'slack_'+error,status};
}
