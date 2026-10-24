import { administrationContext, audit, commit, guard, SettingsError } from '../administration/transaction'
import { assignableRoles, type AssignableRole } from '../roles/matrix'

export const assignable = (role: string): role is AssignableRole => (assignableRoles as readonly string[]).includes(role)
/** Pending links an operator issued for a role they can no longer grant stop
 * admitting anyone; acceptance rechecks the rest (Base's invite policy). */
export function revokeUngrantableInvitations(db: D1Database, operator: string, role: string, at: number) {
  return db.prepare(`UPDATE oa_tokens SET revoked_at=? WHERE kind='invite' AND consumed_at IS NULL AND revoked_at IS NULL
    AND issuer_id IN (SELECT auth_id FROM vector_auth_operators WHERE operator_id=?)
    AND id IN (SELECT token_id FROM vector_invitation_roles grant_role WHERE NOT (
      ?='owner' OR ?='admin' AND grant_role.role IN('member','guest','viewer') OR ?='member' AND grant_role.role='member'
      AND EXISTS(SELECT 1 FROM operators o JOIN workspace_settings w ON w.id=o.workspace_id WHERE o.id=? AND w.member_invites=1)))
    `).bind(at,operator,role,role,role,operator)
}

/** ROLE-001: one audited role change, effective on the member's next request.
 * The database keeps the last Owner and the installation owner Owners. */
export async function changeRole(source: D1Database, actor: string, target: string, role: string, teams?: string[]) {
  if (!assignable(role)) throw new SettingsError('invalid_role', 'Choose Owner, Admin, Member, Guest or Viewer.', 400)
  const ctx = await administrationContext(source, actor)
  const member = await ctx.db.prepare('SELECT id,name,role FROM operators WHERE id=? AND workspace_id=? AND removed_at IS NULL')
    .bind(target, ctx.workspace).first<{ id: string; name: string; role: string }>()
  if (!member) throw new SettingsError('not_found', 'Member is unavailable.', 404)
  const assigned = role === 'guest' || role === 'viewer'
  const selectedTeams = assigned ? await guestTeams(ctx.db, ctx.workspace, teams, role === 'guest') : []
  const previousTeams=(await ctx.db.prepare('SELECT team_id AS id,role FROM main.team_members WHERE operator_id=? ORDER BY team_id').bind(target).all<{id:string;role:string}>()).results
  if (member.role === role && (!assigned || previousTeams.every(team=>team.role==='member') && JSON.stringify(previousTeams.map(team=>team.id))===JSON.stringify([...selectedTeams].sort()))) return
  if (member.role === 'owner') {
    const owners = await ctx.db.prepare("SELECT count(*) AS n FROM operators WHERE workspace_id=? AND role='owner' AND removed_at IS NULL").bind(ctx.workspace).first<number>('n')
    if ((owners ?? 0) <= 1) throw new SettingsError('last_owner', 'The last Owner cannot be demoted or removed. Make another member an Owner first.', 409)
    if (await ctx.db.prepare('SELECT 1 FROM workspace_installation WHERE setup_operator_id=?').bind(target).first())
      throw new SettingsError('installation_owner', 'The installation owner stays an Owner.', 409)
  }
  await commit(ctx, [
    guard(ctx.db, 'EXISTS(SELECT 1 FROM operators WHERE id=? AND role=? AND removed_at IS NULL)', target, member.role),
    ...(assigned ? [
      guard(ctx.db, `(SELECT json_group_array(json_object('id',team_id,'role',role)) FROM (SELECT team_id,role FROM main.team_members WHERE operator_id=? ORDER BY team_id))=?`,target,JSON.stringify(previousTeams)),
      guard(ctx.db, 'NOT EXISTS(SELECT 1 FROM json_each(?) j WHERE NOT EXISTS(SELECT 1 FROM main.teams WHERE id=j.value AND workspace_id=? AND archived_at IS NULL))',JSON.stringify(selectedTeams),ctx.workspace),
    ] : []),
    ctx.db.prepare('UPDATE operators SET role=?,updated_at=? WHERE id=?').bind(role, ctx.at, target),
    ...(assigned ? [
      ctx.db.prepare(`INSERT INTO team_departures(team_id,operator_id,departed_at)
        SELECT team_id,operator_id,? FROM main.team_members WHERE operator_id=? AND team_id NOT IN(SELECT value FROM json_each(?))
        ON CONFLICT(team_id,operator_id) DO UPDATE SET departed_at=excluded.departed_at`).bind(ctx.at,target,JSON.stringify(selectedTeams)),
      ctx.db.prepare('DELETE FROM team_departures WHERE operator_id=? AND team_id IN(SELECT value FROM json_each(?))').bind(target,JSON.stringify(selectedTeams)),
      ctx.db.prepare('DELETE FROM main.team_members WHERE operator_id=?').bind(target),
      ...selectedTeams.map(team => ctx.db.prepare("INSERT INTO team_members(team_id,operator_id,role,created_at,updated_at) VALUES(?,?,'member',?,?)").bind(team,target,ctx.at,ctx.at)),
    ] : []),
    revokeUngrantableInvitations(ctx.db, target, role, Date.parse(ctx.at)),
    ...audit(ctx, 'operator.role_changed', target, member.name, { role: member.role, ...(assigned || member.role === 'guest' || member.role === 'viewer' ? {teamIds:previousTeams.map(team=>team.id)} : {}) }, { role, ...(assigned ? { teamIds: selectedTeams } : {}) }),
  ])
}

/** Guest assignments require a team; Viewer assignments explicitly name any private access. */
export async function guestTeams(db: D1Database, workspace: string, teams?: string[], required = true) {
  const ids = [...new Set(teams ?? [])]
  if (required && !ids.length) throw new SettingsError('guest_teams_required', 'Choose at least one team for the Guest.', 400)
  const rows = (await db.prepare('SELECT id FROM main.teams WHERE workspace_id=? AND archived_at IS NULL AND id IN(SELECT value FROM json_each(?))')
    .bind(workspace,JSON.stringify(ids)).all<{id:string}>()).results
  if (rows.length !== ids.length) throw new SettingsError('invalid_team', 'Choose available teams in this workspace.', 400)
  return ids
}
