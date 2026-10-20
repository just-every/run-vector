import type {WorkerBindings} from '../../../app/bindings';
import {IntegrationError} from '../errors';
import {slackCall,slackToken} from './provider';
const falseFlags=['is_archived','is_shared','is_ext_shared','is_org_shared','is_pending_ext_shared'] as const;
/** ct 20 Oct 19:12: only is_frozen may be absent; every other safety flag is explicit. */
export async function requireSlackChannel(env:WorkerBindings,workspace:string,channelId:string){
 const result=await slackCall(await slackToken(env,workspace),'conversations.info',{channel:channelId},'GET');
 const channel=result.channel as unknown as Record<string,unknown>|undefined;
 if(!channel||channel.id!==channelId||channel.is_member!==true||channel.is_channel!==true||falseFlags.some(flag=>channel[flag]!==false)||(channel.is_frozen!==undefined&&channel.is_frozen!==false))throw new IntegrationError(409,'slack_channel_unsafe','Choose an active Slack channel that the bot belongs to and that is not shared outside this workspace.');
 return channel;
}
export async function suspendChannel(env:WorkerBindings,workspace:string,id:string,reason:string){
 await env.DB.batch([
  env.DB.prepare('UPDATE vector_channel_bindings SET suspended_reason=? WHERE destination_id=? AND workspace_id=?').bind(reason,id,workspace),
  env.DB.prepare("UPDATE vector_webhook_destinations SET enabled=0 WHERE id=? AND workspace_id=? AND kind='slack' AND revoked_at IS NULL").bind(id,workspace),
 ]);
}
export async function checkBoundChannel(env:WorkerBindings,workspace:string,id:string,channelId:string){
 try{await requireSlackChannel(env,workspace,channelId);}catch(error){
  if(error instanceof IntegrationError&&['slack_channel_unsafe','slack_is_archived','slack_channel_is_archived','slack_channel_is_frozen','slack_frozen_channel','slack_not_in_channel','slack_channel_not_found'].includes(error.code))await suspendChannel(env,workspace,id,error.code);
  throw error;
 }
}
export const suspendedSlackResponses=new Set(['is_archived','channel_is_archived','channel_is_frozen','frozen_channel','not_in_channel','channel_not_found']);
