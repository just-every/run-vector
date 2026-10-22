import { visibleTeam } from '../roles/visibility-sql';
import { reminderCalendar } from "./calendar";
import { activeRecipient } from "../notifications/events";
import {
  claimReminder,
  type ReminderCandidate,
  type ReminderWorkspace,
  type ReminderRecipient,
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
    const recipients = (
      await db
        .prepare(
          `SELECT o.id,p.timezone,p.revision,
      COALESCE(p.working_hours_start,'09:00') working_hours_start,
      COALESCE(p.working_hours_end,'17:00') working_hours_end,
      COALESCE(p.working_days_json,'[1,2,3,4,5]') working_days_json
      FROM operators o LEFT JOIN operator_personal_time p ON p.operator_id=o.id
      WHERE o.workspace_id=? AND ${activeRecipient}
      AND EXISTS(SELECT 1 FROM issues i WHERE i.assignee_operator_id=o.id AND i.due_date IS NOT NULL AND ${visibleTeam('o','i.team_id')})`,
        )
        .bind(workspace.id)
        .all<ReminderRecipient>()
    ).results;
    for (const recipient of recipients) {
      const local = reminderCalendar(
          now,
          recipient.timezone ?? workspace.timezone,
        ),
        dueToday = local.time >= workspace.reminder_time;
      const candidates = (
        await db
          .prepare(
            `SELECT i.id,i.due_date,i.assignee_operator_id,i.status_id
      FROM issues i JOIN teams t ON t.id=i.team_id JOIN workflow_statuses s ON s.id=i.status_id
      WHERE t.workspace_id=? AND i.assignee_operator_id=? AND s.category NOT IN ('completed','canceled','duplicate')
        AND (i.due_date<? OR (i.due_date=? AND ?=1))
        AND NOT EXISTS(SELECT 1 FROM due_reminders r WHERE r.issue_id=i.id AND r.due_date=i.due_date
          AND r.kind=CASE WHEN i.due_date=? THEN 'due_today' ELSE 'overdue' END)
        AND NOT EXISTS(SELECT 1 FROM due_reminder_suppressions r WHERE r.issue_id=i.id AND r.due_date=i.due_date
          AND r.operator_id=i.assignee_operator_id AND r.kind=CASE WHEN i.due_date=? THEN 'due_today' ELSE 'overdue' END)
      ORDER BY i.due_date,i.id`,
          )
          .bind(
            workspace.id,
            recipient.id,
            local.date,
            local.date,
            dueToday ? 1 : 0,
            local.date,
            local.date,
          )
          .all<ReminderCandidate>()
      ).results;
      for (const candidate of candidates)
        await claimReminder(
          db,
          workspace,
          recipient,
          candidate,
          local.date,
          dueToday,
          at,
        );
    }
  }
}
