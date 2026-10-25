import {z} from 'zod';
import type {WorkerBindings} from '../../../app/bindings';
import type {IntegrationOwner} from '../authority';
import {managed} from './install';
import {IntegrationError} from '../errors';
import {auditStatement} from '../../audit/producer';
export const memberMapping=z.object({operatorId:z.string().regex(/^[0-9A-HJKMNP-TV-Z]{26}$/),slackTeamId:z.string().regex(/^[TE][A-Z0-9]{2,30}$/),slackUserId:z.string().regex(/^[UW][A-Z0-9]{2,30}$/)}).strict();
export async function readMembers(env:WorkerBindings,owner:IntegrationOwner){
 const [members,mappings]=await managed(env,owner).batch([
  {sql:"SELECT o.id,o.name FROM operators o JOIN vector_auth_operators m ON m.operator_id=o.id JOIN oa_operators a ON a.id=m.auth_id AND a.status='active' WHERE o.workspace_id=? AND o.removed_at IS NULL AND (o.role IN ('member','guest') OR o.id=?) ORDER BY o.name,o.id",params:[owner.workspace,owner.id]},
  {sql:'SELECT l.operator_id operatorId,o.name,l.slack_team_id slackTeamId,l.slack_user_id slackUserId FROM vector_slack_member_links l JOIN operators o ON o.id=l.operator_id WHERE l.workspace_id=? ORDER BY o.name,o.id',params:[owner.workspace]},
 ]);
 return {members,mappings};
}
export async function mapMember(env:WorkerBindings,owner:IntegrationOwner,input:z.infer<typeof memberMapping>){
 const valid="EXISTS(SELECT 1 FROM operators o JOIN vector_auth_operators m ON m.operator_id=o.id JOIN oa_operators a ON a.id=m.auth_id AND a.status='active' WHERE o.id=? AND o.workspace_id=? AND o.removed_at IS NULL AND (o.role IN ('member','guest') OR o.id=?))";
 const params=[input.operatorId,owner.workspace,owner.id];
 if(!await env.DB.prepare('SELECT '+valid+' AS valid').bind(...params).first<number>('valid'))throw new IntegrationError(403,'slack_mapping_target_forbidden','Map an active Member or Guest, or your own account.');
 if(await env.DB.prepare('SELECT 1 FROM vector_slack_member_links WHERE workspace_id=? AND slack_team_id=? AND slack_user_id=? AND operator_id<>?').bind(owner.workspace,input.slackTeamId,input.slackUserId,input.operatorId).first())throw new IntegrationError(409,'slack_account_linked');
 const at=new Date().toISOString();
 await managed(env,owner).batch([
  {sql:"SELECT CASE WHEN "+valid+" AND EXISTS(SELECT 1 FROM vector_slack_installations WHERE workspace_id=? AND enabled=1) THEN 1 ELSE json('Slack mapping unavailable') END",params:[...params,owner.workspace]},
  {sql:"INSERT INTO vector_slack_member_links(operator_id,workspace_id,slack_team_id,slack_user_id,slack_name,dm_kinds,linked_at) VALUES(?,?,?,?,?,'[]',?) ON CONFLICT(operator_id) DO UPDATE SET slack_team_id=excluded.slack_team_id,slack_user_id=excluded.slack_user_id,slack_name=excluded.slack_name,linked_at=excluded.linked_at",params:[input.operatorId,owner.workspace,input.slackTeamId,input.slackUserId,input.slackUserId,at]},
  auditStatement({workspace:owner.workspace,actor:owner.id,action:'slack.member_mapped',subject:input.operatorId,at}),
 ]);
 return {saved:true};
}
export async function removeMember(env:WorkerBindings,owner:IntegrationOwner,operatorId:string){
 await managed(env,owner).batch([
  auditStatement({workspace:owner.workspace,actor:owner.id,action:'slack.member_unmapped',subject:operatorId,condition:{sql:'EXISTS(SELECT 1 FROM vector_slack_member_links WHERE operator_id=? AND workspace_id=?)',params:[operatorId,owner.workspace]}}),
  {sql:'DELETE FROM vector_slack_member_links WHERE operator_id=? AND workspace_id=?',params:[operatorId,owner.workspace]},
 ]);
 return {removed:true};
}
