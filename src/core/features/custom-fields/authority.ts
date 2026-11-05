import { loadAuthority, authorityFence } from '../roles/authority'
import { decide, decisionInputs, type Question } from '../roles/policy'
import { SettingsError } from '../settings/repository'

/** FIELD-001: a team's fields follow the role matrix's "team setting" row
 * (ROLE-001, ROLE-009), decided on the actor's current record. The returned
 * fence requires the same role and team permission inside the write. */
export async function fieldManagementFence(db: D1Database, actor: string, teamId: string) {
  const authority = await loadAuthority(db, actor, [teamId])
  const question: Question = { row: 'custom-fields.team', teams: [teamId] }
  if (!authority || decide(authority, question) !== 'allow')
    throw new SettingsError('forbidden', 'Your current role cannot change this team’s fields.', 403)
  return authorityFence(actor, authority, decisionInputs(authority, question))
}
