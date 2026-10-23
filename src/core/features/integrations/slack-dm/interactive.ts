import {z} from 'zod';
import type {WorkerBindings} from '../../../app/bindings';
import {sha256} from '../../../../../vendor/base/integrations/core/crypto';
import {admitRate} from '../../auth/repository';
import {mutationDatabase,isMutationAccessError,AuthorityChangedError} from '../../auth/mutation-database';
import {actionAuthority} from '../../roles/enforcement';
import {visibilityDatabase} from '../../roles/visibility-database';
import {updateIssueRecord} from '../../issue-edit/repository';
import {updateIssueSchema} from '../../issue-edit/routes';
import {IssueAccessError} from '../../issues/access';
import {IssueMutationError} from '../../issues/errors';
import {IntegrationError} from '../errors';
import {rawIntegrationBody} from '../raw-body';
import {slackCall,slackToken} from '../channels/provider';
import {credentialProblem} from '../channels/settings';
import {signedInstallation,signingIdentity} from './signing';
import {directIssue} from './delivery';
import {directMessage,refusalMessage} from './message';
const action=z.object({action_id:z.string().max(255),value:z.string().max(2000).optional(),selected_option:z.object({value:z.string().max(150)}).optional()});
const interaction=z.object({type:z.literal('block_actions'),user:z.object({id:z.string().regex(/^[UW][A-Z0-9]{2,30}$/)}),team:z.object({id:z.string().regex(/^[TE][A-Z0-9]{2,30}$/)}),
 container:z.object({message_ts:z.string().regex(/^[0-9]{1,12}\.[0-9]{1,8}$/).optional(),channel_id:z.string().regex(/^[CDG][A-Z0-9]{2,30}$/).optional()}).optional(),actions:z.array(action).min(1).max(1)});
type Container=z.infer<typeof interaction>['container'];
const assignValue=/^([A-Z]{2,10}-[1-9][0-9]{0,9}):([1-9][0-9]{0,9})$/,statusValue=/^([A-Z]{2,10}-[1-9][0-9]{0,9}):([1-9][0-9]{0,9}):([0-9A-HJKMNP-TV-Z]{26})$/;
type Link={operator_id:string;workspace_id:string;slack_team_id:string;slack_user_id:string;linked_at:string};
type Outcome='written'|'stale'|{refusal:string};
const notLinked=()=>new IntegrationError(403,'slack_member_not_linked','Link this Slack account in Vector Settings → Notifications first.');
/** The member's own authority, held for the whole mutation: an unlink, removal, credential
 * removal or signing-secret change between the check and the write aborts it. */
function slackAuthority(link:Link,encrypted:string){
 return {sql:`EXISTS(SELECT 1 FROM vector_slack_member_links l JOIN operators o ON o.id=l.operator_id AND o.workspace_id=l.workspace_id
  JOIN vector_auth_operators m ON m.operator_id=o.id JOIN oa_operators a ON a.id=m.auth_id
  JOIN vector_slack_installations s ON s.workspace_id=l.workspace_id AND s.enabled=1
  JOIN vector_integration_secret_keys k ON k.identity='slack-signing:'||l.workspace_id AND k.slot='current' AND k.encrypted=?
  WHERE l.operator_id=? AND l.workspace_id=? AND l.slack_team_id=? AND l.slack_user_id=? AND l.linked_at=? AND o.removed_at IS NULL AND a.status='active')
  AND NOT EXISTS(SELECT 1 FROM vector_restore_status WHERE effects_held=1)`,values:[encrypted,link.operator_id,link.workspace_id,link.slack_team_id,link.slack_user_id,link.linked_at]};
}
/** Slack interactivity: verified, replay-refused and answered before Slack's 3-second limit;
 * the visible reply follows through `after`. */
