import type {WorkerBindings} from '../../../app/bindings';
import {settingsActor} from '../../settings/repository';
import {guardedSql,ownerPredicate,type IntegrationOwner} from '../authority';
import {IntegrationError} from '../errors';
import {bindingWrites} from './settings';
import {requireSlackChannel} from './channel-safety';

const approved = `SELECT a.channel_id channelId,a.channel_name channelName FROM vector_slack_allowed_channels a WHERE a.workspace_id=?
 UNION SELECT b.channel_id,b.channel_name FROM vector_channel_bindings b
 JOIN vector_webhook_destinations d ON d.id=b.destination_id AND d.kind='slack' AND d.enabled=1 AND d.revoked_at IS NULL
 JOIN operators o ON o.id=b.created_by AND o.role IN ('owner','admin') AND o.removed_at IS NULL
 WHERE b.workspace_id=? AND b.suspended_reason IS NULL`;
export async function approvedProjectChannels(env:WorkerBindings,actor:IntegrationOwner,projectId:string){
 const access=await settingsActor(env.DB,actor.id);
 if(access.role==='guest')throw new IntegrationError(403,'forbidden');
 if(!await env.DB.prepare('SELECT 1 FROM projects WHERE id=? AND workspace_id=?').bind(projectId,actor.workspace).first())throw new IntegrationError(404,'not_found');
 const channels=(await env.DB.prepare(`SELECT channelId,MIN(channelName) channelName FROM (${approved}) GROUP BY channelId ORDER BY channelName,channelId`).bind(actor.workspace,actor.workspace).all<{channelId:string;channelName:string}>()).results;
 const current=await env.DB.prepare(`SELECT b.channel_id channelId,b.channel_name channelName FROM vector_channel_bindings b
 JOIN vector_webhook_destinations d ON d.id=b.destination_id AND d.kind='slack' AND d.revoked_at IS NULL
 WHERE b.workspace_id=? AND b.scope='project' AND b.object_id=?`).bind(actor.workspace,projectId).first();
 return {channels,current};
}
export async function bindProjectChannel(env:WorkerBindings,actor:IntegrationOwner,projectId:string,channelId:string){
 const {channels}=await approvedProjectChannels(env,actor,projectId);
 const selected=channels.find(channel=>channel.channelId===channelId);
 // Check local approval before even asking Slack about an arbitrary channel.
 if(!selected)throw new IntegrationError(403,'slack_channel_not_allowed','Choose a channel an Owner or Admin already bound or allowed.');
 const draft=await bindingWrites(env,actor,{scope:'project',objectId:projectId,provider:'slack',channelId,channelName:selected.channelName,events:['triage.created','issue.created','issue.status_changed']});
 const predicate=ownerPredicate(actor);
 await guardedSql(env.DB,predicate).batch([
  {sql:`SELECT CASE WHEN EXISTS(SELECT 1 FROM (${approved}) WHERE channelId=?) THEN 1 ELSE json('channel approval changed') END`,params:[actor.workspace,actor.workspace,channelId]},
  ...draft.writes,
 ]);
 return {id:draft.id};
}
export async function allowProjectChannel(env:WorkerBindings,actor:IntegrationOwner,channelId:string,channelName:string){
 const access=await settingsActor(env.DB,actor.id);
 if(!['owner','admin'].includes(access.role))throw new IntegrationError(403,'forbidden');
 await requireSlackChannel(env,actor.workspace,channelId);
 await guardedSql(env.DB,ownerPredicate(actor)).batch([
  {sql:`INSERT INTO vector_slack_allowed_channels(workspace_id,channel_id,channel_name,created_by,created_at) VALUES(?,?,?,?,?)
  ON CONFLICT(workspace_id,channel_id) DO UPDATE SET channel_name=excluded.channel_name,created_by=excluded.created_by,created_at=excluded.created_at`,params:[actor.workspace,channelId,channelName,actor.id,new Date().toISOString()]},
 ]);
 return {allowed:true};
}
export async function revokeProjectChannel(env:WorkerBindings,actor:IntegrationOwner,channelId:string){
 await guardedSql(env.DB,ownerPredicate(actor)).batch([{sql:'DELETE FROM vector_slack_allowed_channels WHERE workspace_id=? AND channel_id=?',params:[actor.workspace,channelId]}]);
 return {removed:true};
}
