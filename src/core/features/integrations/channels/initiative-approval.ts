import {auditStatement} from '../../audit/producer';
import type {WorkerBindings} from '../../../app/bindings';
import {createUlid} from '../../../shared/ids';
import {matrix,roles,type Role,type RowId} from '../../roles/matrix';
import {settingsActor} from '../../settings/repository';
import {guardedSql,ownerPredicate,type IntegrationOwner} from '../authority';
import {IntegrationError} from '../errors';
import {openSecret} from '../secrets';
import {requireSlackChannel} from './channel-safety';
import type {approvalInput} from './schema';
import type {z} from 'zod';

/** Roles a role-matrix row admits at all; subject conditions are the feature's own. */
const admitted=(row:RowId)=>roles.filter(role=>matrix[row].cells[role]!=='no');
export const admits=(row:RowId,role:Role)=>admitted(row).includes(role);
const list=(row:RowId)=>admitted(row).map(role=>`'${role}'`).join(',');
/** Current editor authority: an active, unremoved operator whose role still holds the scoped row. */
export const editorSql=(operator:string,workspace:string)=>`EXISTS(SELECT 1 FROM operators eo JOIN vector_auth_operators em ON em.operator_id=eo.id JOIN oa_operators ea ON ea.id=em.auth_id AND ea.status='active' WHERE eo.id=${operator} AND eo.workspace_id=${workspace} AND eo.removed_at IS NULL AND eo.role IN(${list('channels.bind-initiative')}))`;
/** An approval is usable while its provider identity still holds: the connected Slack workspace,
 * or the Owner- or Admin-configured Discord destination whose sealed webhook it names. */
export const approvalUsable=(a:string)=>`(${a}.provider='slack' AND EXISTS(SELECT 1 FROM vector_slack_installations si WHERE si.workspace_id=${a}.workspace_id AND si.enabled=1 AND si.slack_team_id IS ${a}.provider_workspace)
 OR ${a}.provider='discord' AND EXISTS(SELECT 1 FROM vector_webhook_destinations src WHERE src.id=${a}.source_destination_id AND src.workspace_id=${a}.workspace_id AND src.kind='discord' AND src.enabled=1 AND src.revoked_at IS NULL))`;
/** ct 27 Oct: a scoped binding posts only while its own approval, approved identity and binder's editor authority hold.
 * A binding saved through the Settings door has no scoped row and keeps its existing rules. */
export const scopedBindingLive=(destination:string)=>`(NOT EXISTS(SELECT 1 FROM vector_initiative_scoped_bindings ss WHERE ss.destination_id=${destination}) OR EXISTS(SELECT 1 FROM vector_initiative_scoped_bindings ss
 JOIN vector_initiative_destination_approvals sa ON sa.id=ss.approval_id AND sa.workspace_id=ss.workspace_id AND sa.initiative_id=ss.initiative_id
 JOIN vector_initiative_channel_bindings sb ON sb.destination_id=ss.destination_id AND sb.workspace_id=ss.workspace_id AND sb.object_id=sa.initiative_id AND sb.channel_id=sa.channel_id
 JOIN vector_webhook_destinations sd ON sd.id=ss.destination_id AND sd.kind=sa.provider
 WHERE ss.destination_id=${destination} AND ${editorSql('ss.bound_by','ss.workspace_id')} AND ${approvalUsable('sa')}))`;

