import {z} from 'zod';
import type {WorkerBindings} from '../../../app/bindings';
import {mutationDatabase,type NativeAccessFence} from '../../auth/mutation-database';
import {visibilityDatabase} from '../../roles/visibility-database';
import {actionAuthority} from '../../roles/enforcement';
import {IntegrationError} from '../errors';
export const slackMessage=z.object({user:z.string().regex(/^[UW][A-Z0-9]{2,30}$/),channel:z.string().regex(/^[CG][A-Z0-9]{2,30}$/),text:z.string().max(100_000),ts:z.string().regex(/^[0-9]{1,12}\.[0-9]{1,8}$/),thread_ts:z.string().regex(/^[0-9]{1,12}\.[0-9]{1,8}$/).optional(),bot_id:z.string().optional(),subtype:z.string().optional()});
export type SlackMessage=z.infer<typeof slackMessage>;
export type Signer={workspace:string;encrypted:string};
export type ThreadMapping={root_comment_id:string;issue_id:string;workspace_id:string;installation_at:string;slack_team_id:string;channel_id:string;thread_ts:string;destination_id:string;operator_id:string;slack_user_id:string;linked_at:string;permalink:string;created_at:string};
export async function mappedThread(env:WorkerBindings,workspace:string,team:string,channel:string,ts:string){
 return env.DB.prepare('SELECT * FROM vector_slack_threads WHERE workspace_id=? AND slack_team_id=? AND channel_id=? AND thread_ts=?').bind(workspace,team,channel,ts).first<ThreadMapping>();
}
export async function threadAdmission(env:WorkerBindings,signer:Signer,team:string,event:SlackMessage,identifier?:string){
 const installation=await env.DB.prepare('SELECT updated_at FROM vector_slack_installations WHERE workspace_id=? AND enabled=1 AND slack_team_id=?').bind(signer.workspace,team).first<{updated_at:string}>();
 if(!installation)throw new IntegrationError(403,'slack_workspace_mismatch');
 const bindings=(await env.DB.prepare("SELECT b.destination_id,b.object_id FROM vector_channel_bindings b JOIN vector_webhook_destinations d ON d.id=b.destination_id AND d.enabled=1 AND d.revoked_at IS NULL JOIN teams t ON t.id=b.object_id AND t.archived_at IS NULL WHERE b.workspace_id=? AND b.channel_id=? AND b.scope='team' AND d.kind='slack' AND b.suspended_reason IS NULL").bind(signer.workspace,event.channel).all<{destination_id:string;object_id:string}>()).results;
 if(bindings.length!==1)throw new IntegrationError(403,'slack_channel_unmapped');
 const binding=bindings[0];
 const link=await env.DB.prepare("SELECT l.operator_id,l.linked_at,l.slack_name FROM vector_slack_member_links l JOIN operators o ON o.id=l.operator_id AND o.workspace_id=l.workspace_id AND o.removed_at IS NULL JOIN vector_auth_operators m ON m.operator_id=o.id JOIN oa_operators a ON a.id=m.auth_id AND a.status='active' WHERE l.workspace_id=? AND l.slack_team_id=? AND l.slack_user_id=?").bind(signer.workspace,team,event.user).first<{operator_id:string;linked_at:string;slack_name:string}>();
 if(!link)throw new IntegrationError(403,'slack_member_not_linked');
 const path=identifier?'/issues/:identifier/comments':'/issues';
 const authority=await actionAuthority(env.DB,link.operator_id,'POST',path,identifier?{identifier}:{},{teamId:binding.object_id});
 if(!authority.fence)throw new IntegrationError(403,'slack_member_forbidden');
 const access:NativeAccessFence={sql:`EXISTS(SELECT 1 FROM vector_slack_installations s JOIN vector_integration_secret_keys k ON k.identity='slack-signing:'||s.workspace_id AND k.slot='current' WHERE s.workspace_id=? AND s.enabled=1 AND s.slack_team_id=? AND s.updated_at=? AND k.encrypted=?)
 AND EXISTS(SELECT 1 FROM vector_slack_member_links WHERE operator_id=? AND workspace_id=? AND slack_team_id=? AND slack_user_id=? AND linked_at=?)
 AND EXISTS(SELECT 1 FROM vector_channel_bindings b JOIN vector_webhook_destinations d ON d.id=b.destination_id WHERE b.destination_id=? AND b.workspace_id=? AND b.object_id=? AND b.channel_id=? AND b.scope='team' AND b.suspended_reason IS NULL AND d.enabled=1 AND d.revoked_at IS NULL)
 AND NOT EXISTS(SELECT 1 FROM vector_restore_status WHERE effects_held=1)`,values:[signer.workspace,team,installation.updated_at,signer.encrypted,link.operator_id,signer.workspace,team,event.user,link.linked_at,binding.destination_id,signer.workspace,binding.object_id,event.channel]};
 return {binding,link,installation,db:mutationDatabase(visibilityDatabase(env.DB,link.operator_id),link.operator_id,undefined,access,authority.fence)};
}
export function messageReceipt(db:D1Database,workspace:string,team:string,event:SlackMessage,commentId:string){
 return db.prepare('INSERT INTO vector_slack_thread_messages(workspace_id,slack_team_id,channel_id,message_ts,comment_id) VALUES(?,?,?,?,?)').bind(workspace,team,event.channel,event.ts,commentId);
}
export function eventReceipt(db:D1Database,workspace:string,key:string,identifier:string,at:string){
 return db.prepare('INSERT INTO vector_slack_event_receipts(workspace_id,event_key,identifier,received_at) VALUES(?,?,?,?)').bind(workspace,key,identifier,at);
}
/** Inserted after inbound receipts, so Slack replies never echo back to Slack. */
export function threadReplyIntent(db:D1Database,issueId:string,root:string|undefined|null,commentId:string,actor:string,at:string){
 if(!root)return [];
 return [db.prepare(`INSERT INTO vector_webhook_events(id,workspace_id,destination_id,event,body,created_at)
 SELECT ?||':slack-thread',m.workspace_id,'slack-thread','slack.thread',json_object('issueId',m.issue_id,'rootId',m.root_comment_id,'kind','reply','commentId',?,'actorId',?),?
 FROM vector_slack_threads m WHERE m.root_comment_id=? AND m.issue_id=?
 AND NOT EXISTS(SELECT 1 FROM vector_slack_thread_messages r WHERE r.comment_id=?)
 AND NOT EXISTS(SELECT 1 FROM vector_slack_thread_holds h WHERE h.root_comment_id=m.root_comment_id)
 AND NOT EXISTS(SELECT 1 FROM vector_restore_status WHERE effects_held=1)`).bind(commentId,commentId,actor,at,root,issueId,commentId)];
}
