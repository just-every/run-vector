import { loadAuthority, authorityFence } from '../roles/authority'
import { decide, decisionInputs } from '../roles/policy'
import { SettingsError } from '../settings/repository'

export async function formAuthority(db: D1Database, actor: string, teamId: string, manage = false) {
  const visible = await db.prepare('SELECT id FROM teams WHERE id=? AND archived_at IS NULL').bind(teamId).first()
  if (!visible) throw new SettingsError('not_found', 'Team is unavailable.', 404)
  const authority = await loadAuthority(db, actor, [teamId])
  const question = { row: manage ? 'request-forms.manage' as const : 'intake.create' as const, teams: [teamId] }
  if (!authority || decide(authority, question) !== 'allow') throw new SettingsError('forbidden', 'Your current role cannot change this form.', 403)
  return authorityFence(actor, authority, decisionInputs(authority, question))
}
