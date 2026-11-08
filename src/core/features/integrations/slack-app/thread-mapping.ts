import {z} from 'zod';
import type {WorkerBindings} from '../../../app/bindings';
import {createUlid} from '../../../shared/ids';
import {mutationDatabase} from '../../auth/mutation-database';
import {visibilityDatabase} from '../../roles/visibility-database';
import {actionAuthority} from '../../roles/enforcement';
import {createIssueInputSchema} from '../../issues/input';
import {createIssueRecord} from '../../issues/repository';
import {addComment} from '../../discussion/repository';
import {commentStatements,followStatements,finalizeEvent} from '../../notifications/events';
import {IntegrationError} from '../errors';

export const slackTimestamp=z.string().regex(/^[0-9]{1,12}\.[0-9]{1,8}$/);
export const threadMessage=z.object({type:z.enum(['app_mention','message']),user:z.string().min(1).max(100),channel:z.string().regex(/^[CG][A-Z0-9]{2,30}$/),text:z.string().trim().min(1).max(90_000),ts:slackTimestamp,thread_ts:slackTimestamp.optional(),source_user:z.string().max(100).optional(),bot_id:z.string().optional(),subtype:z.string().optional()});
export type ThreadMessage=z.infer<typeof threadMessage>;
type Signer={workspace:string;encrypted:string};
export type ThreadMapping={id:string;issue_id:string;root_comment_id:string;identifier:string};
const refused=()=>new IntegrationError(403,'slack_thread_unavailable');
export async function threadAdmission(env:WorkerBindings,signer:Signer,team:string,message:ThreadMessage){
 const mappings=(await env.DB.prepare("SELECT b.destination_id,b.object_id,s.updated_at FROM vector_channel_bindings b JOIN vector_webhook_destinations d ON d.id=b.destination_id AND d.enabled=1 AND d.revoked_at IS NULL JOIN teams t ON t.id=b.object_id AND t.workspace_id=b.workspace_id AND t.archived_at IS NULL JOIN vector_slack_installations s ON s.workspace_id=b.workspace_id AND s.slack_team_id=? AND s.enabled=1 WHERE b.workspace_id=? AND b.channel_id=? AND b.scope='team' AND d.kind='slack' AND b.suspended_reason IS NULL").bind(team,signer.workspace,message.channel).all<{destination_id:string;object_id:string;updated_at:string}>()).results;
 if(mappings.length!==1)throw new IntegrationError(403,'slack_channel_unmapped');
 const link=await env.DB.prepare("SELECT l.operator_id,l.linked_at FROM vector_slack_member_links l JOIN operators o ON o.id=l.operator_id AND o.workspace_id=l.workspace_id AND o.removed_at IS NULL AND o.role IN('owner','admin','member') JOIN vector_auth_operators m ON m.operator_id=o.id JOIN oa_operators a ON a.id=m.auth_id AND a.status='active' WHERE l.workspace_id=? AND l.slack_team_id=? AND l.slack_user_id=?").bind(signer.workspace,team,message.user).first<{operator_id:string;linked_at:string}>();
 if(!link)throw new IntegrationError(403,'slack_member_not_linked');
 const binding=mappings[0];
 const access={sql:`EXISTS(SELECT 1 FROM vector_slack_installations s JOIN vector_integration_secret_keys k ON k.identity='slack-signing:'||s.workspace_id AND k.slot='current' WHERE s.workspace_id=? AND s.slack_team_id=? AND s.enabled=1 AND s.updated_at=? AND k.encrypted=?)
 AND EXISTS(SELECT 1 FROM vector_slack_member_links WHERE operator_id=? AND workspace_id=? AND slack_team_id=? AND slack_user_id=? AND linked_at=?)
 AND EXISTS(SELECT 1 FROM vector_channel_bindings b JOIN vector_webhook_destinations d ON d.id=b.destination_id WHERE b.destination_id=? AND b.workspace_id=? AND b.object_id=? AND b.channel_id=? AND b.scope='team' AND b.suspended_reason IS NULL AND d.enabled=1 AND d.revoked_at IS NULL)
 AND NOT EXISTS(SELECT 1 FROM vector_restore_status WHERE effects_held=1)`,values:[signer.workspace,team,binding.updated_at,signer.encrypted,link.operator_id,signer.workspace,team,message.user,link.linked_at,binding.destination_id,signer.workspace,binding.object_id,message.channel]};
 return {binding,link,access};
}
/** A source timestamp is unique even if Slack retries with a different event ID.
 * Source, root, issue and replay receipt commit in the same native transaction. */
