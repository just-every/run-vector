import {requireSlackChannel} from './channel-safety';
import type {z} from 'zod';
import type {WorkerBindings} from '../../../app/bindings';
import {createUlid} from '../../../shared/ids';
import {guardedSql,ownerPredicate,type IntegrationOwner} from '../authority';
import {sealSecret,openSecret} from '../secrets';
import {IntegrationError} from '../errors';
import {bindingInput} from './schema';
import {discordUrl,slackCall,slackToken} from './provider';
type Binding=z.infer<typeof bindingInput>;
export async function credentialProblem(env:WorkerBindings,identity:string){
 const row=await env.DB.prepare("SELECT encrypted FROM vector_integration_secret_keys WHERE identity=? AND slot='current'").bind(identity).first<{encrypted:string}>();
 if(!row)return true;try{await openSecret(env,identity,row.encrypted);return false;}catch{return true;}
}
export async function saveSlack(env:WorkerBindings,owner:IntegrationOwner,token:string){
 const identity='slack:'+owner.workspace,auth=await slackCall(token,'auth.test',{}),encrypted=await sealSecret(env,identity,token);
 await guardedSql(env.DB,ownerPredicate(owner)).batch([
  {sql:'INSERT INTO vector_slack_installations(workspace_id,team_name,created_by,enabled,updated_at) VALUES(?,?,?,1,?) ON CONFLICT(workspace_id) DO UPDATE SET team_name=excluded.team_name,created_by=excluded.created_by,enabled=1,updated_at=excluded.updated_at',params:[owner.workspace,auth.team??'Slack workspace',owner.id,new Date().toISOString()]},
  {sql:"INSERT INTO vector_integration_secret_keys(identity,slot,encrypted) VALUES(?,'current',?) ON CONFLICT(identity,slot) DO UPDATE SET encrypted=excluded.encrypted",params:[identity,encrypted]},
 ]);
 return {connected:true};
}
export async function removeSlack(env:WorkerBindings,owner:IntegrationOwner){
 // Revoke at Slack before retiring local custody; an error is shown, never silently accepted.
 if(!await credentialProblem(env,'slack:'+owner.workspace))await slackCall(await slackToken(env,owner.workspace),'auth.revoke',{});
 await guardedSql(env.DB,ownerPredicate(owner)).batch([
  {sql:'UPDATE vector_slack_installations SET enabled=0 WHERE workspace_id=?',params:[owner.workspace]},
  {sql:'DELETE FROM vector_integration_secret_keys WHERE identity=?',params:['slack:'+owner.workspace]},
  {sql:"UPDATE vector_webhook_destinations SET enabled=0,revoked_at=COALESCE(revoked_at,?) WHERE workspace_id=? AND kind='slack'",params:[new Date().toISOString(),owner.workspace]},
 ]);return {removed:true};
}
export async function bindingWrites(env:WorkerBindings,owner:IntegrationOwner,input:Binding,skipObjectCheck=false){
 if(input.provider==='slack'&&!input.channelId)throw new IntegrationError(400,'slack_channel_required');
 if(input.provider==='slack')await requireSlackChannel(env,owner.workspace,input.channelId!);
 const id=createUlid(new Date()),at=new Date().toISOString(),identity='destination:'+id;
 const encrypted=input.provider==='discord'?await sealSecret(env,identity,discordUrl(input.webhookUrl??'')):null;
 const table={team:'teams',project:'projects',view:'saved_views'}[input.scope];
 return {id,writes:[
  ...(!skipObjectCheck?[{sql:`SELECT CASE WHEN EXISTS(SELECT 1 FROM ${table} WHERE id=? AND workspace_id=?${input.scope==='view'?' AND (owner_operator_id=? OR is_shared=1)':''}) THEN 1 ELSE json('channel object unavailable') END`,params:[input.objectId,owner.workspace,...(input.scope==='view'?[owner.id]:[])]}]:[]),
  {sql:'UPDATE vector_webhook_destinations SET enabled=0,revoked_at=COALESCE(revoked_at,?) WHERE id IN(SELECT destination_id FROM vector_channel_bindings WHERE workspace_id=? AND scope=? AND object_id=?)',params:[at,owner.workspace,input.scope,input.objectId]},
  {sql:"DELETE FROM vector_integration_secret_keys WHERE identity IN(SELECT 'destination:'||destination_id FROM vector_channel_bindings WHERE workspace_id=? AND scope=? AND object_id=?)",params:[owner.workspace,input.scope,input.objectId]},
  {sql:'DELETE FROM vector_channel_bindings WHERE workspace_id=? AND scope=? AND object_id=?',params:[owner.workspace,input.scope,input.objectId]},
  {sql:'INSERT INTO vector_webhook_destinations(id,workspace_id,name,url,kind,created_at,updated_at) VALUES(?,?,?,?,?,?,?)',params:[id,owner.workspace,input.channelName,input.provider==='slack'?'https://slack.com/api/chat.postMessage':'https://discord.com/api/webhooks/',input.provider,at,at]},
  {sql:'INSERT INTO vector_channel_bindings(destination_id,workspace_id,scope,object_id,channel_id,channel_name,events,created_by) VALUES(?,?,?,?,?,?,?,?)',params:[id,owner.workspace,input.scope,input.objectId,input.channelId??'',input.channelName,JSON.stringify(input.events),owner.id]},
  ...(encrypted?[{sql:"INSERT INTO vector_integration_secret_keys(identity,slot,encrypted) VALUES(?,'current',?)",params:[identity,encrypted]}]:[]),
 ]};
}
export async function saveBinding(env:WorkerBindings,owner:IntegrationOwner,input:Binding){
 const {id,writes}=await bindingWrites(env,owner,input);
 await guardedSql(env.DB,ownerPredicate(owner)).batch(writes);return {id};
}
export async function removeBinding(env:WorkerBindings,owner:IntegrationOwner,id:string){
 await guardedSql(env.DB,ownerPredicate(owner)).batch([
  {sql:"UPDATE vector_webhook_destinations SET enabled=0,revoked_at=COALESCE(revoked_at,?) WHERE id=? AND workspace_id=? AND kind<>'webhook'",params:[new Date().toISOString(),id,owner.workspace]},
  {sql:"DELETE FROM vector_integration_secret_keys WHERE identity=? AND EXISTS(SELECT 1 FROM vector_webhook_destinations WHERE id=? AND workspace_id=? AND revoked_at IS NOT NULL)",params:['destination:'+id,id,owner.workspace]},
  {sql:'DELETE FROM vector_channel_bindings WHERE destination_id=? AND workspace_id=?',params:[id,owner.workspace]},
 ]);return {removed:true};
}
/** Called once by the create door; provider errors leave the native object uncreated. */
export async function createSlackChannel(env:WorkerBindings,owner:IntegrationOwner,name:string,scope:'team'|'project'){
 const normalized=name.toLowerCase().replace(/[^a-z0-9-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,80);
 if(!normalized)throw new IntegrationError(400,'invalid_slack_channel_name');
 const result=await slackCall(await slackToken(env,owner.workspace),'conversations.create',{name:normalized,is_private:false});
 if(!result.channel?.id||!result.channel.name)throw new IntegrationError(503,'slack_invalid_channel');
 const draft=await bindingWrites(env,owner,{scope,objectId:'',provider:'slack',channelId:result.channel.id,channelName:result.channel.name,events:['triage.created','issue.created','issue.status_changed']},true);
 return (objectId:string)=>draft.writes.map(write=>env.DB.prepare(write.sql).bind(...write.params.map(value=>value===''?objectId:value)));
}
export async function readChannels(env:WorkerBindings,owner:IntegrationOwner){
 const [install,bindings,objects]=await guardedSql(env.DB,ownerPredicate(owner)).batch([
  {sql:'SELECT * FROM vector_slack_installations WHERE workspace_id=?',params:[owner.workspace]},
  {sql:`SELECT b.destination_id id,b.scope,b.object_id objectId,b.channel_id channelId,b.channel_name channelName,b.events,b.suspended_reason suspendedReason,d.kind provider,COALESCE(t.name,p.name,v.name,'Removed object') objectName FROM vector_channel_bindings b JOIN vector_webhook_destinations d ON d.id=b.destination_id AND d.revoked_at IS NULL LEFT JOIN teams t ON b.scope='team' AND t.id=b.object_id LEFT JOIN projects p ON b.scope='project' AND p.id=b.object_id LEFT JOIN saved_views v ON b.scope='view' AND v.id=b.object_id WHERE b.workspace_id=? AND (b.scope<>'view' OR v.owner_operator_id=? OR v.is_shared=1) ORDER BY b.scope,b.channel_name`,params:[owner.workspace,owner.id]},
  {sql:"SELECT id,name,'team' scope FROM teams WHERE workspace_id=? AND archived_at IS NULL UNION ALL SELECT id,name,'project' scope FROM projects WHERE workspace_id=? AND archived_at IS NULL UNION ALL SELECT id,name,'view' scope FROM saved_views WHERE workspace_id=? AND (owner_operator_id=? OR is_shared=1)",params:[owner.workspace,owner.workspace,owner.workspace,owner.id]},
 ]);
 const needsAttention=Boolean(install.length)&&(!install[0].enabled||await credentialProblem(env,'slack:'+owner.workspace));
 return {slack:{connected:Boolean(install[0]?.enabled)&&!needsAttention,needsAttention,teamName:install[0]?.team_name??null},bindings:await Promise.all(bindings.map(async row=>({...row,events:JSON.parse(String(row.events)),needsAttention:row.provider==='slack'?(needsAttention||Boolean(row.suspendedReason)):await credentialProblem(env,'destination:'+row.id)}))),objects};
}
