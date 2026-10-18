import { requireIssueAccess } from "../issues/access";
import type { SubissuesData } from "./schema";
export async function readSubissues(
  db: D1Database,
  identifier: string,
  actor: string,
): Promise<SubissuesData> {
  const issue = await requireIssueAccess(db, identifier, actor);
  const [parent, rows] = await Promise.all([
    db
      .prepare(
        `SELECT i.version,i.team_id,COALESCE(r.enabled,0) enabled,COALESCE(r.version,0) rule_version FROM issues i LEFT JOIN subissue_team_rules r ON r.team_id=i.team_id WHERE i.id=?`,
      )
      .bind(issue.id)
      .first<{
        version: number;
        team_id: string;
        enabled: number;
        rule_version: number;
      }>(),
    db
      .prepare(
        `SELECT i.id,i.identifier,i.title,i.version,s.id status_id,s.name status_name,s.category,o.id assignee_id,o.name assignee_name FROM issue_parents link JOIN issues i ON i.id=link.issue_id JOIN workflow_statuses s ON s.id=i.status_id LEFT JOIN operators o ON o.id=i.assignee_operator_id WHERE link.parent_issue_id=? ORDER BY link.position,i.identifier,i.id`,
      )
      .bind(issue.id)
      .all<{
        id: string;
        identifier: string;
        title: string;
        version: number;
        status_id: string;
        status_name: string;
        category: string;
        assignee_id: string | null;
        assignee_name: string | null;
      }>(),
  ]);
  await requireIssueAccess(db, identifier, actor);
  if (!parent)
    throw new Error("Sub-issue parent disappeared during projection.");
  return {
    identifier,
    version: parent.version,
    teamId: parent.team_id,
    completed: rows.results.filter((r) => r.category === "completed").length,
    total: rows.results.length,
    rule: { enabled: Boolean(parent.enabled), version: parent.rule_version },
    children: rows.results.map((r) => ({
      id: r.id,
      identifier: r.identifier,
      title: r.title,
      version: r.version,
      status: { id: r.status_id, name: r.status_name, category: r.category },
      assignee: r.assignee_id
        ? { id: r.assignee_id, name: r.assignee_name! }
        : null,
    })),
  };
}
