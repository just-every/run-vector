import { createUlid } from "../../shared/ids";

export type DeferredIntake = {
  id: string;
  identifier: string;
  version: number;
  deferred_until: string | null;
  category: string;
};

export function findIntake(db: D1Database, identifier: string) {
  return db
    .prepare(
      `SELECT i.id,i.identifier,i.version,i.deferred_until,s.category
    FROM issues i JOIN workflow_statuses s ON s.id=i.status_id WHERE i.identifier=?`,
    )
    .bind(identifier)
    .first<DeferredIntake>();
}

export async function dueIntake(db: D1Database, now: string) {
  const rows = await db
    .prepare(
      `SELECT i.id,i.identifier,i.version,i.deferred_until,s.category
    FROM issues i JOIN workflow_statuses s ON s.id=i.status_id
    WHERE s.category='intake' AND i.deferred_until IS NOT NULL
      AND julianday(i.deferred_until)<=julianday(?)
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
    AND status_id IN (SELECT id FROM workflow_statuses WHERE category='intake')` +
    (onlyWhenDue ? " AND julianday(deferred_until)<=julianday(?)" : "");
  const guards = [
    issue.id,
    issue.version,
    issue.deferred_until,
    ...(onlyWhenDue ? [now] : []),
  ];
  const writes = await db.batch([
    db
      .prepare(
        `INSERT INTO issue_activity(id,issue_id,actor_operator_id,actor_name,kind,previous_value_json,next_value_json,created_at,updated_at)
      SELECT ?,id,?,?,'intake.returned',?,?,?,? FROM issues WHERE ${eligibility}`,
      )
      .bind(
        createUlid(new Date(now)),
        actor,
        actorName,
        JSON.stringify({ deferredUntil: issue.deferred_until }),
        JSON.stringify({ deferredUntil: null }),
        now,
        now,
        ...guards,
      ),
    db
      .prepare(
        `UPDATE issues SET deferred_until=NULL,version=version+1,updated_at=? WHERE ${eligibility}`,
      )
      .bind(now, ...guards),
  ]);
  return writes[1].meta.changes === 1;
}

export async function guardReturnedNoop(db: D1Database, issue: DeferredIntake, actor: string) {
  const result = await db
    .prepare(
      `UPDATE issues SET version=version
    WHERE id=? AND version=? AND deferred_until IS NULL
      AND status_id IN (SELECT id FROM workflow_statuses WHERE category='intake')
      AND EXISTS(SELECT 1 FROM operators WHERE id=? AND removed_at IS NULL)`,
    )
    .bind(issue.id, issue.version, actor)
    .run();
  return result.meta.changes === 1;
}
