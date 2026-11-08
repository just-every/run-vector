import { createUlid } from "../../shared/ids";
import {
  audit,
  guard,
  SettingsError,
  type AdministrationContext,
} from "../administration/transaction";
import { statusRemovalNotifications } from "../notifications/status-removal";
import type { HierarchyTeam } from "./hierarchy";

export type WorkflowStatus = {
  id: string;
  team_id: string;
  name: string;
  category: string;
  position: number;
  inherited_from: string | null;
};
export async function workflowRows(ctx: AdministrationContext, team: string) {
  return (
    await ctx.db
      .prepare(
        "SELECT * FROM main.workflow_statuses WHERE team_id=? ORDER BY position,id",
      )
      .bind(team)
      .all<WorkflowStatus>()
  ).results;
}
export function statusFence(
  ctx: AdministrationContext,
  team: string,
  rows: WorkflowStatus[],
) {
  return guard(
    ctx.db,
    "(SELECT json_group_array(json_array(id,name,category,position,inherited_from)) FROM (SELECT * FROM main.workflow_statuses WHERE team_id=? ORDER BY position,id))=?",
    team,
    JSON.stringify(
      rows.map((s) => [s.id, s.name, s.category, s.position, s.inherited_from]),
    ),
  );
}
/** Materialized effective workflows retain a team's own status identities.
 * Every admission and editor reads the same team-local rows. Parent edits and
 * descendant remaps are committed in the same guarded transaction. */
export async function inheritedWorkflowWrites(
  ctx: AdministrationContext,
  childId: string,
  parentId: string,
  teams: HierarchyTeam[],
  parentRows?: WorkflowStatus[],
  destinations = new Map<string, string>(),
) {
  const parent = parentRows ?? (await workflowRows(ctx, parentId)),
    old = await workflowRows(ctx, childId);
  if (!parent.length)
    throw new SettingsError(
      "invalid_workflow",
      "Parent workflow is unavailable.",
      409,
    );
  const next = parent.map((s) => ({
    ...s,
    id:
      old.find((o) => o.inherited_from === s.id)?.id ??
      createUlid(new Date(ctx.at)),
    team_id: childId,
    inherited_from: s.id,
  }));
  const writes: D1PreparedStatement[] = [statusFence(ctx, childId, old)];
  if (!parentRows) writes.push(statusFence(ctx, parentId, parent));
  // Free unique names and positions before replacing the materialized values.
  writes.push(
    ctx.db
      .prepare(
        "UPDATE workflow_statuses SET name='inherited:'||id,position=position+1000000 WHERE team_id=?",
      )
      .bind(childId),
  );
  for (const status of next) {
    const exists = old.some((s) => s.id === status.id);
    writes.push(
      exists
        ? ctx.db
            .prepare(
              "UPDATE workflow_statuses SET name=?,category=?,position=?,inherited_from=?,updated_at=? WHERE id=?",
            )
            .bind(
              status.name,
              status.category,
              status.position,
              status.inherited_from,
              ctx.at,
              status.id,
            )
        : ctx.db
            .prepare(
              "INSERT INTO workflow_statuses(id,team_id,name,category,position,inherited_from,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)",
            )
            .bind(
              status.id,
              childId,
              status.name,
              status.category,
              status.position,
              status.inherited_from,
              ctx.at,
              ctx.at,
            ),
    );
  }
  const mapped = new Map<string, string>();
  for (const status of old.filter((s) => !next.some((n) => n.id === s.id))) {
    const explicit = status.inherited_from
      ? destinations.get(status.inherited_from)
      : undefined;
    const target =
      next.find((n) => n.inherited_from === explicit) ??
      next.find(
        (n) => n.name === status.name && n.category === status.category,
      ) ??
      next.find((n) => n.category === status.category);
    if (!target)
      throw new SettingsError(
        "invalid_workflow",
        "Every issue must retain a status in its category.",
        409,
      );
    mapped.set(status.id, target.id);
    const operation = createUlid(new Date(ctx.at)),
      notifications = statusRemovalNotifications(ctx.db, operation);
    writes.push(
      ctx.db
        .prepare(
          "INSERT INTO issue_activity(id,issue_id,actor_operator_id,kind,previous_value_json,next_value_json,created_at,updated_at) SELECT ?||':'||id,id,?,'workflow.status_removed',json_object('statusId',status_id),json_object('statusId',?),?,? FROM main.issues WHERE team_id=? AND status_id=?",
        )
        .bind(
          operation,
          ctx.actor,
          target.id,
          ctx.at,
          ctx.at,
          childId,
          status.id,
        ),
      ...notifications.capture,
      ctx.db
        .prepare(
          "UPDATE issues SET status_id=?,version=version+1,updated_at=? WHERE team_id=? AND status_id=?",
        )
        .bind(target.id, ctx.at, childId, status.id),
      // The status FK clears automation targets on deletion. Move configured
      // rules to the same replacement as issues before removing the old row;
      // advance the version so an open editor cannot overwrite that remap.
      ctx.db
        .prepare(
          "UPDATE github_automation_rules SET status_id=?,version=version+1,updated_at=? WHERE team_id=? AND status_id=?",
        )
        .bind(target.id, ctx.at, childId, status.id),
      ctx.db
        .prepare("DELETE FROM workflow_statuses WHERE id=?")
        .bind(status.id),
      ...notifications.finalize,
      ...audit(
        ctx,
        "workflow.inherited_status_mapped",
        status.id,
        status.name,
        { teamId: childId, statusId: status.id },
        { teamId: childId, statusId: target.id },
      ),
    );
  }
  for (const child of teams.filter(
    (t) => t.parent_team_id === childId && t.workflow_inherited,
  ))
    writes.push(
      ...(await inheritedWorkflowWrites(
        ctx,
        child.id,
        childId,
        teams,
        next,
        mapped,
      )),
    );
  return writes;
}
export async function workflowDescendantWrites(
  ctx: AdministrationContext,
  team: string,
  next: WorkflowStatus[],
  destinations = new Map<string, string>(),
) {
  const teams = (
    await ctx.db
      .prepare("SELECT * FROM main.teams WHERE workspace_id=?")
      .bind(ctx.workspace)
      .all<HierarchyTeam>()
  ).results;
  const writes: D1PreparedStatement[] = [];
  // A hierarchy change cannot attach an unobserved descendant during the edit.
  writes.push(
    guard(
      ctx.db,
      "(SELECT json_group_array(json_array(id,parent_team_id,workflow_inherited,hierarchy_version)) FROM (SELECT * FROM main.teams WHERE workspace_id=? ORDER BY id))=?",
      ctx.workspace,
      JSON.stringify(
        [...teams]
          .sort((a, b) => a.id.localeCompare(b.id))
          .map((t) => [
            t.id,
            t.parent_team_id,
            t.workflow_inherited,
            t.hierarchy_version,
          ]),
      ),
    ),
  );
  for (const child of teams.filter(
    (t) => t.parent_team_id === team && t.workflow_inherited,
  ))
    writes.push(
      ...(await inheritedWorkflowWrites(
        ctx,
        child.id,
        team,
        teams,
        next,
        destinations,
      )),
    );
  return writes;
}
