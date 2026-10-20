import type { UndoAction, UndoFailure } from "./schema";
import { duplicateGraphSql, issueSnapshotObjectSql } from "./snapshot";

const reasons = {
  stale: "The issue version changed. Review its current values.",
  state: "The issue or its retained property data changed.",
  latest: "A newer action is available; this is no longer the most recent action.",
  graph: "The duplicate relations changed after this action.",
  team: "The original team is unavailable or archived.",
  status: "The original workflow status is unavailable or changed category.",
  assignee: "The original assignee is unavailable in this workspace.",
  project: "The original project is unavailable or archived.",
  milestone: "The original milestone is unavailable for its project in this workspace.",
  cycle: "The original cycle is closed or unavailable for this team.",
  labels: "An original label is unavailable in this workspace.",
  origin: "The original deferral decision is unavailable.",
  canonical: "The original canonical issue is unavailable or is now a duplicate.",
};
type CheckRow = { identifier: string; visible: number; unavailable: number; unauthorized: number; expired: number } & Record<keyof typeof reasons, number>;
const value = (side: "before" | "after", field: string) => `json_extract(m.${side},'$.${field}')`;

/** One predicate supplies both readable conflicts and the transaction's first
 * assertion. No option or relation is trusted merely because preflight passed. */
export function undoAdmission(db: D1Database, actor: string, sessionHash: string, raw: string, action: UndoAction) {
  const before = (field: string) => value("before", field), after = (field: string) => value("after", field);
  const changed = (field: string) => `${before(field)} IS NOT ${after(field)}`;
  const sql = `WITH command AS (SELECT ? body), actor AS (
      SELECT id,workspace_id FROM operators WHERE id=? AND removed_at IS NULL
    ), eligible AS (
      SELECT a.rowid sequence FROM issue_activity a CROSS JOIN command JOIN actor ON actor.id=a.actor_operator_id
      WHERE a.id=json_extract(command.body,'$.actionId') AND json_extract(a.next_value_json,'$.undo')=command.body
        AND json_extract(command.body,'$.workspaceId')=actor.workspace_id
        AND json_extract(command.body,'$.sessionHash')=?
    ), undo_members AS (
      SELECT json_extract(value,'$.id') id FROM command,json_each(command.body,'$.after')
    ), members AS (
      SELECT b.value before,n.value after FROM command,json_each(command.body,'$.before') b
      JOIN json_each(command.body,'$.after') n ON json_extract(n.value,'$.id')=json_extract(b.value,'$.id')
    ) SELECT ${before("identifier")} identifier,i.id IS NOT NULL visible,i.id IS NULL unavailable,
      NOT EXISTS(SELECT 1 FROM eligible) unauthorized,
      julianday(json_extract(command.body,'$.expiresAt'))<=julianday('now') expired,
      i.id IS NOT NULL AND i.version<>${after("version")} stale,
      i.id IS NOT NULL AND i.version=${after("version")} AND ${issueSnapshotObjectSql(action.fields)} IS NOT m.after state,
      EXISTS(SELECT 1 FROM issue_activity newer JOIN actor ON actor.id=newer.actor_operator_id
        WHERE newer.rowid>(SELECT sequence FROM eligible)
          AND json_extract(newer.next_value_json,'$.undo.workspaceId')=actor.workspace_id) latest,
      ${action.kind === "duplicate" ? `${duplicateGraphSql} IS NOT json_extract(command.body,'$.graph')` : "0"} graph,
      (${changed("teamId")}) AND NOT EXISTS(SELECT 1 FROM teams original JOIN actor ON actor.workspace_id=original.workspace_id
        WHERE original.id=${before("teamId")} AND original.archived_at IS NULL) team,
      NOT EXISTS(SELECT 1 FROM workflow_statuses original WHERE original.id=${before("statusId")}
        AND original.team_id=${before("teamId")} AND original.category=${before("statusCategory")}) status,
      (${changed("assigneeOperatorId")}) AND ${before("assigneeOperatorId")} IS NOT NULL
        AND NOT EXISTS(SELECT 1 FROM operators original JOIN actor ON actor.workspace_id=original.workspace_id
          WHERE original.id=${before("assigneeOperatorId")} AND original.removed_at IS NULL) assignee,
      (${changed("projectId")}) AND ${before("projectId")} IS NOT NULL
        AND NOT EXISTS(SELECT 1 FROM projects original JOIN actor ON actor.workspace_id=original.workspace_id
          WHERE original.id=${before("projectId")} AND original.archived_at IS NULL) project,
      ((${changed("milestoneId")}) OR (${changed("projectId")})) AND ${before("milestoneId")} IS NOT NULL
        AND NOT EXISTS(SELECT 1 FROM project_milestones original JOIN projects p ON p.id=original.project_id
          JOIN actor ON actor.workspace_id=p.workspace_id
          WHERE original.id=${before("milestoneId")} AND original.project_id=${before("projectId")}) milestone,
      ((${changed("cycleId")}) OR (${changed("teamId")})) AND ${before("cycleId")} IS NOT NULL
        AND NOT EXISTS(SELECT 1 FROM cycles original WHERE original.id=${before("cycleId")}
          AND original.team_id=${before("teamId")} AND original.closed_at IS NULL) cycle,
      (${changed("labelIds")}) AND EXISTS(SELECT 1 FROM json_each(m.before,'$.labelIds') selected
        WHERE NOT EXISTS(SELECT 1 FROM labels original JOIN actor ON actor.workspace_id=original.workspace_id
          WHERE original.id=selected.value)) labels,
      (${changed("deferralOrigin")}) AND ${before("deferralOrigin")} IS NOT NULL AND (
        NOT EXISTS(SELECT 1 FROM intake_decisions original WHERE original.id=${before("deferralOrigin")} AND original.issue_id=i.id)
        OR EXISTS(SELECT 1 FROM issue_deferral_origins occupied WHERE occupied.decision_id=${before("deferralOrigin")} AND occupied.issue_id<>i.id)) origin,
      ${action.kind === "duplicate" ? `${before("canonicalId")} IS NOT NULL AND NOT EXISTS(
        SELECT 1 FROM issues canonical JOIN teams scope ON scope.id=canonical.team_id JOIN actor ON actor.workspace_id=scope.workspace_id
        JOIN workflow_statuses workflow ON workflow.id=canonical.status_id
        WHERE canonical.id=${before("canonicalId")} AND (
          EXISTS(SELECT 1 FROM command,json_each(command.body,'$.before') intended
            WHERE json_extract(intended.value,'$.id')=canonical.id AND json_extract(intended.value,'$.canonicalId') IS NULL
              AND json_extract(intended.value,'$.statusCategory')<>'duplicate')
          OR (canonical.id NOT IN(SELECT id FROM undo_members) AND workflow.category<>'duplicate'
            AND NOT EXISTS(SELECT 1 FROM issue_duplicates d WHERE d.issue_id=canonical.id))))` : "0"} canonical
    FROM members m CROSS JOIN command LEFT JOIN issues i ON i.id=${after("id")} AND EXISTS(
      SELECT 1 FROM teams scope JOIN actor ON actor.workspace_id=scope.workspace_id WHERE scope.id=i.team_id)
    LEFT JOIN workflow_statuses s ON s.id=i.status_id AND s.team_id=i.team_id`;
  const flags = ["unavailable", "unauthorized", "expired", ...Object.keys(reasons)].join(" OR ");
  const values = [raw, actor, sessionHash];
  return {
    query: db.prepare(sql).bind(...values),
    guard: db.prepare(`SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM (${sql}) WHERE ${flags})
      THEN 1 ELSE json('undo admission denied') END`).bind(...values),
    async inspect() {
      const rows = (await db.prepare(sql).bind(...values).all<CheckRow>()).results;
      const failures: UndoFailure[] = rows.flatMap((row) => {
        if (!row.visible || row.unauthorized) return [];
        const messages = (Object.entries(reasons) as [keyof typeof reasons, string][])
          .filter(([key]) => row[key]).map(([, message]) => message);
        return messages.length ? [{ identifier: row.identifier, reasons: messages }] : [];
      });
      return { denied: rows.length !== action.before.length || rows.some((row) => row.unavailable || row.unauthorized || row.expired) || failures.length > 0,
        expired: rows.some((row) => row.expired && !row.unauthorized), failures };
    },
  };
}
