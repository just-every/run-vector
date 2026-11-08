import {hierarchy,hierarchyFence,hierarchyAuthority,inheritedPermissionWrites} from "../sub-teams/hierarchy";
import { administrationContext, audit, commit, guard, SettingsError } from "../administration/transaction";
import type { TeamPermission } from "../roles/policy";

export type TeamPermissions = { settings: TeamPermission; planning: TeamPermission };

/** ROLE-009: a team owner, an Owner or an Admin sets the team's two
 * permissions. Each changed permission is one audit entry, effective on the
 * next request. */
export async function setTeamPermissions(source: D1Database, actor: string, teamId: string, next: TeamPermissions) {
  const ctx = await administrationContext(source, actor);
  const team = await ctx.db.prepare("SELECT id,name,settings_permission AS settings,planning_permission AS planning FROM teams WHERE id=? AND workspace_id=?")
    .bind(teamId, ctx.workspace).first<{ id: string; name: string } & TeamPermissions>();
  if (!team) throw new SettingsError("not_found", "Team is unavailable.", 404);
  const graph=await hierarchy(ctx),row=graph.find(t=>t.id===teamId)!;
  const graphGuard=hierarchyFence(ctx,graph);
  const parentGuard=row.parent_team_id?await hierarchyAuthority(ctx,[teamId,row.parent_team_id]):guard(ctx.db,"1");
  const changed = (["settings", "planning"] as const).filter((permission) => team[permission] !== next[permission]);
  if (!changed.length && !row.permissions_inherited) return;
  row.settings_permission=next.settings;row.planning_permission=next.planning;row.permissions_inherited=0;
  await commit(ctx, [graphGuard,parentGuard,
    guard(ctx.db, "EXISTS(SELECT 1 FROM teams WHERE id=? AND settings_permission=? AND planning_permission=?)", teamId, team.settings, team.planning),
    ctx.db.prepare("UPDATE teams SET settings_permission=?,planning_permission=?,permissions_inherited=0,hierarchy_version=hierarchy_version+1,updated_at=? WHERE id=?").bind(next.settings, next.planning, ctx.at, teamId),
    ...inheritedPermissionWrites(ctx,graph,teamId),
    ...changed.flatMap((permission) => audit(ctx, "team.permission_changed", teamId, team.name, { [permission]: team[permission] }, { [permission]: next[permission] })),
  ]);
}