/** The Discord webhook identity an Owner- or Admin-configured destination already holds. */
export async function discordSource(env:WorkerBindings,workspace:string,destination:string){
 const row=await env.DB.prepare("SELECT d.name,k.encrypted FROM vector_webhook_destinations d JOIN vector_integration_secret_keys k ON k.identity='destination:'||d.id AND k.slot='current' WHERE d.id=? AND d.workspace_id=? AND d.kind='discord' AND d.enabled=1 AND d.revoked_at IS NULL AND NOT EXISTS(SELECT 1 FROM vector_initiative_scoped_bindings s WHERE s.destination_id=d.id)").bind(destination,workspace).first<{name:string;encrypted:string}>();
 if(!row)throw new IntegrationError(404,'destination_not_found','Choose an existing Discord destination configured in Settings.');
 const url=await openSecret(env,'destination:'+destination,row.encrypted),webhook=new URL(url).pathname.split('/')[3];
 if(!webhook||!/^\d{1,25}$/.test(webhook))throw new IntegrationError(409,'discord_needs_attention');
 return {name:row.name,url,webhook};
}
async function approver(env:WorkerBindings,actor:IntegrationOwner){
 const access=await settingsActor(env.DB,actor.id);
 if(!admits('integrations.manage',access.role))throw new IntegrationError(403,'forbidden');
}
const approverGuard=(actor:IntegrationOwner)=>({sql:`SELECT CASE WHEN EXISTS(SELECT 1 FROM operators WHERE id=? AND workspace_id=? AND removed_at IS NULL AND role IN(${list('integrations.manage')})) THEN 1 ELSE json('approver changed') END`,params:[actor.id,actor.workspace]});
export async function approveInitiativeDestination(env:WorkerBindings,actor:IntegrationOwner,input:z.infer<typeof approvalInput>){
 await approver(env,actor);
 if(!await env.DB.prepare('SELECT 1 FROM initiatives WHERE id=? AND workspace_id=?').bind(input.initiativeId,actor.workspace).first())throw new IntegrationError(404,'initiative_not_found');
 let identity:{providerWorkspace:string|null;channelId:string;channelName:string;source:string|null};
 if(input.provider==='slack'){
  const channel=await requireSlackChannel(env,actor.workspace,input.channelId);
  const team=await env.DB.prepare('SELECT slack_team_id FROM vector_slack_installations WHERE workspace_id=? AND enabled=1').bind(actor.workspace).first<{slack_team_id:string|null}>();
  if(!team)throw new IntegrationError(409,'slack_needs_attention');
  identity={providerWorkspace:team.slack_team_id,channelId:input.channelId,channelName:String(channel.name??input.channelId),source:null};
 }else{
  const source=await discordSource(env,actor.workspace,input.destinationId);
  identity={providerWorkspace:null,channelId:source.webhook,channelName:source.name,source:input.destinationId};
 }
 const id=createUlid(new Date()),at=new Date().toISOString();
 const result=await guardedSql(env.DB,ownerPredicate(actor)).batch([
  approverGuard(actor),
  {sql:`INSERT INTO vector_initiative_destination_approvals(id,workspace_id,initiative_id,provider,provider_workspace,channel_id,channel_name,source_destination_id,audience,approved_by,approved_at)
  SELECT ?,?,?,?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM initiatives WHERE id=? AND workspace_id=?) ON CONFLICT(workspace_id,initiative_id,provider,channel_id) DO UPDATE SET
  id=excluded.id,provider_workspace=excluded.provider_workspace,channel_name=excluded.channel_name,source_destination_id=excluded.source_destination_id,audience=excluded.audience,approved_by=excluded.approved_by,approved_at=excluded.approved_at
  WHERE NOT ${approvalUsable('vector_initiative_destination_approvals')} RETURNING id`,
  params:[id,actor.workspace,input.initiativeId,input.provider,identity.providerWorkspace,identity.channelId,identity.channelName,identity.source,input.audience,actor.id,at,input.initiativeId,actor.workspace]},
  auditStatement({workspace:actor.workspace,actor:actor.id,action:'channel.initiative_destination_approved',subject:input.initiativeId,at,condition:{sql:'changes()>0'}}),
 ]);
 return {approved:true,changed:result[1].length>0};
}
export async function withdrawInitiativeDestination(env:WorkerBindings,actor:IntegrationOwner,id:string){
 await approver(env,actor);
 const approval=await env.DB.prepare('SELECT initiative_id FROM vector_initiative_destination_approvals WHERE id=? AND workspace_id=?').bind(id,actor.workspace).first<string>('initiative_id');
 if(!approval)throw new IntegrationError(404,'approval_not_found','This approval was already withdrawn.');
 await guardedSql(env.DB,ownerPredicate(actor)).batch([
  approverGuard(actor),
  {sql:'DELETE FROM vector_initiative_destination_approvals WHERE id=? AND workspace_id=?',params:[id,actor.workspace]},
  auditStatement({workspace:actor.workspace,actor:actor.id,action:'channel.initiative_destination_withdrawn',subject:approval}),
 ]);
 return {withdrawn:true};
}
/** Settings lists every approval; a withdrawn approval is deleted, so a fresh one has a new identity. */
export async function initiativeApprovals(db:D1Database,workspace:string){
 return (await db.prepare(`SELECT a.id,a.initiative_id initiativeId,n.name initiativeName,a.provider,a.channel_id channelId,a.channel_name channelName,a.audience,a.provider_workspace approvedWorkspace,(SELECT team_name FROM vector_slack_installations WHERE workspace_id=a.workspace_id) currentWorkspace,${approvalUsable('a')} usable FROM vector_initiative_destination_approvals a JOIN initiatives n ON n.id=a.initiative_id WHERE a.workspace_id=? ORDER BY n.name,a.channel_name,a.id`).bind(workspace).all<{id:string;initiativeId:string;initiativeName:string;provider:'slack'|'discord';channelId:string;channelName:string;audience:'workspace';usable:number;approvedWorkspace:string|null;currentWorkspace:string|null}>()).results.map(row=>({...row,usable:Boolean(row.usable),notPosting:row.usable?null:{code:row.provider==='slack'?'workspace_changed' as const:'approval_withdrawn' as const,approvedWorkspace:row.approvedWorkspace,currentWorkspace:row.currentWorkspace,binderName:null}}));
}

