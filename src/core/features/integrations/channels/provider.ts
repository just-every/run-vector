import type { WorkerBindings } from '../../../app/bindings';
import { IntegrationError } from '../errors';
import { openSecret } from '../secrets';
import type { WireRequest, WireResponse, Outcome } from '../../../../../vendor/base/integrations';

export function discordUrl(value:string,allowWait=false) {
 let url:URL;try{url=new URL(value);}catch{throw new IntegrationError(400,'invalid_discord_webhook');}
 if(url.protocol!=='https:'||!['discord.com','discordapp.com'].includes(url.hostname)||url.port||url.username||url.password||url.hash||(url.search&&(!allowWait||url.search!=='?wait=true'))||!url.pathname.startsWith('/api/webhooks/')||url.pathname.length<=14)throw new IntegrationError(400,'invalid_discord_webhook','Use an HTTPS discord.com or discordapp.com /api/webhooks/ URL.');
 return url.href;
}
/** The only destinations here are fixed provider hosts. Redirects are never followed. */
export async function providerSend(wire:WireRequest,method:'POST'|'GET'='POST'):Promise<WireResponse> {
 const url=new URL(wire.url);
 if(!(url.origin==='https://slack.com'&&(/^\/api\/[a-zA-Z.]+$/.test(url.pathname)||url.pathname==='/api/oauth.v2.access')))discordUrl(wire.url,true);
 if(method==='GET')for(const [key,value] of Object.entries(JSON.parse(wire.body)))url.searchParams.set(key,String(value));
 const response=await fetch(url.href,{method,headers:wire.headers,...(method==='POST'?{body:wire.body}:{}),redirect:'manual',signal:AbortSignal.timeout(15000)});
 return {status:response.status,headers:Object.fromEntries(response.headers),body:await response.text()};
}
export async function slackToken(env:WorkerBindings,workspace:string){
 const row=await env.DB.prepare("SELECT k.encrypted FROM vector_integration_secret_keys k JOIN vector_slack_installations s ON k.identity='slack:'||s.workspace_id WHERE s.workspace_id=? AND s.enabled=1 AND k.slot='current'").bind(workspace).first<{encrypted:string}>();
 if(!row)throw new IntegrationError(409,'slack_needs_attention','Slack needs attention. Enter the bot token in Integrations.');
 return openSecret(env,'slack:'+workspace,row.encrypted);
}
export async function slackCall(token:string,method:string,body:unknown,httpMethod:'POST'|'GET'='POST'){
 let response:WireResponse;try{response=await providerSend({url:'https://slack.com/api/'+method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json; charset=utf-8'},body:JSON.stringify(body)},httpMethod);}catch{throw new IntegrationError(503,'slack_response_unknown','Slack did not return a known result. Check Slack before trying again.');}
 let result;try{result=JSON.parse(response.body);}catch{throw new IntegrationError(503,'slack_invalid_response');}
 if(response.status<200||response.status>=300||result.ok!==true){const code=typeof result.error==='string'&&/^[a-z_]{1,80}$/.test(result.error)?result.error:'request_failed';throw new IntegrationError(400,'slack_'+code,'Slack: '+code);}
 return result as {ok:true;team?:string;channel?:{id:string;name:string}};
}
export function classifyProvider(kind:string,response:WireResponse):Outcome {
 if(response.headers['vector-channel-refusal']==='channel_safety_refused')return {kind:'rejected',code:'channel_safety_refused'};
 const {status}=response;
 if(status===429)return {kind:'retryable',code:'provider_rate_limited',status,retryAfterMs:Math.min(86400001,Math.max(0,Number(response.headers['retry-after']||60))*1000)};
 if(status>=500)return {kind:'uncertain',code:'provider_response_unknown',status};
 if(status<200||status>=300)return {kind:'rejected',code:status>=300&&status<400?'provider_redirect_refused':'provider_rejected',status};
 if(kind==='discord')return {kind:'accepted',code:'provider_accepted',status};
 try{const value=JSON.parse(response.body);return value.ok===true?{kind:'accepted',code:'provider_accepted',status}:{kind:'rejected',code:'slack_'+(typeof value.error==='string'&&/^[a-z_]{1,80}$/.test(value.error)?value.error:'rejected'),status};}catch{return {kind:'uncertain',code:'provider_response_unknown',status};}
}
