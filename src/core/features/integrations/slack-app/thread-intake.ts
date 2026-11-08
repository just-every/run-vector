import type {WorkerBindings} from '../../../app/bindings';
import {sha256} from '../../../../../vendor/base/integrations/core/crypto';
import {createUlid} from '../../../shared/ids';
import {createIssueRecord} from '../../issues/repository';
import {createIssueInputSchema} from '../../issues/input';
import {requireIssueAccess} from '../../issues/access';
import {addComment} from '../../discussion/repository';
import {slackCall,slackToken} from '../channels/provider';
import {IntegrationError} from '../errors';
import {mappedThread,threadAdmission,messageReceipt,eventReceipt,type SlackMessage,type Signer,type ThreadMapping} from './thread-mapping';
const replayed=()=>new IntegrationError(409,'slack_event_replayed');
export async function intakeSlackMessage(env:WorkerBindings,signer:Signer,team:string,event:SlackMessage,eventKey:string,filing:boolean,sourceAuthor=event.user){
 if(event.bot_id||event.subtype)return {ok:true,ignored:true};
 const key=await sha256(eventKey),rootTs=event.thread_ts??event.ts;
 const replay=async()=>Boolean(await env.DB.prepare('SELECT 1 FROM vector_slack_event_receipts WHERE workspace_id=? AND event_key=? UNION ALL SELECT 1 FROM vector_slack_thread_messages WHERE workspace_id=? AND slack_team_id=? AND channel_id=? AND message_ts=?').bind(signer.workspace,key,signer.workspace,team,event.channel,event.ts).first());
 if(await replay())throw replayed();
 const mapping=await mappedThread(env,signer.workspace,team,event.channel,rootTs);
 if(!filing&&!mapping)return {ok:true,ignored:true};
 const text=event.text.replace(/^\s*<@[A-Z0-9]+>\s*/,'').trim();
 if(!text)throw new IntegrationError(400,'slack_issue_invalid');
 const existingIdentifier=mapping?await env.DB.prepare('SELECT identifier FROM issues WHERE id=?').bind(mapping.issue_id).first<string>('identifier'):null;
 const requested=!mapping?(/^link\s+([A-Z]{2,10}-[1-9][0-9]*)\s*$/i.exec(text)?.[1]?.toUpperCase()):undefined;
 const identifier=existingIdentifier??requested;
 if(mapping&&!existingIdentifier)throw new IntegrationError(403,'slack_thread_unavailable');
 const admitted=await threadAdmission(env,signer,team,event,identifier);
 const {db,link,binding,installation}=admitted,at=new Date().toISOString();
 try{
  if(mapping){
   if(event.ts===mapping.thread_ts)throw replayed();
   const issue=await requireIssueAccess(db,identifier!,link.operator_id);
   if(issue.id!==mapping.issue_id)throw new IntegrationError(403,'slack_thread_unavailable');
   const commentId=await addComment(db,issue.id,link.operator_id,event.text,mapping.root_comment_id,(transaction,id)=>[
    mappingGuard(transaction,mapping,installation.updated_at,binding.destination_id,binding.object_id),
    messageReceipt(transaction,signer.workspace,team,event,id),eventReceipt(transaction,signer.workspace,key,identifier!,at),
    transaction.prepare('UPDATE issue_comments SET imported_author_name=? WHERE id=?').bind('Slack · '+event.user,id),
   ]);
   return {ok:true,identifier,commentId,rootId:mapping.root_comment_id};
  }
  // A selected message starts a new mapping. A thread's existing mapping is
  // never moved to another issue by a later shortcut or mention.
  const permalink=await messagePermalink(env,signer.workspace,event.channel,event.ts);
  const rootId=createUlid(new Date()),body=event.text+'\n\nSlack author: '+sourceAuthor+'\n\n[View Slack message]('+permalink+')';
  const writes=(transaction:D1Database,issueIdentifier:string)=>rootStatements(transaction,{workspace:signer.workspace,team,event,key,rootTs,rootId,body,permalink,sourceAuthor,link,binding,installedAt:installation.updated_at,identifier:issueIdentifier,at});
  if(identifier){
   const issue=await requireIssueAccess(db,identifier,link.operator_id);
   const target=await db.prepare('SELECT team_id FROM issues WHERE id=?').bind(issue.id).first<string>('team_id');
   if(target!==binding.object_id)throw new IntegrationError(403,'slack_thread_unavailable');
   await db.batch(writes(db,identifier));
   return {ok:true,identifier,rootId};
  }
  const input=createIssueInputSchema.safeParse({teamId:binding.object_id,title:text.slice(0,500),description:body});
  if(!input.success)throw new IntegrationError(400,'slack_issue_invalid');
  const issue=await createIssueRecord(db,{actorOperatorId:link.operator_id,input:input.data,now:new Date(at),commitStatements:writes});
  return {ok:true,identifier:issue.identifier,rootId};
 }catch(error){if(await replay())throw replayed();throw error;}
}
function mappingGuard(db:D1Database,m:ThreadMapping,installedAt:string,destination:string,teamId:string){
 return db.prepare(`SELECT CASE WHEN EXISTS(SELECT 1 FROM vector_slack_threads m JOIN issues i ON i.id=m.issue_id WHERE m.root_comment_id=? AND m.installation_at=? AND m.destination_id=? AND i.team_id=? AND EXISTS(SELECT 1 FROM vector_slack_member_links l WHERE l.operator_id=m.operator_id AND l.slack_team_id=m.slack_team_id AND l.slack_user_id=m.slack_user_id AND l.linked_at=m.linked_at) AND NOT EXISTS(SELECT 1 FROM vector_slack_thread_holds h WHERE h.root_comment_id=m.root_comment_id)) THEN 1 ELSE json('Slack thread changed') END`).bind(m.root_comment_id,installedAt,destination,teamId);
}
async function messagePermalink(env:WorkerBindings,workspace:string,channel:string,ts:string){
 const response=await slackCall(await slackToken(env,workspace),'chat.getPermalink',{channel,message_ts:ts},'GET') as unknown as {permalink?:unknown};
 let url:URL;try{url=new URL(String(response.permalink));}catch{throw new IntegrationError(503,'slack_permalink_invalid');}
 if(url.protocol!=='https:'||!url.hostname.endsWith('.slack.com')||url.username||url.password||url.port||url.search||url.hash||url.pathname!=='/archives/'+channel+'/p'+ts.replace('.',''))throw new IntegrationError(503,'slack_permalink_invalid');
 return url.href;
}
type RootInput={workspace:string;team:string;event:SlackMessage;key:string;rootTs:string;rootId:string;body:string;permalink:string;sourceAuthor:string;link:{operator_id:string;linked_at:string};binding:{destination_id:string;object_id:string};installedAt:string;identifier:string;at:string};
function rootStatements(db:D1Database,input:RootInput){
 const {workspace,team,event,key,rootTs,rootId,body,permalink,sourceAuthor,link,binding,installedAt,identifier,at}=input;
 const activityId=createUlid(new Date(at));
 // The issue and its native thread root, follow state, mapping and both replay
 // receipts commit together. Any uniqueness or authority failure rolls it all back.
 return [
  db.prepare('INSERT INTO issue_comments(id,issue_id,actor_operator_id,body,imported_author_name,created_at,updated_at) SELECT ?,id,?,?,?,?,? FROM issues WHERE identifier=? AND team_id=?').bind(rootId,link.operator_id,body,'Slack · '+sourceAuthor,at,at,identifier,binding.object_id),
  db.prepare('INSERT INTO vector_slack_threads(root_comment_id,issue_id,workspace_id,installation_at,slack_team_id,channel_id,thread_ts,destination_id,operator_id,slack_user_id,linked_at,permalink,created_at) SELECT ?,id,?,?,?,?,?,?,?,?,?,?,? FROM issues WHERE identifier=? AND team_id=?').bind(rootId,workspace,installedAt,team,event.channel,rootTs,binding.destination_id,link.operator_id,event.user,link.linked_at,permalink,at,identifier,binding.object_id),
  messageReceipt(db,workspace,team,event,rootId),eventReceipt(db,workspace,key,identifier,at),
  db.prepare("INSERT INTO issue_activity(id,issue_id,actor_operator_id,kind,next_value_json,created_at,updated_at) SELECT ?,id,?,'comment.created',?,?,? FROM issues WHERE identifier=?").bind(activityId,link.operator_id,JSON.stringify({id:rootId}),at,at,identifier),
  db.prepare("INSERT INTO issue_followers(issue_id,operator_id,created_at) SELECT id,?,? FROM issues WHERE identifier=? ON CONFLICT DO NOTHING").bind(link.operator_id,at,identifier),
 ];
}
