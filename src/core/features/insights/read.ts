import { browseActor, workspaceDate } from "../issues/browse-access";
import { browseWhere } from "../issues/browse-sql";
import type { IssueListQuery } from "../issues/list-schema";
import { SettingsError } from "../settings/repository";
import { visibilityDatabase } from "../roles/visibility-database";
import { buildInsights } from "./build";
import type { Fact, InsightQuery } from "./schema";

export async function insightAuthority(db: D1Database, actor: string) {
  const access = await browseActor(db, actor);
  if (access.role === "guest") throw new SettingsError("forbidden", "Guests cannot open Insights.", 403);
  return access;
}
export async function readInsights(source: D1Database, actor: string, filters: IssueListQuery, chart: InsightQuery, now = new Date()) {
  const db = visibilityDatabase(source, actor);
  const access = await insightAuthority(db, actor);
  const where = browseWhere(filters, access.workspace_id, workspaceDate(now, access.timezone), actor);
  const relations = [where];
  // The list deliberately hides completed issues by default. An explicit report
  // option unions that exact list with its Completed filter; no second filter model.
  if (chart.includeCompleted === "true" && filters.scope === "all" && filters.category === "all" && filters.status === "all")
    relations.push(browseWhere({ ...filters, category: "completed" }, access.workspace_id, workspaceDate(now, access.timezone), actor));
  const selection = relations.map(r => "SELECT i.id " + r.relation).join(" UNION ");
  const rows = (await db.prepare(`WITH selected AS (${selection})
    SELECT i.identifier,i.title,i.estimate,i.created_at createdAt,i.completed_at completedAt,
    i.status_id statusId,s.name statusName,s.category,t.id teamId,t.name teamName,
    p.id projectId,p.name projectName,a.id assigneeId,a.name assigneeName,i.priority,
    (SELECT json_group_array(json_object('id',l.id,'name',l.name)) FROM issue_labels il JOIN labels l ON l.id=il.label_id WHERE il.issue_id=i.id) labels,
    (SELECT json_group_array(json_object('id',h.id,'at',h.created_at,'previousId',json_extract(h.previous_value_json,'$.statusId'),
      'nextId',json_extract(h.next_value_json,'$.statusId'),'previousName',previous.name,'nextName',next.name,'nextCategory',next.category))
      FROM issue_activity h LEFT JOIN workflow_statuses previous ON previous.id=json_extract(h.previous_value_json,'$.statusId')
      LEFT JOIN workflow_statuses next ON next.id=json_extract(h.next_value_json,'$.statusId')
      WHERE h.issue_id=i.id AND json_type(h.next_value_json,'$.statusId')='text'
        AND (h.kind='issue.created' OR json_type(h.previous_value_json,'$.statusId')='text')) transitions
    FROM selected JOIN issues i ON i.id=selected.id JOIN teams t ON t.id=i.team_id JOIN workflow_statuses s ON s.id=i.status_id
    LEFT JOIN projects p ON p.id=i.project_id LEFT JOIN operators a ON a.id=i.assignee_operator_id
    ORDER BY i.identifier LIMIT 10001`).bind(...relations.flatMap(r => r.values))
    .all<Omit<Fact, "labels" | "transitions"> & { labels: string; transitions: string }>()).results;
  if (rows.length > 10000) throw new SettingsError("invalid_request", "Choose filters matching at most 10,000 issues for Insights.", 400);
  const result = buildInsights(rows.map(r => ({ ...r, labels: JSON.parse(r.labels), transitions: JSON.parse(r.transitions) })), chart, access.timezone, now);
  await insightAuthority(db, actor);
  return result;
}
