import { browseActor } from "../issues/browse-access";
import { getView } from "../views/service";
import type { ManualOrderScope } from "./schema";
import { unavailable } from "./errors";
export type Scope = {
  workspace: string;
  key: string;
  team?: string;
  view?: string;
};

/** Configuration ownership and shared order editing are separate authorities. */
export async function resolveScope(
  db: D1Database,
  actor: string,
  input: ManualOrderScope,
): Promise<Scope> {
  const access = await browseActor(db, actor);
  let team = input.teamId;
  if (input.viewId) {
    const view = await getView(db, actor, input.viewId);
    if (view.query.team !== "all") {
      if (team && team !== view.query.team) throw unavailable();
      team = view.query.team;
    }
    // A workspace-wide saved view has one sequence; a transient team filter
    // must not change its identity or the set used to compute positions.
    else team = undefined;
  }
  for (const teamId of new Set(
    [team, input.teamId].filter((value): value is string => Boolean(value)),
  ))
    if (
      !(await db
        .prepare(
          "SELECT 1 FROM teams WHERE id=? AND workspace_id=? AND archived_at IS NULL",
        )
        .bind(teamId, access.workspace_id)
        .first())
    )
      throw unavailable();
  return {
    workspace: access.workspace_id,
    key: input.viewId ? `view:${input.viewId}` : `team:${team}`,
    team,
    view: input.viewId,
  };
}

export function membership(scope: Scope) {
  return {
    sql:
      "t.workspace_id=? AND t.archived_at IS NULL" +
      (scope.team ? " AND i.team_id=?" : ""),
    values: scope.team ? [scope.workspace, scope.team] : [scope.workspace],
  };
}
export function visibility(scope: Scope, actor: string) {
  const clauses = [
      "EXISTS(SELECT 1 FROM operators WHERE id=? AND workspace_id=? AND removed_at IS NULL)",
    ],
    values: (string | number)[] = [actor, scope.workspace];
  if (scope.team) {
    clauses.push(
      "EXISTS(SELECT 1 FROM teams WHERE id=? AND workspace_id=? AND archived_at IS NULL)",
    );
    values.push(scope.team, scope.workspace);
  }
  if (scope.view) {
    clauses.push(`EXISTS(SELECT 1 FROM saved_views WHERE id=? AND workspace_id=? AND (owner_operator_id=? OR is_shared=1)
      AND COALESCE(json_extract(filters_json,'$.team'),'all')=?)`);
    values.push(scope.view, scope.workspace, actor, scope.team ?? "all");
  }
  return { sql: clauses.join(" AND "), values };
}
