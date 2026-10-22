import type { WorkerBindings } from '../../app/bindings';
/** An interrupted claim may already have reached SendGrid. Recovery records the
 * uncertainty and never resends; restore must quarantine these tables as well. */
export async function settleInterruptedEmailIntake(env: WorkerBindings, now = new Date()) {
  const before = new Date(now.getTime() - 5 * 60 * 1000).toISOString(), at = now.toISOString();
  await env.DB.batch([
    env.DB.prepare(`UPDATE intake_email_deliveries SET status='uncertain',error='submission_interrupted',updated_at=?
      WHERE status='processing' AND updated_at<? AND NOT EXISTS(SELECT 1 FROM vector_http_restore)`).bind(at,before),
    env.DB.prepare(`UPDATE intake_email_messages SET status='failed',error='receipt_interrupted',updated_at=?
      WHERE status='processing' AND updated_at<? AND NOT EXISTS(SELECT 1 FROM vector_http_restore)`).bind(at,before),
  ]);
}