export async function receiveThreadMessage(env:WorkerBindings,signer:Signer,team:string,message:ThreadMessage,key:string,existingIdentifier?:string){
 if(message.bot_id||message.subtype)return {ok:true,ignored:true};
 const add=/^\s*<@[A-Z0-9]+>\s+add\s+([A-Z]{2,10}-[1-9][0-9]*)\b/.exec(message.text);
 existingIdentifier=existingIdentifier??add?.[1];
 const {binding,link,access}=await threadAdmission(env,signer,team,message);
 const rootTs=message.thread_ts??message.ts;
 const mapping=await env.DB.prepare('SELECT m.id,m.issue_id,m.root_comment_id,i.identifier FROM vector_slack_threads m JOIN issues i ON i.id=m.issue_id WHERE m.workspace_id=? AND m.slack_team_id=? AND m.channel_id=? AND m.thread_ts=? AND m.held=0 AND m.installation_at=? AND m.destination_id=? AND i.team_id=?').bind(signer.workspace,team,message.channel,rootTs,binding.updated_at,binding.destination_id,binding.object_id).first<ThreadMapping>();
 const replay=()=>env.DB.prepare('SELECT 1 FROM vector_slack_event_receipts WHERE workspace_id=? AND event_key=?').bind(signer.workspace,key).first();
 if(await replay())throw new IntegrationError(409,'slack_event_replayed');
 const now=new Date(),at=now.toISOString();
 const receipt=(db:D1Database,identifier:string)=>db.prepare('INSERT INTO vector_slack_event_receipts(workspace_id,event_key,identifier,received_at) VALUES(?,?,?,?)').bind(signer.workspace,key,identifier,at);
 if(mapping){
  if(existingIdentifier&&existingIdentifier!==mapping.identifier)throw refused();
  if(message.ts===rootTs||await env.DB.prepare('SELECT 1 FROM vector_slack_thread_messages WHERE thread_id=? AND message_ts=?').bind(mapping.id,message.ts).first())throw new IntegrationError(409,'slack_event_replayed');
  const authority=await actionAuthority(env.DB,link.operator_id,'POST','/issues/:identifier/comments',{identifier:mapping.identifier},{body:message.text,parentId:mapping.root_comment_id});
  if(!authority.fence)throw refused();
  const db=mutationDatabase(visibilityDatabase(env.DB,link.operator_id),link.operator_id,undefined,access,authority.fence);
  try{
   const id=await addComment(db,mapping.issue_id,link.operator_id,message.text,mapping.root_comment_id,(transaction,id)=>[
    transaction.prepare('SELECT CASE WHEN EXISTS(SELECT 1 FROM vector_slack_threads WHERE id=? AND held=0 AND issue_id=?) THEN 1 ELSE json(\'Slack mapping changed\') END').bind(mapping.id,mapping.issue_id),
    transaction.prepare('INSERT INTO vector_slack_thread_messages(thread_id,message_ts,comment_id) VALUES(?,?,?)').bind(mapping.id,message.ts,id),
    transaction.prepare('DELETE FROM vector_slack_thread_events WHERE id=?').bind(id+':slack-thread'),receipt(transaction,mapping.identifier),
   ]);
   return {ok:true,identifier:mapping.identifier,rootCommentId:mapping.root_comment_id,commentId:id};
  }catch(error){if(await replay()||await env.DB.prepare('SELECT 1 FROM vector_slack_thread_messages WHERE thread_id=? AND message_ts=?').bind(mapping.id,message.ts).first())throw new IntegrationError(409,'slack_event_replayed');throw error;}
 }
 if(message.type==='message')throw refused();
 const visible=visibilityDatabase(env.DB,link.operator_id);
 const existing=existingIdentifier?await visible.prepare('SELECT id,identifier FROM issues WHERE identifier=? AND team_id=?').bind(existingIdentifier,binding.object_id).first<{id:string;identifier:string}>():null;
 if(existingIdentifier&&!existing)throw refused();
 const text=message.text.replace(/^\s*<@[A-Z0-9]+>\s*/,'').trim();
 const permalink='https://app.slack.com/archives/'+message.channel+'/p'+message.ts.replace('.','');
 const body=message.text+'\n\nSlack author: '+(message.source_user??message.user)+'\n'+permalink;
 const input=createIssueInputSchema.safeParse({teamId:binding.object_id,title:text.slice(0,240),description:body});
 if(!input.success)throw new IntegrationError(400,'slack_issue_invalid');
 const authority=await actionAuthority(env.DB,link.operator_id,'POST',existing?'/issues/:identifier/comments':'/issues',existing?{identifier:existing.identifier}:{},existing?{body}:input.data);
 if(!authority.fence)throw refused();
 const db=mutationDatabase(visible,link.operator_id,undefined,access,authority.fence);
 const root=createUlid(now),mappingId=createUlid(now),activityId=createUlid(now);
 const writes=(transaction:D1Database,identifier:string)=>{
  const issueId='(SELECT id FROM issues WHERE identifier=?)';
  return [
   transaction.prepare(`INSERT INTO issue_comments(id,issue_id,actor_operator_id,body,created_at,updated_at) VALUES(?,${issueId},?,?,?,?)`).bind(root,identifier,link.operator_id,body,at,at),
   transaction.prepare(`INSERT INTO vector_slack_threads(id,workspace_id,slack_team_id,channel_id,thread_ts,installation_at,destination_id,issue_id,root_comment_id,operator_id,linked_at,permalink,created_at) VALUES(?,?,?,?,?,?,?,${issueId},?,?,?,?,?)`).bind(mappingId,signer.workspace,team,message.channel,rootTs,binding.updated_at,binding.destination_id,identifier,root,link.operator_id,link.linked_at,permalink,at),
   transaction.prepare('INSERT INTO vector_slack_thread_messages(thread_id,message_ts,comment_id) VALUES(?,?,?)').bind(mappingId,message.ts,root),
   transaction.prepare(`INSERT INTO issue_activity(id,issue_id,actor_operator_id,kind,next_value_json,created_at,updated_at) VALUES(?,${issueId},?,'comment.created',?,?,?)`).bind(activityId,identifier,link.operator_id,JSON.stringify({id:root}),at,at),
   receipt(transaction,identifier),
  ];
 };
 try{
  let identifier:string;
  if(existing){
   const event={id:activityId,issueId:existing.id,actor:link.operator_id,at};
   await db.batch([...writes(db,existing.identifier),...followStatements(db,event,[link.operator_id]),...commentStatements(db,event),...finalizeEvent(db,event)]);identifier=existing.identifier;
  }else identifier=(await createIssueRecord(db,{actorOperatorId:link.operator_id,input:input.data,now,commitStatements:writes})).identifier;
  return {ok:true,identifier,rootCommentId:root};
 }catch(error){if(await replay()||await env.DB.prepare('SELECT 1 FROM vector_slack_threads WHERE workspace_id=? AND slack_team_id=? AND channel_id=? AND thread_ts=?').bind(signer.workspace,team,message.channel,rootTs).first())throw new IntegrationError(409,'slack_event_replayed');throw error;}
}
