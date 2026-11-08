import type {WorkerBindings} from '../../../app/bindings';
import type {DeliveryProtocol,DeliveryService,WireRequest,WireResponse} from '../../../../../vendor/base/integrations';
import {visibilityDatabase} from '../../roles/visibility-database';
import {restoredEffectsHeld} from '../../data/restore-authority';
import {credentialProblem} from '../channels/settings';
import {requireSlackChannel} from '../channels/channel-safety';
import {slackToken,providerSend,classifyProvider} from '../channels/provider';
import {IntegrationError} from '../errors';

const destination='slack-thread';
type Target={id:string;workspace_id:string;issue_id:string;root_comment_id:string;channel_id:string;thread_ts:string;identifier:string;is_private:number;operator_id:string;actor_id:string|null;kind:string;source_id:string;status_name:string|null;permalink:string};
/** Current authority, original installation and original member consent are all
 * required. Reconnecting credentials never activates a historical mapping. */
export async function threadTarget(env:WorkerBindings,workspace:string,id:string){
 if(await restoredEffectsHeld(env.DB))return null;
 const row=await env.DB.prepare(`SELECT e.id,m.workspace_id,m.issue_id,m.root_comment_id,m.channel_id,m.thread_ts,i.identifier,t.is_private,m.operator_id,e.actor_id,e.kind,e.source_id,e.status_name,m.permalink
 FROM vector_slack_thread_events e JOIN vector_slack_threads m ON m.id=e.thread_id AND m.held=0
 JOIN issues i ON i.id=m.issue_id AND i.archived_at IS NULL JOIN teams t ON t.id=i.team_id AND t.workspace_id=m.workspace_id AND t.archived_at IS NULL
 JOIN vector_slack_installations s ON s.workspace_id=m.workspace_id AND s.slack_team_id=m.slack_team_id AND s.enabled=1 AND s.updated_at=m.installation_at
 JOIN vector_slack_member_links l ON l.workspace_id=m.workspace_id AND l.slack_team_id=m.slack_team_id AND l.operator_id=m.operator_id AND l.linked_at=m.linked_at
 JOIN main.operators o ON o.id=l.operator_id AND o.workspace_id=l.workspace_id AND o.removed_at IS NULL AND o.role IN('owner','admin','member')
 JOIN vector_auth_operators a ON a.operator_id=o.id JOIN oa_operators native ON native.id=a.auth_id AND native.status='active'
 JOIN vector_channel_bindings b ON b.destination_id=m.destination_id AND b.workspace_id=m.workspace_id AND b.channel_id=m.channel_id AND b.scope='team' AND b.object_id=i.team_id AND b.suspended_reason IS NULL
 JOIN main.operators binder ON binder.id=b.created_by AND binder.removed_at IS NULL
 JOIN vector_auth_operators binder_map ON binder_map.operator_id=binder.id JOIN oa_operators binder_native ON binder_native.id=binder_map.auth_id AND binder_native.status='active'
 JOIN vector_webhook_destinations d ON d.id=b.destination_id AND d.kind='slack' AND d.enabled=1 AND d.revoked_at IS NULL
 WHERE e.id=? AND m.workspace_id=? AND e.held=0
 AND (e.kind<>'reply' OR EXISTS(SELECT 1 FROM issue_comments c WHERE c.id=e.source_id AND c.issue_id=m.issue_id AND c.parent_comment_id=m.root_comment_id AND c.deleted_at IS NULL AND c.body IS NOT NULL))
 AND NOT EXISTS(SELECT 1 FROM vector_http_restore)
 AND NOT EXISTS(SELECT 1 FROM vector_webhook_restore_holds h WHERE h.namespace=m.workspace_id AND h.id=e.id)
 AND NOT EXISTS(SELECT 1 FROM vector_webhook_erasures h WHERE h.namespace=m.workspace_id AND h.id=e.id)`).bind(id,workspace).first<Target>();
 if(!row||await credentialProblem(env,'slack:'+workspace)||await credentialProblem(env,'slack-signing:'+workspace))return null;
 // The mapping still requires its original linked member. A reply actor may
 // also be a Guest whose current team membership admits this issue.
 const canSee=async(actor:string)=>Boolean(await visibilityDatabase(env.DB,actor).prepare("SELECT 1 FROM issues i JOIN operators o ON o.id=? JOIN vector_auth_operators a ON a.operator_id=o.id JOIN oa_operators n ON n.id=a.auth_id AND n.status='active' WHERE i.id=? AND o.removed_at IS NULL AND o.role IN('owner','admin','member','guest')").bind(actor,row.issue_id).first());
 if(!await canSee(row.operator_id)||row.actor_id&&!await canSee(row.actor_id))return null;
 if(row.is_private&&row.kind!=='status')return null;
 return row;
}
const escape=(text:string)=>text.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
async function threadBody(env:WorkerBindings,target:Target){
 let text:string;
 if(target.kind==='status')text=target.identifier+' · '+target.status_name;
 else if(target.kind==='resolved')text=target.identifier+' · Thread resolved';
 else{
  const comment=await env.DB.prepare('SELECT c.body,o.name FROM issue_comments c JOIN operators o ON o.id=c.actor_operator_id WHERE c.id=? AND c.issue_id=? AND c.parent_comment_id=? AND c.deleted_at IS NULL AND o.removed_at IS NULL').bind(target.source_id,target.issue_id,target.root_comment_id).first<{body:string;name:string}>();
  if(!comment)return null;
  text=comment.name+': '+comment.body;
 }
 // Slack's documented text limit is 40,000; refuse rather than truncate a reply.
 if(escape(text).length>39_000)return null;
 return JSON.stringify({channel:target.channel_id,thread_ts:target.thread_ts,text:escape(text),unfurl_links:false,unfurl_media:false,parse:'none',mrkdwn:false});
}
export async function enqueueThreadMessages(env:WorkerBindings,workspace:string,service:DeliveryService){
 const rows=(await env.DB.prepare('SELECT e.id FROM vector_slack_thread_events e JOIN vector_slack_threads m ON m.id=e.thread_id WHERE m.workspace_id=? AND m.held=0 AND e.held=0 AND e.enqueued_at IS NULL ORDER BY e.created_at,e.id LIMIT 20').bind(workspace).all<{id:string}>()).results;
 const queued:string[]=[];
 for(const {id} of rows){
  const target=await threadTarget(env,workspace,id);
  if(target){
   // The durable envelope contains an opaque intent, never captured private text.
   await service.enqueue({id,tenant:workspace,destinationId:destination,event:'slack.thread',protocol:'slack_thread',body:'{}'},{maxAttempts:3,retryDelaysMs:[60_000,300_000]});queued.push(id);
  }
  await env.DB.prepare('UPDATE vector_slack_thread_events SET enqueued_at=COALESCE(enqueued_at,?) WHERE id=?').bind(new Date().toISOString(),id).run();
 }
 return queued;
}
export function threadProtocol(env:WorkerBindings,workspace:string):DeliveryProtocol{
 return {id:'slack_thread',async prepare(envelope){
  if(!await threadTarget(env,workspace,envelope.id))throw new IntegrationError(403,'slack_thread_unavailable');
  return {url:'https://slack.com/api/chat.postMessage',body:'{}',headers:{'Content-Type':'application/json; charset=utf-8','vector-thread-event':envelope.id}};
 },classify(response){return classifyProvider('slack',response);}};
}
const refused=():WireResponse=>({status:403,headers:{'vector-channel-refusal':'channel_safety_refused'},body:''});
/** Every provider post re-resolves access after the channel safety request.
 * Rate limits may retry; unknown post outcomes remain uncertain and inert. */
export async function sendThread(env:WorkerBindings,workspace:string,wire:WireRequest):Promise<WireResponse>{
 const id=wire.headers['vector-thread-event'],before=await threadTarget(env,workspace,id);
 if(!before)return refused();
 try{await requireSlackChannel(env,workspace,before.channel_id);}catch(error){if(error instanceof IntegrationError)return refused();throw error;}
 const current=await threadTarget(env,workspace,id);
 if(!current)return refused();
 const body=await threadBody(env,current);
 if(!body)return refused();
 const token=await slackToken(env,workspace);
 // Check again after token decryption and body projection, before any content leaves.
 if(!await threadTarget(env,workspace,id))return refused();
 const send=()=>providerSend({url:'https://slack.com/api/chat.postMessage',body,headers:{'Content-Type':'application/json; charset=utf-8',Authorization:'Bearer '+token}});
 if(env.RER_DEMO==='1'){const {demoEffect}=await import('../../../../../vendor/base/demo/index.mjs');return demoEffect(send,()=>({status:200,headers:{},body:'{"ok":true}'}));}
 return send();
}
