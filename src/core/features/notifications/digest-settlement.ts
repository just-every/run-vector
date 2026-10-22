import type { DigestBatch } from './digest-repository';
export async function settleDigest(db: D1Database, batch: DigestBatch, token: string, status: string,
  reason: string|null, next: string|null, at: string, identifiers: string[] = [], deliveryIds?: string[]) {
  await db.batch([
    ...(['accepted','development'].includes(status) ? identifiers.map((identifier,index) => db.prepare(
      `INSERT OR IGNORE INTO notification_mail_audit(id,feature,subject_identifier,outcome,created_at)
       VALUES(?,'notification.mail',?,?,?)`).bind(token+':'+index,identifier,status,at)) : []),
    db.prepare(`UPDATE notification_digest_attempts SET status=?,reason=?,settled_at=? WHERE id=?
      AND EXISTS(SELECT 1 FROM notification_digest_batches WHERE id=? AND claim_token=? AND status IN ('claimed','uncertain'))`)
      .bind(status,reason,at,token,batch.id,token),
    db.prepare(`UPDATE notification_deliveries SET status=CASE WHEN ? IS NULL OR id IN(SELECT value FROM json_each(?)) THEN ? ELSE 'suppressed' END,reason=?,next_attempt_at=?,updated_at=?
      WHERE claim_token=? AND status IN ('claimed','uncertain')
      AND notification_id IN(SELECT notification_id FROM notification_digest_items WHERE batch_id=?)`)
      .bind(deliveryIds ? JSON.stringify(deliveryIds) : null,JSON.stringify(deliveryIds ?? []),status,reason,next,at,token,batch.id),
    db.prepare(`UPDATE notification_digest_batches SET status=?,reason=?,next_attempt_at=?,updated_at=?
      WHERE id=? AND claim_token=? AND status IN ('claimed','uncertain')`).bind(status,reason,next,at,batch.id,token),
  ]);
}
export async function expireDigestClaims(db: D1Database, at: string, before: string) {
  await db.batch([
    db.prepare(`UPDATE notification_digest_attempts SET status='uncertain',reason='claim_interrupted',settled_at=?
      WHERE status='claimed' AND batch_id IN(SELECT id FROM notification_digest_batches WHERE status='claimed' AND claimed_at<?
        AND NOT EXISTS(SELECT 1 FROM notification_digest_items item JOIN notification_deliveries d ON d.notification_id=item.notification_id
          JOIN vector_restore_mail_holds hold ON hold.delivery_id=d.id WHERE item.batch_id=notification_digest_batches.id))`).bind(at,before),
    db.prepare(`UPDATE notification_deliveries SET status='uncertain',reason='claim_interrupted',updated_at=?
      WHERE status='claimed' AND claim_token IN(SELECT claim_token FROM notification_digest_batches WHERE status='claimed' AND claimed_at<?
        AND NOT EXISTS(SELECT 1 FROM notification_digest_items item JOIN notification_deliveries d ON d.notification_id=item.notification_id
          JOIN vector_restore_mail_holds hold ON hold.delivery_id=d.id WHERE item.batch_id=notification_digest_batches.id))`).bind(at,before),
    db.prepare(`UPDATE notification_digest_batches SET status='uncertain',reason='claim_interrupted',updated_at=?
      WHERE status='claimed' AND claimed_at<?
      AND NOT EXISTS(SELECT 1 FROM notification_digest_items item JOIN notification_deliveries d ON d.notification_id=item.notification_id
        JOIN vector_restore_mail_holds hold ON hold.delivery_id=d.id WHERE item.batch_id=notification_digest_batches.id)`).bind(at,before),
  ]);
}
