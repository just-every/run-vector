import { matrix, opensSettingsPage, type Cell, type Role, type RowId, type SettingsPage } from './matrix'

export type TeamPermission = 'team_owners' | 'all_members'
/** The actor's standing in one subject team (ROLE-007, ROLE-009). */
export type TeamStanding = { role: 'owner' | 'member' | null; settings: TeamPermission; planning: TeamPermission }
export type Authority = { role: Role; memberInvites: boolean; teams: ReadonlyMap<string, TeamStanding> }
/** What a door asks: its row (null for a door with no row), the Settings page
 * it opens, whether it is an invitation, and the teams it acts on in the
 * actor's workspace: undefined when the door names none, null when its subject
 * is not in the workspace at all (the handler answers that, writing nothing). */
export type Question = { row: RowId | null; page?: SettingsPage; teams?: readonly string[] | null; invitation?: boolean }
export type Decision = 'allow' | 'forbidden' | 'hidden'

/** ROLE-001: the matrix decides. Where a Guest may act only in invited teams,
 * a team they were not added to is answered as if it were absent (ROLE-003). */
export function decide(actor: Authority, question: Question): Decision {
  const { teams } = question
  if (question.row === null) return question.page ? (opensSettingsPage(actor.role, question.page) ? 'allow' : 'forbidden') : actor.role === 'owner' ? 'allow' : 'forbidden'
  const cell = matrix[question.row].cells[actor.role]
  if (teamCells.includes(cell) && teams !== undefined && teams !== null) {
    const every = (test: (standing: TeamStanding | undefined) => boolean) => teams.length > 0 && teams.every(team => test(actor.teams.get(team)))
    if (cell === 'invited-teams') return every(standing => !!standing?.role) ? 'allow' : 'hidden'
    if (cell === 'team-owner') return every(standing => standing?.role === 'owner') ? 'allow' : 'forbidden'
    return every(standing => manages(standing, cell === 'team-setting' ? 'settings' : 'planning')) ? 'allow' : 'forbidden'
  }
  if (teamCells.includes(cell)) return teams === null ? 'allow' : 'forbidden'
  if (cell === 'member-invites') return question.invitation === true && actor.memberInvites ? 'allow' : 'forbidden'
  return cell === 'no' ? 'forbidden' : 'allow'
}
const teamCells: Cell[] = ['invited-teams', 'team-owner', 'team-setting', 'planning-setting']
const manages = (standing: TeamStanding | undefined, permission: 'settings' | 'planning') =>
  standing?.role === 'owner' || (standing?.role === 'member' && standing[permission] === 'all_members')

/** Which inputs a decision read, so the write transaction can require them unchanged. */
export function decisionInputs(actor: Authority, question: Question) {
  const cell = question.row === null ? null : matrix[question.row].cells[actor.role]
  return {
    memberInvites: cell === 'member-invites',
    teams: cell !== null && teamCells.includes(cell) ? question.teams ?? [] : [],
  }
}
