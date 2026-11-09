import { z } from "zod";
import { administrationId } from "../administration/schema";
import {
  administrationContext,
  audit,
  commit,
  guard,
  SettingsError,
  type AdministrationContext,
} from "../administration/transaction";
import { loadAuthority, authorityFence } from "../roles/authority";
import { decide, decisionInputs } from "../roles/policy";
import { inheritedWorkflowWrites } from "./workflow";

export const hierarchySchema = z
  .object({
    version: z.number().int().positive(),
    parentTeamId: administrationId.nullable().optional(),
    workflowInherited: z.boolean().optional(),
    permissionsInherited: z.boolean().optional(),
    settingsPermission: z.enum(["team_owners", "all_members"]).optional(),
    planningPermission: z.enum(["team_owners", "all_members"]).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 1);

export type HierarchyTeam = {
  id: string;
  name: string;
  parent_team_id: string | null;
  workflow_inherited: number;
  permissions_inherited: number;
  hierarchy_version: number;
  settings_permission: "team_owners" | "all_members";
  planning_permission: "team_owners" | "all_members";
};
export async function hierarchy(ctx: AdministrationContext) {
  // Administration of inherited configuration must reach private descendants
  // without projecting their issues or granting the caller membership.
  return (
    await ctx.db
      .prepare(
        "SELECT id,name,parent_team_id,workflow_inherited,permissions_inherited,hierarchy_version,settings_permission,planning_permission FROM main.teams WHERE workspace_id=? ORDER BY id",
      )
      .bind(ctx.workspace)
      .all<HierarchyTeam>()
  ).results;
}
export function hierarchyFence(
  ctx: AdministrationContext,
  teams: HierarchyTeam[],
) {
  return guard(
    ctx.db,
    "(SELECT json_group_array(json_array(id,parent_team_id,workflow_inherited,permissions_inherited,hierarchy_version,settings_permission,planning_permission)) FROM (SELECT * FROM main.teams WHERE workspace_id=? ORDER BY id))=?",
    ctx.workspace,
    JSON.stringify(
      teams.map((t) => [
        t.id,
        t.parent_team_id,
        t.workflow_inherited,
        t.permissions_inherited,
        t.hierarchy_version,
        t.settings_permission,
        t.planning_permission,
      ]),
    ),
  );
}
export async function hierarchyAuthority(
  ctx: AdministrationContext,
  ids: string[],
  row: "teams.hierarchy" | "teams.permissions" = "teams.hierarchy",
) {
  const teams = [...new Set(ids)],
    authority = await loadAuthority(ctx.db, ctx.actor, teams);
  const question = { row, teams };
  if (!authority || decide(authority, question) !== "allow")
    throw new SettingsError(
      "forbidden",
      "Team-setting permission is required on the child and parent.",
      403,
    );
  const fence = authorityFence(
    ctx.actor,
    authority,
    decisionInputs(authority, question),
  );
  return guard(ctx.db, fence.sql, ...fence.values);
}
export function validHierarchy(teams: HierarchyTeam[]) {
  const byId = new Map(teams.map((t) => [t.id, t]));
  for (const team of teams) {
    const seen = new Set<string>();
    let current: HierarchyTeam | undefined = team;
    while (current) {
      if (seen.has(current.id) || seen.size === 3)
        throw new SettingsError(
          "invalid_hierarchy",
          "Teams may have at most three levels and cannot form a cycle.",
          400,
        );
      seen.add(current.id);
      if (current.parent_team_id && !byId.has(current.parent_team_id))
        throw new SettingsError(
          "not_found",
          "Parent team is unavailable.",
          404,
        );
      current = current.parent_team_id
        ? byId.get(current.parent_team_id)
        : undefined;
    }
  }
}
export function inheritedPermissionWrites(
  ctx: AdministrationContext,
  teams: HierarchyTeam[],
  root: string,
) {
  const writes: D1PreparedStatement[] = [];
  const visit = (id: string) => {
    const parent = teams.find((t) => t.id === id)!;
    for (const child of teams.filter(
      (t) => t.parent_team_id === id && t.permissions_inherited === 1,
    )) {
      child.settings_permission = parent.settings_permission;
      child.planning_permission = parent.planning_permission;
      writes.push(
        ctx.db
          .prepare(
            "UPDATE teams SET settings_permission=?,planning_permission=?,hierarchy_version=hierarchy_version+1,updated_at=? WHERE id=?",
          )
          .bind(
            child.settings_permission,
            child.planning_permission,
            ctx.at,
            child.id,
          ),
      );
      visit(child.id);
    }
  };
  visit(root);
  return writes;
}
export async function changeHierarchy(
  source: D1Database,
  actor: string,
  id: string,
  input: z.output<typeof hierarchySchema>,
) {
  const ctx = await administrationContext(source, actor),
    teams = await hierarchy(ctx),
    old = teams.find((t) => t.id === id);
  if (!old) throw new SettingsError("not_found", "Team is unavailable.", 404);
  if (old.hierarchy_version !== input.version)
    throw new SettingsError(
      "stale_hierarchy",
      "Team settings changed. Reload and try again.",
      409,
    );
  const next = {
    ...old,
    parent_team_id:
      input.parentTeamId === undefined
        ? old.parent_team_id
        : input.parentTeamId,
    workflow_inherited:
      input.workflowInherited === undefined
        ? old.workflow_inherited
        : Number(input.workflowInherited),
    permissions_inherited:
      input.permissionsInherited === undefined
        ? old.permissions_inherited
        : Number(input.permissionsInherited),
  };
  if (!next.parent_team_id) {
    next.workflow_inherited = 0;
    next.permissions_inherited = 0;
  }
  if (
    (input.settingsPermission || input.planningPermission) &&
    next.permissions_inherited
  )
    throw new SettingsError(
      "invalid_permissions",
      "Choose custom permissions before setting their values.",
      400,
    );
  const parent = teams.find((t) => t.id === next.parent_team_id);
  const allowed = await hierarchyAuthority(ctx, [
    id,
    ...[old.parent_team_id, next.parent_team_id].filter(
      (v): v is string => !!v,
    ),
  ]);
  const graphFence = hierarchyFence(ctx, teams);
  validHierarchy(teams.map((t) => (t.id === id ? next : t)));
  next.settings_permission = next.permissions_inherited
    ? parent!.settings_permission
    : (input.settingsPermission ?? old.settings_permission);
  next.planning_permission = next.permissions_inherited
    ? parent!.planning_permission
    : (input.planningPermission ?? old.planning_permission);
  // Reparenting or switching inheritance can set permission values without
  // naming them explicitly. Every such write keeps ROLE-009 authority.
  const changesPermissions =
    input.settingsPermission !== undefined || input.planningPermission !== undefined ||
    next.permissions_inherited !== old.permissions_inherited ||
    next.settings_permission !== old.settings_permission ||
    next.planning_permission !== old.planning_permission;
  const permissionsAllowed = changesPermissions
    ? [await hierarchyAuthority(ctx, [id], "teams.permissions")]
    : [];
  const nextTeams = teams.map((t) => (t.id === id ? next : { ...t }));
  const workflows = next.workflow_inherited
    ? await inheritedWorkflowWrites(ctx, id, parent!.id, nextTeams)
    : [
        ctx.db
          .prepare(
            "UPDATE workflow_statuses SET inherited_from=NULL WHERE team_id=?",
          )
          .bind(id),
      ];
  await commit(ctx, [
    allowed,
    ...permissionsAllowed,
    graphFence,
    ctx.db
      .prepare(
        "UPDATE teams SET parent_team_id=?,workflow_inherited=?,permissions_inherited=?,settings_permission=?,planning_permission=?,hierarchy_version=hierarchy_version+1,updated_at=? WHERE id=?",
      )
      .bind(
        next.parent_team_id,
        next.workflow_inherited,
        next.permissions_inherited,
        next.settings_permission,
        next.planning_permission,
        ctx.at,
        id,
      ),
    ...workflows,
    ...inheritedPermissionWrites(ctx, nextTeams, id),
    ...audit(ctx, "team.hierarchy_changed", id, old.name, old, next),
  ]);
}
