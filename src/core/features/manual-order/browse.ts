import { getView } from "../views/service";
import { ViewError } from "../views/repository";
import { IssueAccessError } from "../issues/access";
import type { IssueListQuery } from "../issues/list-schema";

export async function manualBrowseOrder(
  db: D1Database,
  actor: string,
  workspace: string,
  query: IssueListQuery,
) {
  if (query.sort !== "manual") return null;
  if (query.orderView) {
    try {
      await getView(db, actor, query.orderView);
    } catch (error) {
      if (error instanceof ViewError)
        throw new IssueAccessError("not_found", "View is unavailable.", 404);
      throw error;
    }
  }
  const scope = query.orderView
    ? "view:" + query.orderView
    : query.team !== "all"
      ? "team:" + query.team
      : null;
  const position = scope
    ? "(SELECT position FROM manual_order_entries e WHERE e.workspace_id=? AND e.scope_key=? AND e.issue_id=i.id)"
    : "(SELECT position FROM manual_order_entries e WHERE e.workspace_id=? AND e.scope_key='team:'||i.team_id AND e.issue_id=i.id)";
  const values = scope ? [workspace, scope] : [workspace];
  return {
    sql:
      (scope ? "" : "t.name,t.id,") +
      position +
      " IS NULL," +
      position +
      " ASC",
    values: [...values, ...values],
  };
}
