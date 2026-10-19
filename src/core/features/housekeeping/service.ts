import { createUlid } from "../../shared/ids";
import { blockerStatements, finalizeEvent, followerArchiveStatements, followerChangeStatements } from "../notifications/events";
import { archiveSql, candidates, staleSql, type Rule } from "./candidates";

type RuleRow = { teamId: string; closeAfterDays: number | null; archiveAfterDays: number | null; exemptBugs: number };

export async function readRules(db: D1Database, teamId?: string): Promise<Rule[]> {
  const rows = await db
    .prepare(
      `SELECT h.team_id AS teamId,h.close_after_days AS closeAfterDays,h.archive_after_days AS archiveAfterDays,h.exempt_bugs AS exemptBugs
      FROM team_housekeeping h JOIN teams t ON t.id=h.team_id WHERE t.archived_at IS NULL AND (?1 IS NULL OR h.team_id=?1)`,
    )
    .bind(teamId ?? null)
    .all<RuleRow>();
  return rows.results.map((r) => ({ ...r, exemptBugs: r.exemptBugs === 1 }));
}

const activity = `INSERT INTO issue_activity(id,issue_id,actor_operator_id,actor_name,kind,previous_value_json,next_value_json,created_at,updated_at)`;
// The entry is written first, guarded by eligibility measured before it exists; the issue write then follows only that entry.
const followsEntry = "id=? AND version=? AND EXISTS(SELECT 1 FROM issue_activity WHERE id=? AND issue_id=issues.id)";

/** Scheduled AUTO-003 step: stale open issues close to the team's Canceled status, old closed issues archive.
 * Each change is one issue-activity event that followers receive like a manual status change. */
export async function runHousekeeping(env: { DB: D1Database }, now = new Date()) {
  const db = env.DB, at = now.toISOString();
  const result = { closed: 0, archived: 0 };
  for (const rule of await readRules(db)) {
    const found = await candidates(db, rule, at);
    const canceled = await db
      .prepare("SELECT id FROM workflow_statuses WHERE team_id=? AND category='canceled' ORDER BY position,id LIMIT 1")
      .bind(rule.teamId)
      .first<string>("id");
    if (canceled && rule.closeAfterDays !== null) {
      const eligible = staleSql(rule).eligible;
      for (const issue of found.close) {
        const event = { id: createUlid(now), issueId: issue.id, actor: null, actorName: "Auto-close automation", at };
        const writes = await db.batch([
          db.prepare(
            `${activity} SELECT ?,id,NULL,?,'issue.auto_closed',json_object('statusId',status_id),json_object('statusId',?,'days',?,'note',?),?,?
            FROM issues WHERE ${eligible}`,
          ).bind(event.id, event.actorName, canceled, rule.closeAfterDays,
            `Closed automatically after ${rule.closeAfterDays} days without activity. Reopen it by choosing another status.`,
            at, at, issue.id, issue.version, at, rule.closeAfterDays),
          ...blockerStatements(db, event),
          db.prepare(`UPDATE issues SET status_id=?,canceled_at=?,completed_at=NULL,version=version+1,updated_at=? WHERE ${followsEntry}`)
            .bind(canceled, at, at, issue.id, issue.version, event.id),
          ...followerChangeStatements(db, event),
          ...finalizeEvent(db, event),
        ]);
        if (writes[0].meta.changes === 1) result.closed++;
      }
    }
    if (rule.archiveAfterDays !== null) {
      const eligible = archiveSql().eligible;
      for (const issue of found.archive) {
        const event = { id: createUlid(now), issueId: issue.id, actor: null, actorName: "Auto-archive automation", at };
        const writes = await db.batch([
          db.prepare(
            `${activity} SELECT ?,id,NULL,?,'issue.auto_archived',json_object('archivedAt',NULL),json_object('archivedAt',?,'days',?),?,?
            FROM issues WHERE ${eligible}`,
          ).bind(event.id, event.actorName, at, rule.archiveAfterDays, at, at, issue.id, issue.version, at, rule.archiveAfterDays),
          db.prepare(`UPDATE issues SET archived_at=?,version=version+1 WHERE ${followsEntry}`).bind(at, issue.id, issue.version, event.id),
          ...followerArchiveStatements(db, event),
          ...finalizeEvent(db, event),
        ]);
        if (writes[0].meta.changes === 1) result.archived++;
      }
    }
  }
  return result;
}
