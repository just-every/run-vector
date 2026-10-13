import { returnStatements, finalizeEvent } from '../notifications/events';
import { createUlid } from "../../shared/ids";

export type DeferredIntake = {
  id: string;
  identifier: string;
  version: number;
  deferred_until: string | null;
  category: string;
  decision_id: string | null;
};

export function findIntake(db: D1Database, identifier: string) {
  return db
    .prepare(
      `SELECT i.id,i.identifier,i.version,i.deferred_until,s.category,(SELECT decision_id FROM issue_deferral_origins WHERE issue_id=i.id) decision_id
    FROM issues i JOIN workflow_statuses s ON s.id=i.status_id WHERE i.identifier=?`,
    )
    .bind(identifier)
    .first<DeferredIntake>();
}

export async function dueIntake(db: D1Database, now: string) {
  const rows = await db
    .prepare(
      `SELECT i.id,i.identifier,i.version,i.deferred_until,s.category,(SELECT decision_id FROM issue_deferral_origins WHERE issue_id=i.id) decision_id
    FROM issues i JOIN workflow_statuses s ON s.id=i.status_id
    WHERE s.category='intake' AND i.deferred_until IS NOT NULL
      AND julianday(i.deferred_until)<=julianday(?)
      AND NOT EXISTS(SELECT 1 FROM vector_restore_status WHERE effects_held=1)
      AND NOT EXISTS(SELECT 1 FROM vector_http_restore)
    ORDER BY julianday(i.deferred_until),i.id LIMIT 50`,
    )
    .bind(now)
    .all<DeferredIntake>();
  return rows.results;
}

export async function clearDeferral(
  db: D1Database,
  issue: DeferredIntake,
  actor: string | null,
  actorName: string | null,
  now: string,
  onlyWhenDue: boolean,
) {
  const eligibility =
    `id=? AND version=? AND deferred_until=?
    AND status_id IN (SELECT id FROM workflow_statuses WHERE category='intake')
    AND COALESCE((SELECT decision_id FROM issue_deferral_origins WHERE issue_id=issues.id),'')=?` +
    (onlyWhenDue ? " AND julianday(deferred_until)<=julianday(?) AND NOT EXISTS(SELECT 1 FROM vector_restore_status WHERE effects_held=1) AND NOT EXISTS(SELECT 1 FROM vector_http_restore)" : "") +
    (actor ? " AND EXISTS(SELECT 1 FROM teams t JOIN operators o ON o.workspace_id=t.workspace_id WHERE t.id=issues.team_id AND o.id=? AND o.removed_at IS NULL)" : "");
  const guards = [
    issue.id,
    issue.version,
    issue.deferred_until,
    issue.decision_id ?? '',
    ...(onlyWhenDue ? [now] : []),
    ...(actor ? [actor] : []),
  ];
  const activityId = createUlid(new Date(now));
  const event = { id: activityId, issueId: issue.id, actor, actorName, at: now };
  const writes = await db.batch([
    db
      .prepare(
        `INSERT INTO issue_activity(id,issue_id,actor_operator_id,actor_name,kind,previous_value_json,next_value_json,created_at,updated_at)
      SELECT ?,id,?,?,'intake.returned',?,?,?,? FROM issues WHERE ${eligibility}`,
      )
      .bind(
        activityId,
        actor,
        actorName,
        JSON.stringify({ deferredUntil: issue.deferred_until }),
        JSON.stringify({ deferredUntil: null }),
        now,
        now,
        ...guards,
      ),
    ...returnStatements(db,event),
    db
      .prepare(
        `UPDATE issues SET deferred_until=NULL,version=version+1,updated_at=? WHERE ${eligibility}`,
      )
      .bind(now, ...guards),
    db.prepare('DELETE FROM issue_deferral_origins WHERE issue_id=? AND EXISTS(SELECT 1 FROM issue_activity WHERE id=?)').bind(issue.id,activityId),
    ...finalizeEvent(db,event),
  ]);
  return writes[0].meta.changes === 1;
}

export async function guardReturnedNoop(db: D1Database, issue: DeferredIntake, actor: string) {
  const result = await db
    .prepare(
      `UPDATE issues SET version=version
    WHERE id=? AND version=? AND deferred_until IS NULL
      AND status_id IN (SELECT id FROM workflow_statuses WHERE category='intake')
      AND EXISTS(SELECT 1 FROM teams t JOIN operators o ON o.workspace_id=t.workspace_id WHERE t.id=issues.team_id AND o.id=? AND o.removed_at IS NULL)
      RETURNING id`,
    )
    .bind(issue.id, issue.version, actor)
    .run<{ id: string }>();
  return result.results.length === 1 && result.results[0].id === issue.id;
}
