import { IssueAccessError } from "./access";
import type { IssueListQuery, IssueListData } from "./list-schema";

async function workspaceForActor(db: D1Database, actor: string) {
  const row = await db
    .prepare(
      "SELECT workspace_id FROM operators WHERE id=? AND removed_at IS NULL",
    )
    .bind(actor)
    .first<{ workspace_id: string }>();
  if (!row)
    throw new IssueAccessError(
      "unauthenticated",
      "An active native operator is required.",
      401,
    );
  return row.workspace_id;
}

/** Ordinary browsing never changes Current membership, admission, or issue data. */
export async function listIssues(
  db: D1Database,
  actor: string,
  query: IssueListQuery,
): Promise<IssueListData> {
  const workspace = await workspaceForActor(db, actor);
  const conditions = ["t.workspace_id=?"];
  const values: string[] = [workspace];
  if (query.category === "all") conditions.push("s.category <> 'completed'");
  else {
    conditions.push("s.category=?");
    values.push(query.category);
  }
  if (query.q) {
    conditions.push(
      "(instr(lower(i.identifier),lower(?))>0 OR instr(lower(i.title),lower(?))>0)",
    );
    values.push(query.q, query.q);
  }
  if (query.assignee === "unassigned")
    conditions.push("i.assignee_operator_id IS NULL");
  else if (query.assignee !== "all") {
    conditions.push("i.assignee_operator_id=?");
    values.push(query.assignee);
  }
  const relation = `FROM issues i JOIN teams t ON t.id=i.team_id
    JOIN workflow_statuses s ON s.id=i.status_id AND s.team_id=t.id
    WHERE ${conditions.join(" AND ")}`;
  // One read batch supplies count, rows and workspace-owned operator choices.
  const [count, rows, assignees] = await db.batch([
    db.prepare(`SELECT COUNT(*) AS total ${relation}`).bind(...values),
    db
      .prepare(
        `SELECT i.id,i.identifier,i.title,i.priority,i.updated_at AS updatedAt,
      s.id AS statusId,s.name AS statusName,s.category AS category,
      t.id AS teamId,t.name AS teamName,
      (SELECT a.id FROM operators a WHERE a.id=i.assignee_operator_id AND a.workspace_id=t.workspace_id AND a.removed_at IS NULL) AS assigneeId,
      (SELECT a.name FROM operators a WHERE a.id=i.assignee_operator_id AND a.workspace_id=t.workspace_id AND a.removed_at IS NULL) AS assigneeName
      ${relation} ORDER BY i.updated_at DESC,i.identifier ASC LIMIT 50 OFFSET ?`,
      )
      .bind(...values, query.offset),
    db
      .prepare(
        "SELECT id,name FROM operators WHERE workspace_id=? AND removed_at IS NULL ORDER BY name,id",
      )
      .bind(workspace),
  ]);
  if ((await workspaceForActor(db, actor)) !== workspace)
    throw new IssueAccessError(
      "unauthenticated",
      "The operator workspace changed. Sign in again.",
      401,
    );
  return {
    total: Number((count.results[0] as { total: number }).total),
    offset: query.offset,
    pageSize: 50,
    assignees: assignees.results as IssueListData["assignees"],
    issues: rows.results.map((raw) => {
      const row = raw as {
        id: string;
        identifier: string;
        title: string;
        priority: IssueListData["issues"][number]["priority"];
        updatedAt: string;
        statusId: string;
        statusName: string;
        category: string;
        teamId: string;
        teamName: string;
        assigneeId: string | null;
        assigneeName: string | null;
      };
      return {
        id: row.id,
        identifier: row.identifier,
        title: row.title,
        priority: row.priority,
        updatedAt: row.updatedAt,
        status: {
          id: row.statusId,
          name: row.statusName,
          category: row.category,
        },
        team: { id: row.teamId, name: row.teamName },
        assignee:
          row.assigneeId && row.assigneeName
            ? { id: row.assigneeId, name: row.assigneeName }
            : null,
      };
    }),
  };
}
