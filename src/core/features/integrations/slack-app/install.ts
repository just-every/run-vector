import {z} from 'zod';
import {actionAuthority} from '../../roles/enforcement';
import {mutationDatabase} from '../../auth/mutation-database';
import type {WorkerBindings} from '../../../app/bindings';
import {IntegrationError} from '../errors';
import {integrationOwner,ownerPredicate,guardedSql,type IntegrationOwner} from '../authority';
import {sealSecret,openSecret} from '../secrets';
import {providerSend} from '../channels/provider';
import {saveSlack} from '../channels/settings';
import {sha256} from '../../../../../vendor/base/integrations/core/crypto';
import {auditStatement} from '../../audit/producer';

// Request only the capabilities Vector's channel/DM paths currently use.
export const appScopes=['chat:write','channels:manage','channels:read','im:write','users:read.email'];
const profile=z.object({appId:z.string().min(1).max(100),clientId:z.string().min(1).max(100),clientSecret:z.string().min(10).max(500),signingSecret:z.string().min(20).max(128)});
export const appCredentials=profile.strict();
const identity=(workspace:string)=>'slack-app:'+workspace;
export function appManifest(origin:string){
 const base=new URL(origin);
 if(!['http:','https:'].includes(base.protocol)||(base.protocol==='http:'&&!['127.0.0.1','localhost','[::1]'].includes(base.hostname))||base.username||base.password)throw new IntegrationError(503,'slack_origin_invalid');
 const callback=new URL('/api/integrations/slack/oauth/callback',base).href;
 return {display_information:{name:'Vector',description:'Workspace issue notifications'},features:{bot_user:{display_name:'Vector',always_online:false}},oauth_config:{redirect_urls:[callback],scopes:{bot:appScopes}},settings:{org_deploy_enabled:true,socket_mode_enabled:false,token_rotation_enabled:false}};
}
export async function appManager(env:WorkerBindings,request:Request){
 const owner=await integrationOwner(env,request);
 const role=await env.DB.prepare('SELECT role FROM operators WHERE id=? AND workspace_id=? AND removed_at IS NULL').bind(owner.id,owner.workspace).first<string>('role');
 if(role!=='owner'&&role!=='admin')throw new IntegrationError(403,'forbidden');
 return owner;
}
function managed(env:WorkerBindings,owner:IntegrationOwner){
 const native=ownerPredicate(owner);
 return guardedSql(env.DB,{sql:'('+native.sql+") AND EXISTS(SELECT 1 FROM operators WHERE id=? AND workspace_id=? AND role IN ('owner','admin') AND removed_at IS NULL)",params:[...(native.params??[]),owner.id,owner.workspace]});
}
async function call(method:string,body:Record<string,unknown>,token?:string,form=false){
 const response=await providerSend({url:'https://slack.com/api/'+method,headers:{...(token?{Authorization:'Bearer '+token}:{}),'Content-Type':form?'application/x-www-form-urlencoded':'application/json; charset=utf-8'},body:form?new URLSearchParams(Object.entries(body).map(([key,value])=>[key,String(value)])).toString():JSON.stringify(body)});
 let value:unknown;try{value=JSON.parse(response.body);}catch{throw new IntegrationError(503,'slack_invalid_response');}
 const parsed=z.object({ok:z.boolean(),error:z.string().regex(/^[a-z_]{1,80}$/).optional()}).passthrough().safeParse(value);
 if(!parsed.success||response.status<200||response.status>=300)throw new IntegrationError(503,'slack_response_unknown','Slack did not return a known result. Check Slack before trying again.');
 if(!parsed.data.ok)throw new IntegrationError(400,'slack_'+(parsed.data.error??'request_failed'),'Slack: '+(parsed.data.error??'request_failed'));
 return parsed.data;
}
async function load(env:WorkerBindings,workspace:string){
 const encrypted=await env.DB.prepare("SELECT encrypted FROM vector_integration_secret_keys WHERE identity=? AND slot='current'").bind(identity(workspace)).first<string>('encrypted');
 if(!encrypted)return null;
 return {encrypted,profile:profile.parse(JSON.parse(await openSecret(env,identity(workspace),encrypted)))};
}
export async function readApp(env:WorkerBindings,owner:IntegrationOwner){
 const saved=await load(env,owner.workspace),manifest=appManifest(env.APP_ORIGIN);
 return {manifest,createUrl:'https://api.slack.com/apps?new_app=1&manifest_json='+encodeURIComponent(JSON.stringify(manifest)),app:saved?{appId:saved.profile.appId,clientId:saved.profile.clientId}:null,callback:manifest.oauth_config.redirect_urls[0]};
}
export async function saveApp(env:WorkerBindings,owner:IntegrationOwner,input:unknown){
 const parsed=appCredentials.safeParse(input);if(!parsed.success)throw new IntegrationError(400,'slack_app_credentials_invalid');
 const encrypted=await sealSecret(env,identity(owner.workspace),JSON.stringify(parsed.data));
 await managed(env,owner).batch([
  {sql:"DELETE FROM vector_integration_secret_keys WHERE identity LIKE ?",params:['slack-oauth:'+owner.workspace+':%']},
  {sql:"INSERT INTO vector_integration_secret_keys(identity,slot,encrypted) VALUES(?,'current',?) ON CONFLICT(identity,slot) DO UPDATE SET encrypted=excluded.encrypted",params:[identity(owner.workspace),encrypted]},
  auditStatement({workspace:owner.workspace,actor:owner.id,action:'slack.app_configured',subject:parsed.data.appId}),
 ]);
 return {saved:true};
}
export async function createApp(env:WorkerBindings,owner:IntegrationOwner,token:string){
 const result=await call('apps.manifest.create',{manifest:JSON.stringify(appManifest(env.APP_ORIGIN))},token);
 const parsed=z.object({app_id:z.string(),credentials:z.object({client_id:z.string(),client_secret:z.string(),signing_secret:z.string()})}).safeParse(result);
 if(!parsed.success)throw new IntegrationError(503,'slack_app_credentials_missing');
 await saveApp(env,owner,{appId:parsed.data.app_id,clientId:parsed.data.credentials.client_id,clientSecret:parsed.data.credentials.client_secret,signingSecret:parsed.data.credentials.signing_secret});
 return {created:true};
}
export async function beginInstall(env:WorkerBindings,owner:IntegrationOwner){
 const saved=await load(env,owner.workspace);if(!saved)throw new IntegrationError(409,'slack_app_credentials_required');
 const state=crypto.randomUUID()+crypto.randomUUID(),key='slack-oauth:'+owner.workspace+':'+await sha256(state),expires=Date.now()+600_000;
 const value=await sealSecret(env,key,JSON.stringify({actor:owner.id,encrypted:saved.encrypted}));
 await managed(env,owner).batch([
  {sql:'DELETE FROM vector_integration_secret_keys WHERE identity LIKE ?',params:['slack-oauth:'+owner.workspace+':%']},
  {sql:"INSERT INTO vector_integration_secret_keys(identity,slot,encrypted,valid_until) VALUES(?,'current',?,?)",params:[key,value,expires]},
 ]);
 const url=new URL('https://slack.com/oauth/v2/authorize');
 for(const [name,value] of Object.entries({client_id:saved.profile.clientId,scope:appScopes.join(','),redirect_uri:appManifest(env.APP_ORIGIN).oauth_config.redirect_urls[0],state}))url.searchParams.set(name,value);
 return {url:url.href};
}
export async function completeInstall(env:WorkerBindings,request:Request){
 const owner=await appManager(env,request),url=new URL(request.url),state=url.searchParams.get('state')??'',code=url.searchParams.get('code')??'';
 if(state.length!==72||!code||code.length>2000||url.searchParams.has('error'))throw new IntegrationError(400,'slack_oauth_refused');
 const key='slack-oauth:'+owner.workspace+':'+await sha256(state);
 const rows=await managed(env,owner).batch([{sql:"DELETE FROM vector_integration_secret_keys WHERE identity=? AND slot='current' AND valid_until>? RETURNING encrypted",params:[key,Date.now()]}]);
 if(!rows[0].length)throw new IntegrationError(403,'slack_oauth_state_invalid');
 const pending=z.object({actor:z.string(),encrypted:z.string()}).parse(JSON.parse(await openSecret(env,key,String(rows[0][0].encrypted))));
 const saved=await load(env,owner.workspace);
 if(pending.actor!==owner.id||!saved||saved.encrypted!==pending.encrypted)throw new IntegrationError(403,'slack_oauth_state_invalid');
 const result=await call('oauth.v2.access',{client_id:saved.profile.clientId,client_secret:saved.profile.clientSecret,code,redirect_uri:appManifest(env.APP_ORIGIN).oauth_config.redirect_urls[0]},undefined,true);
 const token=z.object({access_token:z.string().min(10).max(500),token_type:z.literal('bot'),app_id:z.string(),scope:z.string()}).safeParse(result);
 if(!token.success||token.data.app_id!==saved.profile.appId||appScopes.some(scope=>!token.data.scope.split(',').includes(scope)))throw new IntegrationError(400,'slack_oauth_grant_invalid');
 const authority=await actionAuthority(env.DB,owner.id,'POST','/settings/integrations/slack/app',{},{});
 if(authority.decision!=='allow'||!authority.fence)throw new IntegrationError(403,'forbidden');
 await saveSlack({...env,DB:mutationDatabase(env.DB,owner.id,owner.fence,undefined,authority.fence)},owner,token.data.access_token);
 const signing=await sealSecret(env,'slack-signing:'+owner.workspace,saved.profile.signingSecret);
 await managed(env,owner).batch([
  {sql:"INSERT INTO vector_integration_secret_keys(identity,slot,encrypted) VALUES(?,'current',?) ON CONFLICT(identity,slot) DO UPDATE SET encrypted=excluded.encrypted",params:['slack-signing:'+owner.workspace,signing]},
  auditStatement({workspace:owner.workspace,actor:owner.id,action:'slack.app_installed',subject:saved.profile.appId}),
 ]);
}
