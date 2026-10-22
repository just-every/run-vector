import { activeRecipient } from './events';
import { digestCalendar, digestSlotCutoff, type DigestClock } from './digest-calendar';
export type DigestRecipient = DigestClock & {id: string; workspace: string; revision: string|null; personalTimezone: string|null; workspaceTimezone: string};
export type DigestBatch = {
  id: string; recipient_id: string; workspace_id: string; cadence: 'hourly'|'daily'; slot: string;
  status: string; attempts: number; claim_token: string|null; created_at: string;
};
export const effectsAllowed = `NOT EXISTS(SELECT 1 FROM vector_restore_status WHERE effects_held=1)
  AND NOT EXISTS(SELECT 1 FROM rer_portability_state WHERE applying=1)`;
export async function digestRecipient(db: D1Database, id: string): Promise<DigestRecipient|null> {
  const row = await db.prepare(`SELECT o.id,o.workspace_id workspace,p.revision,p.timezone personalTimezone,w.timezone workspaceTimezone,
    COALESCE(p.timezone,w.timezone) timezone,COALESCE(p.working_hours_start,'09:00') workingHoursStart,
    COALESCE(p.working_hours_end,'17:00') workingHoursEnd,COALESCE(p.working_days_json,'[1,2,3,4,5]') workingDays
    FROM operators o JOIN workspace_settings w ON w.id=o.workspace_id LEFT JOIN operator_personal_time p ON p.operator_id=o.id
    WHERE o.id=? AND ${activeRecipient}`).bind(id).first<Omit<DigestRecipient,'workingDays'> & {workingDays: string}>();
  return row ? {...row,workingDays: JSON.parse(row.workingDays)} : null;
}
export async function formDigestBatches(db: D1Database, now: Date) {
  const recipients = (await db.prepare(`SELECT DISTINCT d.recipient_id FROM notification_deliveries d
    WHERE d.status='pending' AND d.email_mode IN ('hourly','daily')
    AND NOT EXISTS(SELECT 1 FROM notification_digest_items item WHERE item.notification_id=d.notification_id)
    AND ${effectsAllowed}`).all<{recipient_id: string}>()).results;
  for (const {recipient_id} of recipients) {
    const person = await digestRecipient(db,recipient_id);
    if (!person) continue;
    for (const cadence of ['hourly','daily'] as const) {
      const slot = digestCalendar(now,person,cadence);
      if (!slot) continue;
      const cutoff = digestSlotCutoff(slot,person,cadence);
      const id = crypto.randomUUID(), at = now.toISOString();
      const candidates = `SELECT d.notification_id FROM notification_deliveries d
        WHERE d.recipient_id=? AND d.email_mode=? AND d.status='pending' AND d.created_at<=?
        AND NOT EXISTS(SELECT 1 FROM notification_digest_items item WHERE item.notification_id=d.notification_id)
        AND NOT EXISTS(SELECT 1 FROM vector_restore_mail_holds hold WHERE hold.delivery_id=d.id)`;
      await db.batch([
        db.prepare(`INSERT OR IGNORE INTO notification_digest_batches
          (id,workspace_id,recipient_id,cadence,slot,status,created_at,updated_at)
          SELECT ?,?,?,?,?,'pending',?,? WHERE ${effectsAllowed} AND EXISTS(${candidates})
          AND NOT EXISTS(SELECT 1 FROM notification_digest_batches outstanding
            WHERE outstanding.recipient_id=? AND outstanding.cadence=? AND outstanding.status IN ('pending','retry','claimed')
            AND NOT EXISTS(SELECT 1 FROM notification_digest_items historical JOIN notification_deliveries hd ON hd.notification_id=historical.notification_id
              JOIN vector_restore_mail_holds hold ON hold.delivery_id=hd.id WHERE historical.batch_id=outstanding.id))
          AND NOT EXISTS(SELECT 1 FROM notification_digest_windows occupied
            WHERE occupied.workspace_id=? AND occupied.recipient_id=? AND occupied.cadence=? AND occupied.slot=?)`)
          .bind(id,person.workspace,person.id,cadence,slot,at,at,person.id,cadence,cutoff,
            person.id,cadence,person.workspace,person.id,cadence,slot),
        db.prepare(`INSERT OR IGNORE INTO notification_digest_items(notification_id,batch_id)
          SELECT notification_id,? FROM (${candidates}) WHERE EXISTS(SELECT 1 FROM notification_digest_batches WHERE id=? AND status='pending')`)
          .bind(id,person.id,cadence,cutoff,id),
      ]);
    }
  }
}
export async function claimDigest(db: D1Database, batch: DigestBatch, token: string, at: string, slot: string) {
  const claimable = `attempts<3 AND (status='pending' OR (status='retry' AND next_attempt_at<=?)) AND ${effectsAllowed}
    AND NOT EXISTS(SELECT 1 FROM notification_digest_items held JOIN notification_deliveries d ON d.notification_id=held.notification_id
      JOIN vector_restore_mail_holds h ON h.delivery_id=d.id WHERE held.batch_id=notification_digest_batches.id)`;
  const results = await db.batch([
    // A retry may claim a later window, but a different envelope cannot share it.
    // The same envelope may retry within its reserved window after definite rejection.
    db.prepare(`INSERT OR IGNORE INTO notification_digest_windows(workspace_id,recipient_id,cadence,slot,batch_id)
      SELECT workspace_id,recipient_id,cadence,?,id FROM notification_digest_batches WHERE id=? AND ${claimable}`)
      .bind(slot,batch.id,at),
    db.prepare(`UPDATE notification_digest_batches SET status='claimed',claim_token=?,claimed_at=?,attempts=attempts+1,updated_at=?
      WHERE id=? AND ${claimable} AND EXISTS(SELECT 1 FROM notification_digest_windows reserved
        WHERE reserved.workspace_id=notification_digest_batches.workspace_id AND reserved.recipient_id=notification_digest_batches.recipient_id
        AND reserved.cadence=notification_digest_batches.cadence AND reserved.slot=? AND reserved.batch_id=notification_digest_batches.id)`)
      .bind(token,at,at,batch.id,at,slot),
    db.prepare(`INSERT INTO notification_digest_attempts(id,batch_id,number,status,started_at)
      SELECT ?,id,attempts,'claimed',? FROM notification_digest_batches WHERE id=? AND claim_token=? AND status='claimed'`)
      .bind(token,at,batch.id,token),
    db.prepare(`UPDATE notification_deliveries SET status='claimed',claim_token=?,claimed_at=?,attempts=attempts+1,updated_at=?
      WHERE notification_id IN(SELECT notification_id FROM notification_digest_items WHERE batch_id=?) AND status IN ('pending','retry')
      AND EXISTS(SELECT 1 FROM notification_digest_batches WHERE id=? AND claim_token=? AND status='claimed')`)
      .bind(token,at,at,batch.id,batch.id,token),
  ]);
  return Boolean(results[1].meta.changes);
}
/** No provider call occurred; a clock change defers without consuming an attempt. */
export async function deferDigest(db: D1Database, id: string, token: string, at: string) {
  await db.batch([
    db.prepare(`UPDATE notification_deliveries SET status='retry',attempts=attempts-1,next_attempt_at=?,updated_at=?
      WHERE claim_token=? AND status='claimed' AND notification_id IN(SELECT notification_id FROM notification_digest_items WHERE batch_id=?)`).bind(at,at,token,id),
    db.prepare(`DELETE FROM notification_digest_attempts WHERE id=? AND batch_id=? AND status='claimed'`).bind(token,id),
    db.prepare(`UPDATE notification_digest_batches SET status='retry',attempts=attempts-1,next_attempt_at=?,updated_at=?
      WHERE id=? AND claim_token=? AND status='claimed'`).bind(at,at,id,token),
  ]);
}
export type DigestMessage = {delivery_id: string; claim_token: string; email: string; subject: string; text: string; identifiers_json: string; delivery_ids_json: string};
/** Clock and all constituent access/mute/route checks share the last SQL snapshot. */
export async function admittedDigest(db: D1Database, batch: DigestBatch, token: string, person: DigestRecipient) {
  return db.prepare(`SELECT m.* FROM notification_digest_messages m
    JOIN notification_digest_batches b ON b.id=m.delivery_id JOIN operators o ON o.id=b.recipient_id
    JOIN workspace_settings w ON w.id=o.workspace_id LEFT JOIN operator_personal_time p ON p.operator_id=o.id
    WHERE b.id=? AND b.claim_token=? AND p.revision IS ? AND p.timezone IS ? AND w.timezone=?
    AND COALESCE(p.working_hours_start,'09:00')=? AND COALESCE(p.working_hours_end,'17:00')=?
    AND COALESCE(p.working_days_json,'[1,2,3,4,5]')=?`)
    .bind(batch.id,token,person.revision,person.personalTimezone,person.workspaceTimezone,
      person.workingHoursStart,person.workingHoursEnd,JSON.stringify(person.workingDays)).first<DigestMessage>();
}
