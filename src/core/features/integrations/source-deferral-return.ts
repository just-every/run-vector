import { createUlid } from "../../shared/ids";
import { returnStatements, finalizeEvent } from "../notifications/events";

/** The receipt reads the deferral inside the source publication transaction.
 * Neither replay nor evidence on an already returned/terminal issue can make it. */
export function sourceDeferralReturnStatements(
  db: D1Database,
  issueId: string,
  sourceName: string,
  at: string,
) {
  const event = {
    id: createUlid(new Date(at)),
    issueId,
    actor: null,
    actorName: sourceName,
    at,
  };
  return [
    db.prepare(`INSERT INTO issue_activity
      (id,issue_id,actor_operator_id,actor_name,kind,previous_value_json,next_value_json,created_at,updated_at)
      SELECT ?,i.id,NULL,?,'intake.returned',json_object('deferredUntil',i.deferred_until),
        json_object('deferredUntil',NULL),?,?
      FROM issues i JOIN workflow_statuses s ON s.id=i.status_id
      WHERE i.id=? AND i.deferred_until IS NOT NULL AND s.category='intake' AND EXISTS(SELECT 1 FROM teams t WHERE t.id=i.team_id AND t.triage_enabled=1)`)
      .bind(event.id, sourceName, at, at, issueId),
    ...returnStatements(db, event),
    db.prepare(`UPDATE issues SET deferred_until=NULL,version=version+1,updated_at=?
      WHERE id=? AND EXISTS(SELECT 1 FROM issue_activity WHERE id=? AND issue_id=issues.id)`)
      .bind(at, issueId, event.id),
    db.prepare(`DELETE FROM issue_deferral_origins WHERE issue_id=?
      AND EXISTS(SELECT 1 FROM issue_activity WHERE id=? AND issue_id=issue_deferral_origins.issue_id)`)
      .bind(issueId, event.id),
    ...finalizeEvent(db, event),
  ];
}
