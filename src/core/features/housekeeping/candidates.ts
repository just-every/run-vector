import type { Housekeeping, HousekeepingCandidate } from "./schema";

// The same selection drives the settings preview and the scheduled run, so a preview names exactly what the next run changes.
const quiet = `NOT EXISTS(SELECT 1 FROM vector_restore_status WHERE effects_held=1) AND NOT EXISTS(SELECT 1 FROM vector_http_restore)`;
// Last activity is the latest issue change, activity entry or comment.
const lastActivity = `MAX(i.updated_at,COALESCE((SELECT MAX(a.created_at) FROM issue_activity a WHERE a.issue_id=i.id),i.updated_at),
  COALESCE((SELECT MAX(c.created_at) FROM issue_comments c WHERE c.issue_id=i.id),i.updated_at))`;
// "Bugs exempt" is a label rule until issue types exist (ISSUE-021): any label named Bug.
const bug = `EXISTS(SELECT 1 FROM issue_labels il JOIN labels l ON l.id=il.label_id WHERE il.issue_id=i.id AND lower(trim(l.name))='bug')`;
const closedAt = `COALESCE(i.completed_at,i.canceled_at,i.updated_at)`;

export type Rule = Housekeeping & { teamId: string };

export function staleSql(rule: Rule) {
  return {
    sql: `SELECT i.id,i.identifier,i.title,i.version,i.team_id AS teamId,i.status_id AS statusId,
      CAST(julianday(?)-julianday(${lastActivity}) AS INTEGER) AS days
      FROM issues i JOIN workflow_statuses s ON s.id=i.status_id JOIN teams t ON t.id=i.team_id
      WHERE i.team_id=? AND t.archived_at IS NULL AND i.archived_at IS NULL AND i.deferred_until IS NULL
        AND s.category IN ('backlog','unstarted','started')
        AND julianday(?)-julianday(${lastActivity})>=?
        ${rule.exemptBugs ? `AND NOT ${bug}` : ""} AND ${quiet}
      ORDER BY i.id LIMIT 50`,
    eligible: `id=? AND version=? AND archived_at IS NULL AND deferred_until IS NULL
      AND status_id IN (SELECT id FROM workflow_statuses WHERE category IN ('backlog','unstarted','started'))
      AND julianday(?)-julianday(MAX(updated_at,COALESCE((SELECT MAX(a.created_at) FROM issue_activity a WHERE a.issue_id=issues.id),updated_at),
        COALESCE((SELECT MAX(c.created_at) FROM issue_comments c WHERE c.issue_id=issues.id),updated_at)))>=?
      ${rule.exemptBugs ? `AND NOT EXISTS(SELECT 1 FROM issue_labels il JOIN labels l ON l.id=il.label_id WHERE il.issue_id=issues.id AND lower(trim(l.name))='bug')` : ""}
      AND ${quiet}`,
  };
}

export function archiveSql() {
  return {
    sql: `SELECT i.id,i.identifier,i.title,i.version,i.team_id AS teamId,i.status_id AS statusId,
      CAST(julianday(?)-julianday(${closedAt}) AS INTEGER) AS days
      FROM issues i JOIN workflow_statuses s ON s.id=i.status_id JOIN teams t ON t.id=i.team_id
      WHERE i.team_id=? AND t.archived_at IS NULL AND i.archived_at IS NULL
        AND s.category IN ('completed','canceled','duplicate')
        AND julianday(?)-julianday(${closedAt})>=? AND ${quiet}
      ORDER BY i.id LIMIT 50`,
    eligible: `id=? AND version=? AND archived_at IS NULL
      AND status_id IN (SELECT id FROM workflow_statuses WHERE category IN ('completed','canceled','duplicate'))
      AND julianday(?)-julianday(COALESCE(completed_at,canceled_at,updated_at))>=? AND ${quiet}`,
  };
}

export async function candidates(db: D1Database, rule: Rule, now: string) {
  const read = (sql: string, days: number | null) =>
    days === null
      ? Promise.resolve([] as HousekeepingCandidate[])
      : db.prepare(sql).bind(now, rule.teamId, now, days).all<HousekeepingCandidate>().then((r) => r.results);
  const [close, archive] = await Promise.all([
    read(staleSql(rule).sql, rule.closeAfterDays),
    read(archiveSql().sql, rule.archiveAfterDays),
  ]);
  return { close, archive };
}
