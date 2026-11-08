import type {WorkerBindings} from '../../../app/bindings';
import {slackCall,slackToken} from '../channels/provider';
import {IntegrationError} from '../errors';
/** Slack owns the canonical workspace permalink. Never infer a workspace host
 * or retain a provider-returned URL with credentials or another destination. */
export async function slackPermalink(env:WorkerBindings,workspace:string,channel:string,ts:string,threadTs=ts){
 const response=await slackCall(await slackToken(env,workspace),'chat.getPermalink',{channel,message_ts:ts},'GET') as {ok:true;permalink?:unknown};
 if(typeof response.permalink!=='string')throw new IntegrationError(503,'slack_permalink_unavailable');
 let url:URL;try{url=new URL(response.permalink);}catch{throw new IntegrationError(503,'slack_permalink_unavailable');}
 if(url.protocol!=='https:'||!url.hostname.endsWith('.slack.com')||url.username||url.password||url.port||url.hash||url.pathname!=='/archives/'+channel+'/p'+ts.replace('.',''))throw new IntegrationError(503,'slack_permalink_unavailable');
 const keys=[...url.searchParams.keys()];
 if(new Set(keys).size!==keys.length||keys.some(key=>key!=='thread_ts'&&key!=='cid')||url.searchParams.has('thread_ts')&&url.searchParams.get('thread_ts')!==threadTs||url.searchParams.has('cid')&&url.searchParams.get('cid')!==channel)throw new IntegrationError(503,'slack_permalink_unavailable');
 return url.href;
}