/** Explain a scoped refusal without treating valid credentials as broken. Posting authority stays in scopedBindingLive. */
export async function bindingNotPosting(db:D1Database,destination:string){
 const row=await db.prepare(`SELECT s.approval_id,o.name binderName,a.provider_workspace approvedWorkspace,
 si.team_name currentWorkspace,${editorSql('s.bound_by','s.workspace_id')} editor,
 ${scopedBindingLive('s.destination_id')} live,a.id approvalId,a.provider,
 ${approvalUsable('a')} usable,
 EXISTS(SELECT 1 FROM vector_initiative_destination_approvals fresh WHERE fresh.workspace_id=s.workspace_id AND fresh.initiative_id=s.initiative_id AND fresh.provider=d.kind AND fresh.channel_id=b.channel_id AND ${approvalUsable('fresh')}) approvedAgain
 FROM vector_initiative_scoped_bindings s JOIN vector_initiative_channel_bindings b ON b.destination_id=s.destination_id
 JOIN vector_webhook_destinations d ON d.id=s.destination_id
 LEFT JOIN vector_initiative_destination_approvals a ON a.id=s.approval_id
 LEFT JOIN operators o ON o.id=s.bound_by LEFT JOIN vector_slack_installations si ON si.workspace_id=s.workspace_id
 WHERE s.destination_id=?`).bind(destination).first<{binderName:string|null;approvedWorkspace:string|null;currentWorkspace:string|null;editor:number;live:number;approvalId:string|null;provider:string|null;usable:number;approvedAgain:number}>();
 if(!row||row.live)return null;
 const code=row.approvalId&&row.provider==='slack'&&!row.usable?'workspace_changed' as const:!row.editor?'binder_cannot_edit' as const:row.approvedAgain?'approved_again' as const:'approval_withdrawn' as const;
 return {code,binderName:row.binderName,approvedWorkspace:row.approvedWorkspace,currentWorkspace:row.currentWorkspace};
}
