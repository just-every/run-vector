import { mutationDatabase } from '../auth/mutation-database';
import { requireIssueAccess } from '../issues/access';
import { SettingsError } from '../settings/repository';

export function futureInstant(value: string) {
  const at = new Date(value);
  if (!Number.isFinite(at.getTime()) || at.getTime() <= Date.now())
    throw new SettingsError('invalid_time', 'Choose a future time.', 400);
  return at.toISOString();
}

export async function snooze(db: D1Database, actor: string, id: string, values: { until?: string; untilChange?: true }) {
  db = mutationDatabase(db, actor);
  const until = values.until ? futureInstant(values.until) : null;
  const result = await db.prepare(`INSERT INTO notification_snoozes
    (notification_id,issue_id,recipient_id,until_at,until_change,snoozed_at,returned_at)
    SELECT n.id,n.issue_id,n.recipient_id,?,?,?,NULL
    FROM notifications n JOIN issues i ON i.id=n.issue_id JOIN teams t ON t.id=i.team_id
    JOIN operators o ON o.id=n.recipient_id AND o.workspace_id=t.workspace_id
    WHERE n.id=? AND n.recipient_id=? AND o.removed_at IS NULL
    ON CONFLICT(notification_id) DO UPDATE SET until_at=excluded.until_at,until_change=excluded.until_change,
    snoozed_at=excluded.snoozed_at,returned_at=NULL
    RETURNING notification_id`).bind(until, values.untilChange ? 1 : 0, new Date().toISOString(), id, actor).all();
  if (result.results.length !== 1) throw new SettingsError('not_found', 'Notification is unavailable.', 404);
}

export async function unsnooze(db: D1Database, actor: string, id: string) {
  db = mutationDatabase(db, actor);
  const at = new Date().toISOString();
  const result = await db.batch([
    db.prepare(`UPDATE notifications SET read_at=NULL WHERE id=? AND recipient_id=?
      AND EXISTS(SELECT 1 FROM notification_snoozes s WHERE s.notification_id=notifications.id AND s.returned_at IS NULL)`)
      .bind(id, actor),
    db.prepare(`UPDATE notification_snoozes SET returned_at=? WHERE notification_id=? AND recipient_id=? AND returned_at IS NULL
      AND EXISTS(SELECT 1 FROM notifications n WHERE n.id=notification_snoozes.notification_id) RETURNING notification_id`)
      .bind(at, id, actor),
  ]);
  if (result[1].results.length !== 1) throw new SettingsError('not_found', 'Snoozed notification is unavailable.', 404);
}

export async function reminders(db: D1Database, actor: string, identifier: string) {
  const issue = await requireIssueAccess(db, identifier, actor);
  const rows = await db.prepare(`SELECT id,remind_at remindAt,created_at createdAt FROM issue_reminders
    WHERE issue_id=? AND recipient_id=? AND delivered_at IS NULL ORDER BY remind_at,id`).bind(issue.id, actor).all();
  await requireIssueAccess(db, identifier, actor);
  return { reminders: rows.results };
}

export async function createReminder(db: D1Database, actor: string, identifier: string, remindAt: string) {
  db = mutationDatabase(db, actor);
  const issue = await requireIssueAccess(db, identifier, actor), at = futureInstant(remindAt);
  await db.prepare(`INSERT INTO issue_reminders(id,issue_id,recipient_id,remind_at,created_at)
    SELECT lower(hex(randomblob(16))),i.id,o.id,?,? FROM issues i JOIN teams t ON t.id=i.team_id
    JOIN operators o ON o.workspace_id=t.workspace_id WHERE i.id=? AND o.id=? AND o.removed_at IS NULL`)
    .bind(at, new Date().toISOString(), issue.id, actor).run();
  return reminders(db, actor, identifier);
}

export async function cancelReminder(db: D1Database, actor: string, identifier: string, id: string) {
  db = mutationDatabase(db, actor);
  const issue = await requireIssueAccess(db, identifier, actor);
  const result = await db.prepare(`DELETE FROM issue_reminders WHERE id=? AND issue_id=? AND recipient_id=? AND delivered_at IS NULL
    AND EXISTS(SELECT 1 FROM issues i WHERE i.id=issue_reminders.issue_id) RETURNING id`)
    .bind(id, issue.id, actor).all();
  if (result.results.length !== 1) throw new SettingsError('not_found', 'Reminder is unavailable.', 404);
  return reminders(db, actor, identifier);
}
