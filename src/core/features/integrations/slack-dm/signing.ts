import type {WorkerBindings} from '../../../app/bindings';
import {hex,equalSignature} from '../../../../../vendor/base/integrations/core/crypto';
import {guardedSql,ownerPredicate,type IntegrationOwner} from '../authority';
import {IntegrationError} from '../errors';
import {sealSecret,openSecret} from '../secrets';
import {credentialProblem} from '../channels/settings';
export const signingIdentity=(workspace:string)=>'slack-signing:'+workspace;
const encoder=new TextEncoder();
/** The Slack app's signing secret is sealed beside the bot token and never read back (SEC-001). */
export async function saveSigningSecret(env:WorkerBindings,owner:IntegrationOwner,secret:string){
 if(await credentialProblem(env,'slack:'+owner.workspace))throw new IntegrationError(409,'slack_needs_attention','Connect Slack with a bot token before entering its signing secret.');
 const identity=signingIdentity(owner.workspace),encrypted=await sealSecret(env,identity,secret);
 await guardedSql(env.DB,ownerPredicate(owner)).batch([
  {sql:"SELECT CASE WHEN EXISTS(SELECT 1 FROM vector_slack_installations WHERE workspace_id=? AND enabled=1) THEN 1 ELSE json('slack not connected') END",params:[owner.workspace]},
  {sql:"INSERT INTO vector_integration_secret_keys(identity,slot,encrypted) VALUES(?,'current',?) ON CONFLICT(identity,slot) DO UPDATE SET encrypted=excluded.encrypted",params:[identity,encrypted]},
 ]);
 return {saved:true};
}
async function slackSignature(secret:string,timestamp:string,body:string){
 const key=await crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 return hex(new Uint8Array(await crypto.subtle.sign('HMAC',key,encoder.encode('v0:'+timestamp+':'+body))));
}
/** Every configured secret is compared, in constant time, so the match reveals nothing about the others. */
export async function signedInstallation(env:WorkerBindings,timestamp:string,body:string,signature:string){
 const rows=(await env.DB.prepare("SELECT s.workspace_id AS workspace,k.encrypted FROM vector_slack_installations s JOIN vector_integration_secret_keys k ON k.identity='slack-signing:'||s.workspace_id AND k.slot='current' WHERE s.enabled=1 ORDER BY s.workspace_id LIMIT 20").all<{workspace:string;encrypted:string}>()).results;
 let matched:{workspace:string;encrypted:string}|null=null;
 for(const row of rows){
  const secret=await openSecret(env,signingIdentity(row.workspace),row.encrypted).catch(()=>null);
  if(secret!==null&&equalSignature(await slackSignature(secret,timestamp,body),signature)&&!matched)matched=row;
 }
 return matched;
}
