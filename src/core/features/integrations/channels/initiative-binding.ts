import {auditStatement} from '../../audit/producer';
import type {WorkerBindings} from '../../../app/bindings';
import {settingsActor} from '../../settings/repository';
import {guardedSql,ownerPredicate,type IntegrationOwner} from '../authority';
import {IntegrationError} from '../errors';
import {bindingWrites} from './settings';
import {admits,approvalUsable,bindingNotPosting,discordSource,editorSql,scopedBindingLive} from './initiative-approval';
import type {initiativeBindingInput} from './schema';
import type {z} from 'zod';

/** The scoped initiative capability (ct 27 Oct, INIT-001): this initiative's binding only,
 * to a destination an Owner or Admin approved for it. The binding version is its destination. */
const current=`SELECT b.destination_id id,d.kind provider,b.channel_id channelId,b.channel_name channelName,b.events FROM vector_initiative_channel_bindings b
 JOIN vector_webhook_destinations d ON d.id=b.destination_id AND d.revoked_at IS NULL WHERE b.workspace_id=? AND b.object_id=?`;
const versionGuard=(workspace:string,initiative:string,version:string|null)=>({sql:`SELECT CASE WHEN (SELECT b.destination_id FROM vector_initiative_channel_bindings b
 JOIN vector_webhook_destinations d ON d.id=b.destination_id AND d.revoked_at IS NULL WHERE b.workspace_id=? AND b.object_id=?) IS ? THEN 1 ELSE json('initiative binding changed') END`,params:[workspace,initiative,version]});
const editorGuard=(actor:IntegrationOwner,initiative:string)=>({sql:`SELECT CASE WHEN ${editorSql('?','?')} AND EXISTS(SELECT 1 FROM initiatives WHERE id=? AND workspace_id=?) THEN 1 ELSE json('initiative editor changed') END`,params:[actor.id,actor.workspace,initiative,actor.workspace]});
type Current={id:string;provider:'slack'|'discord';channelId:string;channelName:string;events:string};

async function editable(env:WorkerBindings,actor:IntegrationOwner,initiative:string){
 const access=await settingsActor(env.DB,actor.id);
 if(!admits('channels.bind-initiative',access.role))throw new IntegrationError(403,'forbidden');
 if(!await env.DB.prepare('SELECT 1 FROM initiatives WHERE id=? AND workspace_id=?').bind(initiative,actor.workspace).first())throw new IntegrationError(404,'initiative_not_found');
 return env.DB.prepare(current).bind(actor.workspace,initiative).first<Current>();
}
export async function readInitiativeBinding(env:WorkerBindings,actor:IntegrationOwner,initiative:string){
 const binding=await editable(env,actor,initiative);
 const destinations=(await env.DB.prepare(`SELECT a.provider,a.channel_id channelId,a.channel_name channelName FROM vector_initiative_destination_approvals a
 WHERE a.workspace_id=? AND a.initiative_id=? AND ${approvalUsable('a')} ORDER BY a.channel_name,a.provider,a.channel_id`).bind(actor.workspace,initiative).all<{provider:'slack'|'discord';channelId:string;channelName:string}>()).results;
 const live=binding?Boolean(await env.DB.prepare('SELECT 1 AS live WHERE '+scopedBindingLive('?')).bind(binding.id,binding.id).first()):false;
 return {canManage:admits('integrations.manage',(await settingsActor(env.DB,actor.id)).role),destinations,binding:binding?{...binding,events:JSON.parse(binding.events) as string[],live,notPosting:await bindingNotPosting(env.DB,binding.id)}:null,version:binding?.id??null};
}
export async function saveInitiativeBinding(env:WorkerBindings,actor:IntegrationOwner,initiative:string,input:z.infer<typeof initiativeBindingInput>){
 const binding=await editable(env,actor,initiative);
 if((binding?.id??null)!==input.expectedVersion)throw new IntegrationError(409,'stale_initiative_binding','This initiative’s channel changed. Reload before saving.');
 // Identity is the provider and immutable channel ID; a display name never selects an approval.
 const approval=await env.DB.prepare(`SELECT a.id,a.channel_name channelName,a.source_destination_id source FROM vector_initiative_destination_approvals a
 WHERE a.workspace_id=? AND a.initiative_id=? AND a.provider=? AND a.channel_id=? AND ${approvalUsable('a')}`).bind(actor.workspace,initiative,input.provider,input.channelId).first<{id:string;channelName:string;source:string|null}>();
 if(!approval)throw new IntegrationError(403,'destination_not_approved','Choose a channel an Owner or Admin approved for this initiative.');
 const discord=approval.source?await discordSource(env,actor.workspace,approval.source):null;
 if(discord&&discord.webhook!==input.channelId)throw new IntegrationError(409,'destination_changed');
 const draft=await bindingWrites(env,actor,{scope:'initiative',objectId:initiative,provider:input.provider,channelId:input.channelId,channelName:approval.channelName,webhookUrl:discord?.url,events:input.events});
 await guardedSql(env.DB,ownerPredicate(actor)).batch([
  editorGuard(actor,initiative),
  {sql:`SELECT CASE WHEN EXISTS(SELECT 1 FROM vector_initiative_destination_approvals a WHERE a.id=? AND a.workspace_id=? AND a.initiative_id=? AND a.provider=? AND a.channel_id=? AND ${approvalUsable('a')}) THEN 1 ELSE json('initiative approval changed') END`,params:[approval.id,actor.workspace,initiative,input.provider,input.channelId]},
  versionGuard(actor.workspace,initiative,input.expectedVersion),
  ...draft.writes,
  {sql:'INSERT INTO vector_initiative_scoped_bindings(destination_id,workspace_id,initiative_id,approval_id,bound_by) VALUES(?,?,?,?,?)',params:[draft.id,actor.workspace,initiative,approval.id,actor.id]},
 ]);
 return {id:draft.id,version:draft.id};
}
export async function withdrawInitiativeBinding(env:WorkerBindings,actor:IntegrationOwner,initiative:string,expectedVersion:string){
 const binding=await editable(env,actor,initiative);
 if(!binding||binding.id!==expectedVersion)throw new IntegrationError(409,'stale_initiative_binding','This initiative’s channel changed. Reload before withdrawing.');
 const at=new Date().toISOString();
 await guardedSql(env.DB,ownerPredicate(actor)).batch([
  editorGuard(actor,initiative),
  versionGuard(actor.workspace,initiative,expectedVersion),
  {sql:'UPDATE vector_webhook_destinations SET enabled=0,revoked_at=COALESCE(revoked_at,?) WHERE id=? AND workspace_id=?',params:[at,binding.id,actor.workspace]},
  {sql:'DELETE FROM vector_integration_secret_keys WHERE identity=?',params:['destination:'+binding.id]},
  {sql:'DELETE FROM vector_initiative_channel_bindings WHERE destination_id=? AND workspace_id=? AND object_id=?',params:[binding.id,actor.workspace,initiative]},
  auditStatement({workspace:actor.workspace,actor:actor.id,action:'channel.unbound',subject:binding.id,at}),
 ]);
 return {removed:true,version:null};
}
