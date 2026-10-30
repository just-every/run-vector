import { ToolRefusal, type ToolContext } from '../../../../vendor/base/agent-door/index.ts';
import { actionAuthority } from '../roles/enforcement';
import { visibilityDatabase } from '../roles/visibility-database';
import { mutationDatabase } from '../auth/mutation-database';
import { requireIssueAccess } from '../issues/access';
import { tokenPredicate } from '../integrations/tokens';

/** The UI's registered role-matrix decision and its transaction fence. */
export async function nativeDatabase(ctx: ToolContext, method: 'GET'|'POST'|'PATCH', path: string, params: Record<string,string>, body: unknown) {
  const admitted=await actionAuthority(ctx.db,ctx.person.id,method,path,params,body);
  if(admitted.decision!=='allow') throw new ToolRefusal(admitted.decision==='hidden'?'not_found':'forbidden');
  const state=await ctx.db.prepare('SELECT envelope,local_document,local_revision FROM agent_door_state WHERE id=1').first<{envelope:string|null;local_document:string|null;local_revision:number}>();
  const business=ctx.consent?await ctx.db.prepare('SELECT token FROM bs_settings WHERE singleton=1 AND stopped=0').first<{token:string}>():null;
  const tokenId=ctx.clientId?.startsWith('vector-token:')?ctx.clientId.slice('vector-token:'.length):null;
  const token=tokenId?await ctx.db.prepare('SELECT namespace,workspace_id AS workspace FROM vector_integration_tokens WHERE token_id=? AND operator_id=?').bind(tokenId,ctx.person.id).first<{namespace:string;workspace:string}>():null;
  if(tokenId&&!token)throw new ToolRefusal('insufficient_scope');
  const predicate=token&&tokenId?tokenPredicate({id:ctx.person.id,namespace:token.namespace,workspace:token.workspace,tokenId,scopes:ctx.scopes}):null;
  const access={sql:`EXISTS(SELECT 1 FROM vector_auth_operators m JOIN oa_operators a ON a.id=m.auth_id
      WHERE m.operator_id=? AND a.status='active' AND (NOT EXISTS(SELECT 1 FROM vector_restore_status)
        OR EXISTS(SELECT 1 FROM vector_restore_operator_grants WHERE auth_id=a.id)))
    AND EXISTS(SELECT 1 FROM agent_door_agents WHERE id=? AND sponsor=? AND revoked=0)
    AND EXISTS(SELECT 1 FROM agent_door_state WHERE id=1 AND local_paused=0 AND envelope IS ? AND local_document IS ? AND local_revision=?
      AND (envelope IS NULL OR (json_extract(envelope,'$.paused')=0 AND json_extract(envelope,'$.exp')>unixepoch()
        AND NOT EXISTS(SELECT 1 FROM json_each(envelope,'$.revoked.agents') WHERE value=?)
        AND NOT EXISTS(SELECT 1 FROM json_each(envelope,'$.revoked.consents') WHERE value=?))))
    AND (? IS NULL OR EXISTS(SELECT 1 FROM bs_settings WHERE singleton=1 AND stopped=0 AND token IS ?))${predicate?' AND ('+predicate.sql+')':''}`,
    values:[ctx.person.id,ctx.agent.id,ctx.person.id,state?.envelope??null,state?.local_document??null,state?.local_revision??0,ctx.agent.id,ctx.consent??null,ctx.consent??null,business?.token??null,...(predicate?.params??[])] as (string|number|null)[]};
  return mutationDatabase(visibilityDatabase(ctx.db,ctx.person.id),ctx.person.id,undefined,access,admitted.fence);
}
export async function nativeIssue(ctx: ToolContext, identifier: string) {
  try { return await requireIssueAccess(visibilityDatabase(ctx.db,ctx.person.id),identifier,ctx.person.id); }
  catch { throw new ToolRefusal('not_found'); }
}
export async function nativeResult<T>(run:()=>Promise<T>):Promise<T> {
  try { return await run(); }
  catch(error) {
    if(error instanceof ToolRefusal) throw error;
    if(error && typeof error==='object' && 'code' in error && typeof error.code==='string') throw new ToolRefusal(error.code);
    throw error;
  }
}
export const standard = () => [{class:'standard' as const,facts:{measure:1}}];
export const issueUri = (id:string) => `vector://issue/${id}`;
