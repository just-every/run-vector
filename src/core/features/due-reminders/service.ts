import { reminderCalendar } from "./calendar";
import {
  claimReminder,
  type ReminderCandidate,
  type ReminderWorkspace,
} from "./repository";
/** NOTIFY-005: Inbox only. No activity, event finalizer, mail or integration producer. */
export async function sendDueReminders(
  env: { DB: D1Database },
  now = new Date(),
) {
  const db = env.DB,
    at = now.toISOString();
  const workspaces = (
    await db
      .prepare("SELECT id,timezone,reminder_time FROM workspace_settings")
      .all<ReminderWorkspace>()
  ).results;
  for (const workspace of workspaces) {
    const local = reminderCalendar(now, workspace.timezone),
      dueToday = local.time >= workspace.reminder_time;
    const candidates = (
      await db
        .prepare(
          `SELECT i.id,i.due_date,i.assignee_operator_id,i.status_id
      FROM issues i JOIN teams t ON t.id=i.team_id JOIN workflow_statuses s ON s.id=i.status_id
      WHERE t.workspace_id=? AND i.assignee_operator_id IS NOT NULL AND s.category NOT IN ('completed','canceled','duplicate')
        AND (i.due_date<? OR (i.due_date=? AND ?=1))
        AND NOT EXISTS(SELECT 1 FROM due_reminders r WHERE r.issue_id=i.id AND r.due_date=i.due_date
          AND r.kind=CASE WHEN i.due_date=? THEN 'due_today' ELSE 'overdue' END)
        AND NOT EXISTS(SELECT 1 FROM due_reminder_suppressions r WHERE r.issue_id=i.id AND r.due_date=i.due_date
          AND r.operator_id=i.assignee_operator_id AND r.kind=CASE WHEN i.due_date=? THEN 'due_today' ELSE 'overdue' END)
      ORDER BY i.due_date,i.id`,
        )
        .bind(
          workspace.id,
          local.date,
          local.date,
          dueToday ? 1 : 0,
          local.date,
          local.date,
        )
        .all<ReminderCandidate>()
    ).results;
    for (const candidate of candidates)
      await claimReminder(db, workspace, candidate, local.date, dueToday, at);
  }
}
