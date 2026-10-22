import { visibleRecipient } from '../notifications/events';
import type { WorkerBindings } from '../../app/bindings';

const effectsAllowed = `NOT EXISTS(SELECT 1 FROM vector_restore_status WHERE effects_held=1)
  AND NOT EXISTS(SELECT 1 FROM rer_portability_state WHERE applying=1)`;

/** A claim and its notification commit together. Repeated/concurrent Cron observes the same receipt. */
export async function deliverFollowups(env: WorkerBindings, now: Date) {
  const db = env.DB, at = now.toISOString();
  const dueSnoozes = `SELECT s.notification_id FROM notification_snoozes s
    JOIN issues i ON i.id=s.issue_id JOIN teams t ON t.id=i.team_id
    JOIN operators o ON o.id=s.recipient_id AND o.workspace_id=t.workspace_id
    WHERE s.returned_at IS NULL AND s.until_at<=? AND ${visibleRecipient} AND ${effectsAllowed}`;
  await db.batch([
    db.prepare(`UPDATE notifications SET read_at=NULL WHERE id IN (${dueSnoozes})`).bind(at),
    db.prepare(`UPDATE notification_snoozes SET returned_at=? WHERE notification_id IN (${dueSnoozes})`).bind(at, at),
  ]);
  const claim = crypto.randomUUID();
  await db.batch([
    db.prepare(`UPDATE issue_reminders SET delivered_at=?,delivery_id=?||':'||id WHERE id IN (
      SELECT r.id FROM issue_reminders r JOIN issues i ON i.id=r.issue_id JOIN teams t ON t.id=i.team_id
      JOIN operators o ON o.id=r.recipient_id AND o.workspace_id=t.workspace_id
      WHERE r.delivered_at IS NULL AND r.remind_at<=? AND ${visibleRecipient} AND ${effectsAllowed})`)
      .bind(at, claim, at),
    db.prepare(`INSERT INTO notifications(id,event_id,issue_id,recipient_id,actor_id,actor_name,causes_json,created_at)
      SELECT lower(hex(randomblob(16))),r.delivery_id,r.issue_id,r.recipient_id,NULL,'Vector','["reminder"]',r.delivered_at
      FROM issue_reminders r WHERE r.delivery_id=?||':'||r.id
      AND NOT EXISTS(SELECT 1 FROM issue_notification_mutes m WHERE m.issue_id=r.issue_id AND m.operator_id=r.recipient_id)
      AND NOT EXISTS(SELECT 1 FROM notification_type_mutes m WHERE m.operator_id=r.recipient_id AND m.kind='reminder')`).bind(claim),
    db.prepare(`INSERT INTO audit_records(id,actor_operator_id,action,subject_identifier,subject_id,created_at,updated_at)
      SELECT r.delivery_id,NULL,'personal_reminder.delivered',i.identifier,i.id,r.delivered_at,r.delivered_at
      FROM issue_reminders r JOIN issues i ON i.id=r.issue_id JOIN notifications n ON n.event_id=r.delivery_id AND n.recipient_id=r.recipient_id WHERE r.delivery_id=?||':'||r.id`).bind(claim),
  ]);
}
