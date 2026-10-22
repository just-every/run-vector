import type { NativeAccessFence } from '../auth/mutation-database'
import type { Role } from './matrix'
import type { Authority, TeamStanding } from './policy'

/** The actor's role, read from the stored record on every request and never
 * carried in a session or token, so a change applies to the next request. */
export async function loadAuthority(db: D1Database, actor: string, teams: readonly string[]): Promise<Authority | null> {
  const row = await db.prepare(`SELECT o.role,w.member_invites AS memberInvites FROM operators o
    JOIN workspace_settings w ON w.id=o.workspace_id WHERE o.id=? AND o.removed_at IS NULL`)
    .bind(actor).first<{ role: Role; memberInvites: number }>()
  if (!row) return null
  const standing: TeamStanding = { role: null, settings: 'team_owners', planning: 'all_members' }
  return { role: row.role, memberInvites: row.memberInvites === 1, teams: new Map(teams.map(team => [team, standing])) }
}

/** The same inputs, required unchanged inside every write of the request: a
 * role or setting changed meanwhile refuses the whole transaction. */
export function authorityFence(actor: string, authority: Authority, inputs: { memberInvites: boolean; teams: readonly string[] }): NativeAccessFence {
  const clauses = ['EXISTS(SELECT 1 FROM operators WHERE id=? AND removed_at IS NULL AND role=?)']
  const values: (string | number | null)[] = [actor, authority.role]
  if (inputs.memberInvites) {
    clauses.push('EXISTS(SELECT 1 FROM operators o JOIN workspace_settings w ON w.id=o.workspace_id WHERE o.id=? AND w.member_invites=1)')
    values.push(actor)
  }
  return { sql: clauses.join(' AND '), values }
}
