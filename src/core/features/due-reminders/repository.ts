import { activeRecipient } from "../notifications/events";
export type ReminderWorkspace = {
  id: string;
  timezone: string;
  reminder_time: string;
};
export type ReminderCandidate = {
  id: string;
  due_date: string;
  assignee_operator_id: string;
  status_id: string;
};
export type ReminderRecipient = {
  id: string;
  timezone: string | null;
  revision: string | null;
  working_hours_start: string;
  working_hours_end: string;
  working_days_json: string;
};
/** The receipt, Inbox and durable feature audit commit together for this claim. */
export async function claimReminder(
  db: D1Database,
  workspace: ReminderWorkspace,
  recipient: ReminderRecipient,
  candidate: ReminderCandidate,
  date: string,
  dueToday: boolean,
  at: string,
) {
  const claim = crypto.randomUUID(),
    kind = candidate.due_date === date ? "due_today" : "overdue";
  const eligible = `FROM issues i JOIN teams t ON t.id=i.team_id JOIN workspace_settings w ON w.id=t.workspace_id
      JOIN workflow_statuses s ON s.id=i.status_id JOIN operators o ON o.id=i.assignee_operator_id AND o.workspace_id=w.id
      LEFT JOIN operator_personal_time p ON p.operator_id=o.id
      WHERE i.id=? AND i.due_date=? AND i.assignee_operator_id=? AND i.status_id=?
        AND w.id=? AND w.timezone=? AND w.reminder_time=? AND ${activeRecipient}
        AND p.timezone IS ? AND COALESCE(p.timezone,w.timezone)=? AND p.revision IS ?
        AND COALESCE(p.working_hours_start,'09:00')=? AND COALESCE(p.working_hours_end,'17:00')=?
        AND COALESCE(p.working_days_json,'[1,2,3,4,5]')=?
        AND s.category NOT IN ('completed','canceled','duplicate')
        AND (i.due_date<? OR (i.due_date=? AND ?=1))
        AND NOT EXISTS(SELECT 1 FROM vector_restore_status WHERE effects_held=1)
        AND NOT EXISTS(SELECT 1 FROM due_reminders r WHERE r.issue_id=i.id AND r.due_date=i.due_date AND r.kind=?)
        AND NOT EXISTS(SELECT 1 FROM due_reminder_suppressions r WHERE r.issue_id=i.id AND r.due_date=i.due_date AND r.kind=? AND r.operator_id=o.id)`;
  const muted = `(EXISTS(SELECT 1 FROM issue_notification_mutes m WHERE m.issue_id=i.id AND m.operator_id=o.id)
        OR EXISTS(SELECT 1 FROM notification_type_mutes m WHERE m.operator_id=o.id AND m.kind='due_reminder'))`;
  const bindings = [
    candidate.id,
    candidate.due_date,
    candidate.assignee_operator_id,
    candidate.status_id,
    workspace.id,
    workspace.timezone,
    workspace.reminder_time,
    recipient.timezone,
    recipient.timezone ?? workspace.timezone,
    recipient.revision,
    recipient.working_hours_start,
    recipient.working_hours_end,
    recipient.working_days_json,
    date,
    date,
    dueToday ? 1 : 0,
    kind,
    kind,
  ];
  await db.batch([
    db
      .prepare(
        `INSERT INTO due_reminder_suppressions(issue_id,due_date,kind,operator_id,created_at)
      SELECT i.id,i.due_date,?,o.id,? ${eligible} AND ${muted}
      ON CONFLICT(issue_id,due_date,kind,operator_id) DO NOTHING`,
      )
      .bind(kind, at, ...bindings),
    db
      .prepare(
        `INSERT INTO due_reminders(issue_id,due_date,kind,claim_id,created_at)
      SELECT i.id,i.due_date,?,?,? ${eligible} AND NOT ${muted}
      ON CONFLICT(issue_id,due_date,kind) DO NOTHING`,
      )
      .bind(kind, claim, at, ...bindings),
    db
      .prepare(
        `INSERT INTO notifications(id,event_id,issue_id,recipient_id,actor_id,actor_name,causes_json,created_at)
      SELECT lower(hex(randomblob(16))),r.claim_id,r.issue_id,i.assignee_operator_id,NULL,'Vector','["due_reminder"]',r.created_at
      FROM due_reminders r JOIN issues i ON i.id=r.issue_id WHERE r.claim_id=?`,
      )
      .bind(claim),
    db
      .prepare(
        `INSERT INTO audit_records(id,actor_operator_id,action,subject_identifier,subject_id,created_at,updated_at)
      SELECT n.event_id,NULL,'due_reminder.delivered',i.identifier,i.id,n.created_at,n.created_at
      FROM notifications n JOIN issues i ON i.id=n.issue_id WHERE n.event_id=?`,
      )
      .bind(claim),
  ]);
}
