import {z} from 'zod';
import type {WorkerBindings} from '../../../app/bindings';
import {sha256} from '../../../../../vendor/base/integrations/core/crypto';
import {mutationDatabase} from '../../auth/mutation-database';
import {actionAuthority} from '../../roles/enforcement';
import {visibilityDatabase} from '../../roles/visibility-database';
import {createIssueRecord} from '../../issues/repository';
import {createIssueInputSchema} from '../../issues/input';
import {signedInstallation} from '../slack-dm/signing';
import {rawIntegrationBody} from '../raw-body';
import {IntegrationError} from '../errors';
const callback=z.object({type:z.literal('event_callback'),team_id:z.string().max(100),event_id:z.string().min(1).max(200),event:z.object({type:z.literal('app_mention'),user:z.string().max(100),channel:z.string().max(100),text:z.string().max(100_000),bot_id:z.string().optional(),subtype:z.string().optional()})});
/** The signature identifies the installation; neither an untrusted team ID nor
 * a browser session selects it. No request state is written before admission. */
export async function receiveSlackEvent(env:WorkerBindings,request:Request){
 const timestamp=request.headers.get('x-slack-request-timestamp')??'',signature=request.headers.get('x-slack-signature')??'';
 if(!/^[0-9]{1,12}$/.test(timestamp)||!/^v0=[0-9a-f]{64}$/.test(signature))throw new IntegrationError(401,'slack_signature_invalid');
 if(Math.abs(Math.floor(Date.now()/1000)-Number(timestamp))>300)throw new IntegrationError(401,'slack_request_stale');
 let body:string;
 try{body=new TextDecoder('utf-8',{fatal:true}).decode(await rawIntegrationBody(request,131072));}catch(error){if(error instanceof IntegrationError)throw error;throw new IntegrationError(400,'slack_payload_invalid');}
 const signer=await signedInstallation(env,timestamp,body,signature.slice(3));
 if(!signer)throw new IntegrationError(401,'slack_signature_invalid');
 let payload:unknown;try{payload=JSON.parse(body);}catch{throw new IntegrationError(400,'slack_payload_invalid');}
 const verification=z.object({type:z.literal('url_verification'),challenge:z.string().min(1).max(3000)}).safeParse(payload);
 if(verification.success)return {challenge:verification.data.challenge};
 const parsed=callback.safeParse(payload);
 if(!parsed.success)throw new IntegrationError(400,'slack_event_unsupported');
 const {event,event_id,team_id}=parsed.data;
 if(event.bot_id||event.subtype)throw new IntegrationError(400,'slack_event_unsupported');
 const key=await sha256(event_id),existing=()=>env.DB.prepare('SELECT identifier FROM vector_slack_event_receipts WHERE workspace_id=? AND event_key=?').bind(signer.workspace,key).first<{identifier:string}>();
 if(await existing())throw new IntegrationError(409,'slack_event_replayed');
 // Only an explicit, unambiguous team channel binding is an intake mapping.
 // Project/view destinations cannot grant a route into their teams.
 const mappings=(await env.DB.prepare("SELECT b.destination_id,b.object_id FROM vector_channel_bindings b JOIN vector_webhook_destinations d ON d.id=b.destination_id AND d.enabled=1 AND d.revoked_at IS NULL JOIN teams t ON t.id=b.object_id AND t.archived_at IS NULL WHERE b.workspace_id=? AND b.channel_id=? AND b.scope='team' AND d.kind='slack' AND b.suspended_reason IS NULL").bind(signer.workspace,event.channel).all<{destination_id:string;object_id:string}>()).results;
 if(mappings.length!==1)throw new IntegrationError(403,'slack_channel_unmapped');
 const link=await env.DB.prepare("SELECT l.operator_id,l.linked_at FROM vector_slack_member_links l JOIN operators o ON o.id=l.operator_id AND o.workspace_id=l.workspace_id AND o.removed_at IS NULL JOIN vector_auth_operators m ON m.operator_id=o.id JOIN oa_operators a ON a.id=m.auth_id AND a.status='active' WHERE l.workspace_id=? AND l.slack_team_id=? AND l.slack_user_id=?").bind(signer.workspace,team_id,event.user).first<{operator_id:string;linked_at:string}>();
 if(!link)throw new IntegrationError(403,'slack_member_not_linked');
 const title=event.text.replace(/^\s*<@[A-Z0-9]+>\s*/,'').trim();
 const input=createIssueInputSchema.safeParse({teamId:mappings[0].object_id,title});
 if(!input.success)throw new IntegrationError(400,'slack_issue_invalid');
 const authority=await actionAuthority(env.DB,link.operator_id,'POST','/issues',{},input.data);
 if(!authority.fence)throw new IntegrationError(403,'slack_member_forbidden');
 const access={sql:`EXISTS(SELECT 1 FROM vector_slack_installations s JOIN vector_integration_secret_keys k ON k.identity='slack-signing:'||s.workspace_id AND k.slot='current' WHERE s.workspace_id=? AND s.enabled=1 AND k.encrypted=?)
 AND EXISTS(SELECT 1 FROM vector_slack_member_links WHERE operator_id=? AND workspace_id=? AND slack_team_id=? AND slack_user_id=? AND linked_at=?)
 AND EXISTS(SELECT 1 FROM vector_channel_bindings b JOIN vector_webhook_destinations d ON d.id=b.destination_id WHERE b.destination_id=? AND b.workspace_id=? AND b.object_id=? AND b.channel_id=? AND b.scope='team' AND b.suspended_reason IS NULL AND d.enabled=1 AND d.revoked_at IS NULL)
 AND NOT EXISTS(SELECT 1 FROM vector_restore_status WHERE effects_held=1)`,values:[signer.workspace,signer.encrypted,link.operator_id,signer.workspace,team_id,event.user,link.linked_at,mappings[0].destination_id,signer.workspace,input.data.teamId,event.channel]};
 const now=new Date(),db=mutationDatabase(visibilityDatabase(env.DB,link.operator_id),link.operator_id,undefined,access,authority.fence);
 try{
  const issue=await createIssueRecord(db,{actorOperatorId:link.operator_id,input:input.data,now,commitStatements:(transaction,identifier)=>[transaction.prepare('INSERT INTO vector_slack_event_receipts(workspace_id,event_key,identifier,received_at) VALUES(?,?,?,?)').bind(signer.workspace,key,identifier,now.toISOString())]});
  return {ok:true,identifier:issue.identifier};
 }catch(error){if(await existing())throw new IntegrationError(409,'slack_event_replayed');throw error;}
}
