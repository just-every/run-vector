import { loadAuthority, authorityFence } from '../roles/authority'
import { decide, decisionInputs, type Question } from '../roles/policy'
import { SettingsError } from '../settings/repository'
import { guard } from '../administration/transaction'

export async function recurringFence(db:D1Database,actor:string,teamId:string) {
  const authority=await loadAuthority(db,actor,[teamId])
  const question:Question={row:'recurring.manage',teams:[teamId]}
  if(!authority||decide(authority,question)!=='allow')throw new SettingsError('forbidden','Your current role cannot configure this recurring issue.',403)
  if(!await db.prepare('SELECT 1 FROM teams WHERE id=? AND workspace_id=? AND archived_at IS NULL').bind(teamId,authority.workspace!).first())
    throw new SettingsError('not_found','Team is unavailable.',404)
  const fence=authorityFence(actor,authority,decisionInputs(authority,question))
  return {...fence,sql:fence.sql+` AND EXISTS(SELECT 1 FROM vector_auth_operators m JOIN oa_operators a ON a.id=m.auth_id WHERE m.operator_id=? AND a.status='active')`,
    values:[...fence.values,actor]}
}
export const effectsAllowed=`NOT EXISTS(SELECT 1 FROM vector_http_restore)
  AND NOT EXISTS(SELECT 1 FROM vector_restore_status WHERE effects_held=1)
  AND NOT EXISTS(SELECT 1 FROM rer_portability_state WHERE applying=1)`
export function seriesGuard(db:D1Database,row:{id:string;version:number;next_on:string}) {
  return guard(db,`EXISTS(SELECT 1 FROM recurring_issue_series s JOIN recurring_issue_activations a ON a.series_id=s.id
    WHERE s.id=? AND s.version=? AND s.next_on=? AND s.state='enabled')`+' AND '+effectsAllowed,row.id,row.version,row.next_on)
}
