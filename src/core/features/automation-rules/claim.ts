import { createUlid } from "../../shared/ids";
import { automaticCycleStatements } from "../cycle-membership/plan";
import {
  activeCycle,
  eligible,
  type DueCandidate,
  type DueRuleClock,
} from "./admission";

export async function claimDueRule(
  db: D1Database,
  rule: DueRuleClock,
  issue: DueCandidate,
  date: string,
  at: string,
) {
  const claim = createUlid(new Date(at));
  const fence = ` AND r.id=? AND r.version=? AND w.timezone=? AND i.id=? AND i.version=? AND i.due_date=?
    AND i.assignee_operator_id=? AND i.cycle_id IS ? AND i.due_date=?`;
  const values = [
    rule.id,
    rule.version,
    rule.timezone,
    issue.id,
    issue.version,
    issue.due_date,
    issue.assignee_operator_id,
    issue.cycle_id,
    date,
  ];
  const own = `EXISTS(SELECT 1 FROM workspace_due_rule_runs x WHERE x.id=? AND x.issue_id=issues.id AND x.outcome='succeeded')`;
  const muted = `EXISTS(SELECT 1 FROM issue_notification_mutes m WHERE m.issue_id=x.issue_id AND m.operator_id=x.recipient_id)
    OR EXISTS(SELECT 1 FROM notification_type_mutes m WHERE m.operator_id=x.recipient_id AND m.kind='due_reminder')`;
  // A failed run remains visible and may retry while the calendar day still matches.
  // A successful receipt is permanent, including after date edits or rule toggles.
  try {
    await db.batch([
      db
        .prepare(
          `INSERT INTO workspace_due_rule_runs(id,rule_id,issue_id,due_date,recipient_id,cycle_id,outcome,reason,notified,created_at,updated_at)
      SELECT ?,r.id,i.id,i.due_date,o.id,${activeCycle},
        CASE WHEN ${activeCycle} IS NULL THEN 'failed' ELSE 'succeeded' END,
        CASE WHEN ${activeCycle} IS NULL THEN 'No active open cycle' ELSE NULL END,0,?,?
      ${eligible}${fence}
      ON CONFLICT(rule_id,issue_id,due_date) DO UPDATE SET id=excluded.id,recipient_id=excluded.recipient_id,cycle_id=excluded.cycle_id,
        outcome=excluded.outcome,reason=excluded.reason,updated_at=excluded.updated_at
      WHERE workspace_due_rule_runs.outcome='failed' AND excluded.outcome='succeeded'`,
        )
        .bind(claim, at, at, at, at, at, at, at, at, ...values),
      db
        .prepare(
          `INSERT INTO notifications(id,event_id,issue_id,recipient_id,actor_id,actor_name,causes_json,created_at)
      SELECT x.id,x.id,x.issue_id,x.recipient_id,NULL,'Due-soon automation','["due_reminder"]',?
      FROM workspace_due_rule_runs x WHERE x.id=? AND x.outcome='succeeded' AND NOT (${muted})`,
        )
        .bind(at, claim),
      db
        .prepare(
          `UPDATE workspace_due_rule_runs SET notified=EXISTS(SELECT 1 FROM notifications n WHERE n.event_id=?) WHERE id=?`,
        )
        .bind(claim, claim),
      db
        .prepare(
          "UPDATE workspace_due_rule_runs SET last_failure=reason,failed_at=? WHERE id=? AND outcome='failed'",
        )
        .bind(at, claim),
      ...automaticCycleStatements(
        db,
        issue.id,
        "",
        at,
        `id=? AND ${own} AND cycle_id IS NOT (SELECT cycle_id FROM workspace_due_rule_runs WHERE id=?)`,
        [issue.id, claim, claim],
        issue.cycle_id,
        `(SELECT cycle_id FROM workspace_due_rule_runs WHERE id='${claim}')`,
      ),
      db
        .prepare(
          `UPDATE issues SET cycle_id=(SELECT cycle_id FROM workspace_due_rule_runs WHERE id=?),version=version+1,updated_at=?
      WHERE id=? AND ${own} AND cycle_id IS NOT (SELECT cycle_id FROM workspace_due_rule_runs WHERE id=?)`,
        )
        .bind(claim, at, issue.id, claim, claim),
      db
        .prepare(
          `INSERT INTO audit_records(id,actor_operator_id,action,subject_identifier,subject_id,created_at,updated_at)
      SELECT x.id,NULL,'automation.due_soon',i.identifier,i.id,?,? FROM workspace_due_rule_runs x JOIN issues i ON i.id=x.issue_id
      WHERE x.id=? AND x.outcome='succeeded'`,
        )
        .bind(at, at, claim),
    ]);
  } catch {
    // The action transaction rolled back. Record a bounded, non-sensitive failure
    // against the same current-state fence; a storage outage still propagates.
    await db
      .prepare(
        `INSERT INTO workspace_due_rule_runs(id,rule_id,issue_id,due_date,recipient_id,outcome,reason,last_failure,failed_at,created_at,updated_at)
      SELECT ?,r.id,i.id,i.due_date,o.id,'failed','Run failed; retry pending','Run failed; retry pending',?,?,?
      ${eligible}${fence} ON CONFLICT(rule_id,issue_id,due_date) DO NOTHING`,
      )
      .bind(claim, at, at, at, ...values)
      .run();
    console.warn("Due-soon rule attempt failed; see run history.");
  }
}
