import type {WorkerBindings} from '../../../app/bindings';
import type {DeliveryProtocol,DeliveryService,WireRequest,WireResponse} from '../../../../../vendor/base/integrations';
import {sha256} from '../../../../../vendor/base/integrations/core/crypto';
import {restoredEffectsHeld} from '../../data/restore-authority';
import {visibilityDatabase} from '../../roles/visibility-database';
import {IntegrationError} from '../errors';
import {slackToken,providerSend,classifyProvider} from '../channels/provider';
import {requireSlackChannel} from '../channels/channel-safety';
export const threadDestination='slack-thread';
type Target={rootId:string;issueId:string;identifier:string;isPrivate:number;channel:string;threadTs:string;kind:'reply'|'status'|'resolved';commentId:string|null;actor:string|null;statusId:string|null;body:string|null;status:string|null};
/** Opaque references are queued. Content and authority are projected afresh at
 * final transport, so erased or newly private content cannot survive in an envelope. */
export async function threadTarget(env:WorkerBindings,workspace:string,id:string):Promise<Target|null>{
 if(await restoredEffectsHeld(env.DB))return null;
 const row=await env.DB.prepare(`SELECT m.root_comment_id AS rootId,m.issue_id AS issueId,i.identifier,t.is_private AS isPrivate,
 m.channel_id AS channel,m.thread_ts AS threadTs,json_extract(e.body,'$.kind') AS kind,
 json_extract(e.body,'$.commentId') AS commentId,json_extract(e.body,'$.actorId') AS actor,json_extract(e.body,'$.statusId') AS statusId,
 m.operator_id AS mapper,
 (SELECT c.body FROM issue_comments c WHERE c.id=json_extract(e.body,'$.commentId') AND c.issue_id=i.id AND c.parent_comment_id=m.root_comment_id AND c.deleted_at IS NULL) AS body,
 (SELECT name FROM workflow_statuses status WHERE status.id=json_extract(e.body,'$.statusId') AND status.team_id=i.team_id) AS status
 FROM vector_webhook_events e JOIN vector_slack_threads m ON m.root_comment_id=json_extract(e.body,'$.rootId') AND m.issue_id=json_extract(e.body,'$.issueId') AND m.workspace_id=e.workspace_id
 JOIN issues i ON i.id=m.issue_id AND i.archived_at IS NULL JOIN teams t ON t.id=i.team_id AND t.workspace_id=m.workspace_id AND t.archived_at IS NULL
 JOIN vector_slack_installations s ON s.workspace_id=m.workspace_id AND s.enabled=1 AND s.updated_at=m.installation_at AND s.slack_team_id=m.slack_team_id
 JOIN vector_slack_member_links l ON l.operator_id=m.operator_id AND l.workspace_id=m.workspace_id AND l.slack_team_id=m.slack_team_id AND l.slack_user_id=m.slack_user_id AND l.linked_at=m.linked_at
 JOIN operators o ON o.id=l.operator_id AND o.workspace_id=m.workspace_id AND o.removed_at IS NULL AND o.role IN ('owner','admin','member','guest')
 JOIN vector_auth_operators auth ON auth.operator_id=o.id JOIN oa_operators a ON a.id=auth.auth_id AND a.status='active'
 JOIN vector_channel_bindings b ON b.destination_id=m.destination_id AND b.workspace_id=m.workspace_id AND b.scope='team' AND b.object_id=i.team_id AND b.channel_id=m.channel_id AND b.suspended_reason IS NULL
 JOIN vector_webhook_destinations d ON d.id=b.destination_id AND d.workspace_id=m.workspace_id AND d.kind='slack' AND d.enabled=1 AND d.revoked_at IS NULL
 JOIN operators binder ON binder.id=b.created_by AND binder.removed_at IS NULL AND binder.role IN ('owner','admin')
 WHERE e.id=? AND e.workspace_id=? AND e.event='slack.thread'
 AND NOT EXISTS(SELECT 1 FROM vector_slack_thread_holds h WHERE h.root_comment_id=m.root_comment_id)
 AND NOT EXISTS(SELECT 1 FROM vector_webhook_restore_holds h WHERE h.namespace=e.workspace_id AND h.id=e.id)
 AND NOT EXISTS(SELECT 1 FROM vector_webhook_erasures h WHERE h.namespace=e.workspace_id AND h.id=e.id)`).bind(id,workspace).first<Target&{mapper:string}>();
 if(!row||row.isPrivate&&row.kind!=='status'||row.kind==='reply'&&!row.body||row.kind==='status'&&!row.status)return null;
 // Both the person who established this mapping and the current native author
 // must still have access. Revocation cannot turn an old intent into new authority.
 for(const actor of new Set([row.mapper,...(row.actor?[row.actor]:[])])){
  const current=await visibilityDatabase(env.DB,actor).prepare(`SELECT 1 FROM issues i JOIN operators o ON o.id=? AND o.removed_at IS NULL AND o.role IN ('owner','admin','member','guest') JOIN vector_auth_operators m ON m.operator_id=o.id JOIN oa_operators a ON a.id=m.auth_id AND a.status='active' WHERE i.id=?`).bind(actor,row.issueId).first();
  if(!current)return null;
 }
 return row;
}
export async function enqueueThreadMessages(env:WorkerBindings,workspace:string,service:DeliveryService){
 const rows=(await env.DB.prepare(`SELECT id,body FROM vector_webhook_events e WHERE workspace_id=? AND event='slack.thread' AND enqueued_at IS NULL
 AND NOT EXISTS(SELECT 1 FROM vector_webhook_restore_holds h WHERE h.namespace=e.workspace_id AND h.id=e.id)
 AND NOT EXISTS(SELECT 1 FROM vector_webhook_erasures h WHERE h.namespace=e.workspace_id AND h.id=e.id) ORDER BY created_at,id LIMIT 20`).bind(workspace).all<{id:string;body:string}>()).results;
 let count=0;
 for(const row of rows){
  if(await threadTarget(env,workspace,row.id)){
   await service.enqueue({id:row.id,tenant:workspace,destinationId:threadDestination,event:'slack.thread',protocol:'slack_thread',body:row.body},{maxAttempts:3,retryDelaysMs:[60_000,300_000]});count++;
  }
  await env.DB.prepare('UPDATE vector_webhook_events SET enqueued_at=COALESCE(enqueued_at,?) WHERE id=? AND workspace_id=?').bind(new Date().toISOString(),row.id,workspace).run();
 }
 return count;
}
export function threadProtocol(env:WorkerBindings,workspace:string):DeliveryProtocol{
 return {id:'slack_thread',async prepare(envelope){
  if(!await threadTarget(env,workspace,envelope.id))throw new IntegrationError(403,'slack_thread_unavailable');
  return {url:'https://slack.com/api/chat.postMessage',body:envelope.body,headers:{'Content-Type':'application/json; charset=utf-8',Authorization:'Bearer '+await slackToken(env,workspace),'vector-thread-event':envelope.id}};
 },classify(response){return response.headers['vector-thread-refused']?{kind:'rejected',code:'slack_thread_suppressed'}:classifyProvider('slack',response);}};
}
const refused=():WireResponse=>({status:403,headers:{'vector-thread-refused':'1'},body:''});
const escape=(text:string)=>text.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
export async function sendThread(env:WorkerBindings,workspace:string,wire:WireRequest):Promise<WireResponse>{
 const id=wire.headers['vector-thread-event'],target=await threadTarget(env,workspace,id);
 if(!target)return refused();
 try{await requireSlackChannel(env,workspace,target.channel);}catch(error){if(error instanceof IntegrationError)return refused();throw error;}
 const hash=await sha256(id);
 // Channel inspection yields to the provider. Repeat all local admission and
 // credential checks afterwards, immediately before the post.
 const current=await threadTarget(env,workspace,id);
 if(!current)return refused();
 const token=await slackToken(env,workspace);
 const text=current.kind==='status'?current.identifier+' · Status: '+current.status:current.kind==='resolved'?current.identifier+' · Thread resolved':current.body!;
 const body=JSON.stringify({channel:current.channel,thread_ts:current.threadTs,text:escape(text),client_msg_id:hash.slice(0,8)+'-'+hash.slice(8,12)+'-4'+hash.slice(13,16)+'-a'+hash.slice(17,20)+'-'+hash.slice(20,32),unfurl_links:false,unfurl_media:false,parse:'none',mrkdwn:false});
 const send=()=>providerSend({url:wire.url,headers:{'Content-Type':'application/json; charset=utf-8',Authorization:'Bearer '+token},body});
 if(env.RER_DEMO==='1'){const {demoEffect}=await import('../../../../../vendor/base/demo/index.mjs');return demoEffect(send,()=>({status:200,headers:{},body:'{"ok":true}'}));}
 return send();
}
