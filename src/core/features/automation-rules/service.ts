import { reminderCalendar } from "../due-reminders/calendar";
import {
  calendarDays,
  eligible,
  type DueCandidate,
  type DueRuleClock,
} from "./admission";
import { claimDueRule } from "./claim";
export async function runDueRules(env: { DB: D1Database }, now = new Date()) {
  const db = env.DB,
    at = now.toISOString();
  const rules = (
    await db
      .prepare(
        `SELECT r.id,r.version,r.workspace_id,w.timezone FROM workspace_due_rules r
    JOIN workspace_settings w ON w.id=r.workspace_id WHERE r.enabled=1`,
      )
      .all<DueRuleClock>()
  ).results;
  for (const rule of rules) {
    const due = calendarDays(reminderCalendar(now, rule.timezone).date, 2);
    const issues = (
      await db
        .prepare(
          `SELECT i.id,i.version,i.due_date,i.assignee_operator_id,i.cycle_id ${eligible}
      AND r.id=? AND i.due_date=? AND NOT EXISTS(SELECT 1 FROM workspace_due_rule_runs x
        WHERE x.rule_id=r.id AND x.issue_id=i.id AND x.due_date=i.due_date AND x.outcome='succeeded') ORDER BY i.id`,
        )
        .bind(rule.id, due)
        .all<DueCandidate>()
    ).results;
    for (const issue of issues) await claimDueRule(db, rule, issue, due, at);
  }
}