export async function receiveSlackAction(env:WorkerBindings,request:Request,after:(work:Promise<void>)=>void){
 const timestamp=request.headers.get('x-slack-request-timestamp')??'',signature=request.headers.get('x-slack-signature')??'';
 if(!/^[0-9]{1,12}$/.test(timestamp)||!/^v0=[0-9a-f]{64}$/.test(signature))throw new IntegrationError(401,'slack_signature_invalid');
 if(Math.abs(Math.floor(Date.now()/1000)-Number(timestamp))>300)throw new IntegrationError(401,'slack_request_stale');
 if(!await admitRate(env.DB,'slack-action:'+(request.headers.get('CF-Connecting-IP')??'unknown'),300,60_000))throw new IntegrationError(429,'slack_rate_limited');
 let body:string;
 try{body=new TextDecoder('utf-8',{fatal:true}).decode(await rawIntegrationBody(request,65536));}catch(error){if(error instanceof IntegrationError)throw error;throw new IntegrationError(400,'slack_payload_invalid');}
 const signer=await signedInstallation(env,timestamp,body,signature.slice(3));
 if(!signer)throw new IntegrationError(401,'slack_signature_invalid');
 const now=Date.now(),[,stored]=await env.DB.batch([
  env.DB.prepare('DELETE FROM vector_slack_request_keys WHERE received_at<?').bind(now-600_000),
  env.DB.prepare('INSERT INTO vector_slack_request_keys(key,received_at) VALUES(?,?) ON CONFLICT(key) DO NOTHING RETURNING key').bind(await sha256(signer.workspace+':'+timestamp+':'+signature),now),
 ]);
 if(!stored.results.length)throw new IntegrationError(409,'slack_request_replayed');
 let payload:z.infer<typeof interaction>;
 try{payload=interaction.parse(JSON.parse(new URLSearchParams(body).get('payload')??''));}catch{throw new IntegrationError(400,'slack_payload_unsupported');}
 const selected=payload.actions[0];
 // Open is a link button; Slack only needs the acknowledgement.
 if(selected.action_id==='vector_open')return;
 const link=await env.DB.prepare("SELECT l.operator_id,l.workspace_id,l.slack_team_id,l.slack_user_id,l.linked_at FROM vector_slack_member_links l JOIN operators o ON o.id=l.operator_id AND o.removed_at IS NULL JOIN vector_auth_operators m ON m.operator_id=o.id JOIN oa_operators a ON a.id=m.auth_id AND a.status='active' WHERE l.workspace_id=? AND l.slack_team_id=? AND l.slack_user_id=?").bind(signer.workspace,payload.team.id,payload.user.id).first<Link>();
 if(!link)throw notLinked();
 const assign=selected.action_id==='vector_assign_me'?assignValue.exec(selected.value??''):null;
 const status=selected.action_id==='vector_change_status'?statusValue.exec(selected.selected_option?.value??''):null;
 const chosen=assign??status;
 if(!chosen)throw new IntegrationError(400,'slack_action_unsupported');
 const identifier=chosen[1],input=updateIssueSchema.parse({expectedVersion:Number(chosen[2]),...(assign?{assigneeOperatorId:link.operator_id}:{statusId:status![3]})});
 // ROLE-001/ROLE-003: the member's current role and teams decide, as for the native issue edit,
 // and the write sees and changes only what they may see, fenced in its transaction.
 const authority=await actionAuthority(env.DB,link.operator_id,'PATCH','/issues/:identifier',{identifier},input);
 if(authority.decision==='unauthenticated')throw notLinked();
 const db=visibilityDatabase(env.DB,link.operator_id);
 const before=await db.prepare('SELECT s.name FROM issues i JOIN workflow_statuses s ON s.id=i.status_id JOIN teams t ON t.id=i.team_id WHERE i.identifier=? AND t.workspace_id=?').bind(identifier,link.workspace_id).first<string>('name');
 const unavailable={refusal:'This issue is not available to you, so nothing was changed.'};
 let outcome:Outcome;
 try{outcome=authority.fence?await updateIssueRecord(mutationDatabase(db,link.operator_id,undefined,slackAuthority(link,signer.encrypted),authority.fence),identifier,link.operator_id,input)
  :authority.decision==='forbidden'?{refusal:'Your workspace role does not allow this change, so nothing was changed.'}:unavailable;}
 catch(error){
  if(isMutationAccessError(error))throw notLinked();
  if(error instanceof IssueAccessError)outcome=unavailable;
  else if(error instanceof IssueMutationError||error instanceof AuthorityChangedError)outcome={refusal:error.message+' Nothing was changed.'};
  else throw error;
 }
 after(reply(env,link.workspace_id,link.operator_id,payload.container,identifier,assign?'assign':'status',outcome,before));
}
/** A change refreshes the message with the new version, projected only while the member may still see the
 * issue; a refusal answers in its thread with Open. */
async function reply(env:WorkerBindings,workspace:string,operator:string,container:Container,identifier:string,kind:'assign'|'status',outcome:Outcome,before:string|null){
 if(!container?.channel_id||!container.message_ts)return;
 try{
  const token=await slackToken(env,workspace);
  if(outcome!=='written'){
   await slackCall(token,'chat.postMessage',{channel:container.channel_id,thread_ts:container.message_ts,...refusalMessage(env.APP_ORIGIN,identifier,outcome==='stale'?'This issue changed after this message was sent, so nothing was changed. Open it to see the current issue.':outcome.refusal)});
   return;
  }
  const issue=await visibilityDatabase(env.DB,operator).prepare('SELECT i.identifier,i.title,i.version,i.due_date AS dueDate,i.status_id AS statusId,s.category AS statusCategory,s.name AS statusName,i.team_id AS teamId FROM issues i JOIN workflow_statuses s ON s.id=i.status_id JOIN teams t ON t.id=i.team_id WHERE i.identifier=? AND t.workspace_id=?').bind(identifier,workspace).first<{identifier:string;title:string;version:number;dueDate:string|null;statusId:string;statusCategory:string;statusName:string;teamId:string}>();
  if(!issue)return;
  const actions=!await credentialProblem(env,signingIdentity(workspace));
  const message=kind==='assign'?directMessage(env.APP_ORIGIN,await directIssue(env,issue),'Assigned to you',['You assigned this issue to yourself in Slack.'],actions)
   :directMessage(env.APP_ORIGIN,await directIssue(env,issue),'Status changed',[(before??issue.statusName)+' → '+issue.statusName,'Changed by you in Slack.'],actions);
  await slackCall(token,'chat.update',{channel:container.channel_id,ts:container.message_ts,...message});
 }catch{console.error('Slack action reply was not posted; the recorded issue change stands.');}
}
