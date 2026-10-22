import { administrationContext, audit, commit, guard, SettingsError, type AdministrationContext } from "../administration/transaction";

export type TeamRole = "owner" | "member";
type Team = { id: string; name: string; archived_at: string | null };

async function teamOf(ctx: AdministrationContext, id: string) {
  const team = await ctx.db.prepare("SELECT id,name,archived_at FROM teams WHERE id=? AND workspace_id=?").bind(id, ctx.workspace).first<Team>();
  if (!team) throw new SettingsError("not_found", "Team is unavailable.", 404);
  return team;
}
const membership = (ctx: AdministrationContext, team: string, operator: string) =>
  ctx.db.prepare("SELECT role FROM team_members WHERE team_id=? AND operator_id=?").bind(team, operator).first<{ role: TeamRole }>();
/** A team keeps at least one team owner; only leaving the workspace (OPS-004)
 * may leave it to its Admins until one is named. */
async function keepsAnOwner(ctx: AdministrationContext, team: string, operator: string) {
  const others = await ctx.db.prepare("SELECT count(*) AS n FROM team_members WHERE team_id=? AND role='owner' AND operator_id<>?").bind(team, operator).first<number>("n");
  if (!others) throw new SettingsError("last_team_owner", "Name another team owner before the last one leaves.", 409);
  return guard(ctx.db, "EXISTS(SELECT 1 FROM team_members WHERE team_id=? AND role='owner' AND operator_id<>?)", team, operator);
}
const unchanged = (ctx: AdministrationContext, team: string, operator: string, role: TeamRole | null) =>
  guard(ctx.db, "(SELECT role FROM team_members WHERE team_id=? AND operator_id=?) IS ?", team, operator, role);
const departed = (ctx: AdministrationContext, team: string, operator: string) =>
  ctx.db.prepare("INSERT INTO team_departures(team_id,operator_id,departed_at) VALUES(?,?,?) ON CONFLICT(team_id,operator_id) DO UPDATE SET departed_at=excluded.departed_at").bind(team, operator, ctx.at);
const returned = (ctx: AdministrationContext, team: string, operator: string) =>
  ctx.db.prepare("DELETE FROM team_departures WHERE team_id=? AND operator_id=?").bind(team, operator);

/** ROLE-007: a workspace member joins a public team from the directory. */
export async function joinTeam(source: D1Database, actor: string, teamId: string) {
  const ctx = await administrationContext(source, actor), team = await teamOf(ctx, teamId);
  if (team.archived_at) throw new SettingsError("team_archived", "Archived teams take no new members.", 409);
  if (await membership(ctx, teamId, actor)) return;
  await commit(ctx, [
    unchanged(ctx, teamId, actor, null),
    ctx.db.prepare("INSERT INTO team_members(team_id,operator_id,role,created_at,updated_at) VALUES(?,?,'member',?,?)").bind(teamId, actor, ctx.at, ctx.at),
    returned(ctx, teamId, actor),
    ...audit(ctx, "team.member_joined", teamId, team.name, null, { operatorId: actor, role: "member" }),
  ]);
}

/** Leaving keeps the member's assigned issues assigned, listed for the team's owners. */
export async function leaveTeam(source: D1Database, actor: string, teamId: string) {
  const ctx = await administrationContext(source, actor), team = await teamOf(ctx, teamId);
  const current = await membership(ctx, teamId, actor);
  if (!current) throw new SettingsError("not_member", "You are not a member of this team.", 409);
  await commit(ctx, [
    unchanged(ctx, teamId, actor, current.role),
    ...(current.role === "owner" ? [await keepsAnOwner(ctx, teamId, actor)] : []),
    ctx.db.prepare("DELETE FROM team_members WHERE team_id=? AND operator_id=?").bind(teamId, actor),
    departed(ctx, teamId, actor),
    ...audit(ctx, "team.member_left", teamId, team.name, { operatorId: actor, role: current.role }, null),
  ]);
}

/** A team owner or an Admin adds a member or names a team owner; only an
 * Owner or Admin adds a Guest (ROLE-003). */
export async function setTeamMember(source: D1Database, actor: string, teamId: string, operator: string, role: TeamRole) {
  const ctx = await administrationContext(source, actor), team = await teamOf(ctx, teamId);
  const person = await ctx.db.prepare("SELECT role FROM operators WHERE id=? AND workspace_id=? AND removed_at IS NULL").bind(operator, ctx.workspace).first<{ role: string }>();
  if (!person) throw new SettingsError("not_found", "Member is unavailable.", 404);
  const current = await membership(ctx, teamId, operator);
  if (current?.role === role) return;
  const acting = (await ctx.db.prepare("SELECT role FROM operators WHERE id=?").bind(actor).first<{ role: string }>())?.role;
  if (!current && person.role === "guest" && acting !== "owner" && acting !== "admin")
    throw new SettingsError("forbidden", "Only an Owner or Admin adds a Guest to a team.", 403);
  if (!current && team.archived_at) throw new SettingsError("team_archived", "Archived teams take no new members.", 409);
  await commit(ctx, [
    unchanged(ctx, teamId, operator, current?.role ?? null),
    ...(current?.role === "owner" ? [await keepsAnOwner(ctx, teamId, operator)] : []),
    ctx.db.prepare(`INSERT INTO team_members(team_id,operator_id,role,created_at,updated_at) VALUES(?,?,?,?,?)
      ON CONFLICT(team_id,operator_id) DO UPDATE SET role=excluded.role,updated_at=excluded.updated_at`).bind(teamId, operator, role, ctx.at, ctx.at),
    returned(ctx, teamId, operator),
    ...audit(ctx, current ? "team.member_role_changed" : "team.member_added", teamId, team.name,
      current ? { operatorId: operator, role: current.role } : null, { operatorId: operator, role }),
  ]);
}

export async function removeTeamMember(source: D1Database, actor: string, teamId: string, operator: string) {
  const ctx = await administrationContext(source, actor), team = await teamOf(ctx, teamId);
  const current = await membership(ctx, teamId, operator);
  if (!current) throw new SettingsError("not_member", "That person is not a member of this team.", 409);
  await commit(ctx, [
    unchanged(ctx, teamId, operator, current.role),
    ...(current.role === "owner" ? [await keepsAnOwner(ctx, teamId, operator)] : []),
    ctx.db.prepare("DELETE FROM team_members WHERE team_id=? AND operator_id=?").bind(teamId, operator),
    departed(ctx, teamId, operator),
    ...audit(ctx, "team.member_removed", teamId, team.name, { operatorId: operator, role: current.role }, null),
  ]);
}
