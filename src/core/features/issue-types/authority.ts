import { loadAuthority, authorityFence } from '../roles/authority'
import { decide, decisionInputs, type Question } from '../roles/policy'
import { SettingsError } from '../settings/repository'

/** ROLE-008: no matrix row means Owner-only, including team owners and Admins. */
export async function typeManagementFence(db: D1Database, actor: string, teamId: string) {
 const authority = await loadAuthority(db, actor, [teamId])
 const question: Question = { row: null, teams: [teamId] }
 if (!authority || decide(authority, question) !== 'allow')
  throw new SettingsError('forbidden', 'Only a workspace Owner can manage issue types.', 403)
 return authorityFence(actor, authority, decisionInputs(authority, question))
}
