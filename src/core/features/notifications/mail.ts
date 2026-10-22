import { notificationSender } from './mail-sender';
import { routePendingNotifications } from './channel-intents';
import seed from "../../../../seed.json";
// Pinned Base owns transport serialization, validation and single submission.
// @ts-expect-error Base's native ESM facade has no TypeScript declarations.
import * as baseMail from "../../../../vendor/base/mail/index.mjs";
const { MailValidationError } = baseMail;
import type { WorkerBindings } from "../../app/bindings";
import { notificationEmailAvailable } from "./context";
export type Delivery = {
  id: string;
  notification_id: string;
  recipient_id: string;
  actor_id: string | null;
  actor_name: string | null;
  identifier: string;
  title: string;
  app_link: string;
  status: string;
  attempts: number;
  claim_token: string | null;
  created_at: string;
  email: string;
};
export type MailResult = {
  status:
    "accepted" | "development" | "uncertain" | "rejected" | "rate_limited";
  code?: string;
  retryAfterSeconds?: number;
};
export type MailDependencies = {
  fetch?: typeof fetch;
  beforeAdmission?: (delivery: Delivery) => Promise<void>;
  afterSubmission?: (delivery: Delivery, result: MailResult) => Promise<void>;
};
export const CLAIM_TIMEOUT_MS = 5 * 60_000;
export const RETRY_WINDOW_MS = 24 * 60 * 60_000;
type AdmittedDelivery = Delivery & { assignment: number; mention: number; message_text: string; message_subject: string };
/** Existing single-event rendering helper remains source-compatible for erasure snapshots. */
export function notificationMessage(env: WorkerBindings, delivery: Delivery & {assignment: number; mention: number}) {
  const reason = delivery.assignment && delivery.mention
    ? "This issue was assigned to you, and you were mentioned."
    : delivery.assignment ? "This issue was assigned to you." : "You were mentioned on this issue.";
  return {deliveryId: delivery.id,from: env.MAIL_FROM!,to: [delivery.email],
    subject: `${delivery.identifier}: ${delivery.title}`,
    text: `${delivery.identifier}: ${delivery.title}\n${reason}\nBy: ${delivery.actor_name ?? "Vector"}\n\n${delivery.app_link}\nSign in to view this issue.`};
}
/** Current recipient and issue authority, independent of the actor's old session. */
async function admitted(
  env: WorkerBindings,
  id: string,
  token: string,
): Promise<AdmittedDelivery | null> {
  if (!notificationEmailAvailable(env)) return null;
  const row = await env.DB.prepare(`SELECT d.*,m.email,m.text message_text,m.subject message_subject,
    m.assignment,m.mention,m.actor_name current_actor_name FROM notification_deliveries d
    JOIN notification_mail_messages m ON m.delivery_id=d.id AND m.claim_token=d.claim_token
    WHERE d.id=? AND d.claim_token=? AND d.email_mode='immediate'
    AND NOT EXISTS(SELECT 1 FROM notification_digest_items item WHERE item.notification_id=d.notification_id)`)
    .bind(id,token).first<AdmittedDelivery & {current_actor_name: string|null}>();
  return row ? {...row,actor_name:row.current_actor_name} : null;
}
async function settle(
  env: WorkerBindings,
  delivery: Delivery,
  token: string,
  status: string,
  reason: string | null,
  next: string | null,
  now: string,
) {
  await env.DB.batch([
    ...(status === "accepted" || status === "development"
      ? [
          env.DB.prepare(
            // Base's result survives erasure of its addressed state. Retain only
            // the admitted identifier and opaque attempt key, never its payload.
            `INSERT OR IGNORE INTO notification_mail_audit(id,feature,subject_identifier,outcome,created_at)
      VALUES (?,'notification.mail',?,?,?)`,
          ).bind(token, delivery.identifier, status, now),
        ]
      : []),
    env.DB.prepare(
      `UPDATE notification_delivery_attempts SET status=?,reason=?,settled_at=?
      WHERE id=? AND EXISTS(SELECT 1 FROM notification_deliveries WHERE id=? AND claim_token=? AND status IN ('claimed','uncertain'))`,
    ).bind(status, reason, now, token, delivery.id, token),
    env.DB.prepare(
      `UPDATE notification_deliveries SET status=?,reason=?,next_attempt_at=?,updated_at=?
      WHERE id=? AND claim_token=? AND status IN ('claimed','uncertain')`,
    ).bind(status, reason, next, now, delivery.id, token),
  ]);
}
/** Immediate event fan-out is bounded by operator capacity; Cron claims 20. Only Cron retries definitive rejections. */
export async function drainNotificationMail(
  env: WorkerBindings,
  options: {
    scheduled?: boolean;
    now?: Date;
    dependencies?: MailDependencies;
    limit?: number;
    eventIds?: string[];
  } = {},
) {
  const now = options.now ?? new Date(),
    at = now.toISOString(),
    db = env.DB;
  if (await db.prepare('SELECT id FROM vector_restore_status WHERE effects_held=1').first()) return {processed:0};
  await routePendingNotifications(env,options.eventIds);
  if (options.scheduled)
    await db.batch([
      db
        .prepare(
          `UPDATE notification_delivery_attempts SET status='uncertain',reason='claim_interrupted',settled_at=? WHERE status='claimed'
      AND delivery_id IN(SELECT id FROM notification_deliveries WHERE email_mode='immediate' AND status='claimed' AND claimed_at<? AND NOT EXISTS(SELECT 1 FROM vector_restore_mail_holds h WHERE h.delivery_id=notification_deliveries.id))`,
        )
        .bind(at, new Date(now.getTime() - CLAIM_TIMEOUT_MS).toISOString()),
      db
        .prepare(
          `UPDATE notification_deliveries SET status='uncertain',reason='claim_interrupted',updated_at=? WHERE email_mode='immediate' AND status='claimed' AND claimed_at<? AND NOT EXISTS(SELECT 1 FROM vector_restore_mail_holds h WHERE h.delivery_id=notification_deliveries.id)`,
        )
        .bind(at, new Date(now.getTime() - CLAIM_TIMEOUT_MS).toISOString()),
    ]);
  const rows = (
    await db
      .prepare(
        `SELECT id FROM notification_deliveries WHERE email_mode='immediate' AND NOT EXISTS(SELECT 1 FROM vector_restore_mail_holds h WHERE h.delivery_id=notification_deliveries.id) AND (status='pending' ${options.scheduled ? "OR (status='retry' AND next_attempt_at<=?)" : ""})
    ${options.eventIds ? "AND notification_id IN(SELECT n.id FROM notifications n JOIN notification_events e ON e.event_id=n.event_id WHERE n.event_id IN(SELECT value FROM json_each(?)))" : ""} ORDER BY created_at,id LIMIT ?`,
      )
      .bind(
        ...(options.scheduled ? [at] : []),
        ...(options.eventIds ? [JSON.stringify(options.eventIds)] : []),
        options.eventIds
          ? seed.limits.operators
          : Math.min(options.limit ?? 20, 20),
      )
      .all<{ id: string }>()
  ).results;
  let processed = 0;
  for (const { id } of rows) {
    const token = crypto.randomUUID();
    const results = await db.batch([
      db
        .prepare(
          `UPDATE notification_deliveries SET status='claimed',claim_token=?,claimed_at=?,attempts=attempts+1,updated_at=?
        WHERE id=? AND email_mode='immediate' AND attempts<3 AND NOT EXISTS(SELECT 1 FROM vector_restore_status WHERE effects_held=1) AND NOT EXISTS(SELECT 1 FROM vector_restore_mail_holds h WHERE h.delivery_id=notification_deliveries.id) AND (status='pending' ${options.scheduled ? "OR (status='retry' AND next_attempt_at<=?)" : ""})`,
        )
        .bind(token, at, at, id, ...(options.scheduled ? [at] : [])),
      db
        .prepare(
          `INSERT INTO notification_delivery_attempts(id,delivery_id,number,status,started_at)
        SELECT ?,id,attempts,'claimed',? FROM notification_deliveries WHERE id=? AND claim_token=? AND status='claimed'`,
        )
        .bind(token, at, id, token),
    ]);
    if (!results[0].meta.changes) continue;
    processed++;
    const claimed = await db
      .prepare(
        "SELECT d.*,o.email FROM notification_deliveries d JOIN operators o ON o.id=d.recipient_id WHERE d.id=? AND d.claim_token=?",
      )
      .bind(id, token)
      .first<Delivery>();
    if (!claimed) continue;
    await options.dependencies?.beforeAdmission?.(claimed);
    if (
      claimed.attempts > 1 &&
      now.getTime() - Date.parse(claimed.created_at) > RETRY_WINDOW_MS
    ) {
      await settle(
        env,
        claimed,
        token,
        "failed",
        "retry_window_exhausted",
        null,
        at,
      );
      continue;
    }
    // Construct the facade before final admission. From admission's resolution to
    // send invocation there is no hook, timer, or intervening asynchronous await.
    let sender: ReturnType<typeof notificationSender> | undefined | null;
    try {
      sender = notificationEmailAvailable(env)
        ? notificationSender(env, options.dependencies?.fetch)
        : null;
    } catch {
      await settle(
        env,
        claimed,
        token,
        "failed",
        "invalid_mail_configuration",
        null,
        at,
      );
      continue;
    }
    const delivery = await admitted(env, id, token);
    if (!delivery || !sender) {
      await settle(
        env,
        claimed,
        token,
        "suppressed",
        "no_longer_eligible",
        null,
        at,
      );
      continue;
    }
    let result: MailResult;
    try {
      result = await sender.send({deliveryId: delivery.id,from: env.MAIL_FROM!,to: [delivery.email],
        subject: delivery.message_subject,text: delivery.message_text});
    } catch (error) {
      // Validation failures are definitely local. Development persistence errors
      // and unknown exceptions may have accepted a submission: never replay.
      const validation = error instanceof MailValidationError;
      await settle(
        env,
        delivery,
        token,
        validation ? "failed" : "uncertain",
        validation ? "invalid_mail_message" : "submission_uncertain",
        null,
        at,
      );
      continue;
    }
    await options.dependencies?.afterSubmission?.(delivery, result);
    let status: string = result.status,
      reason: string | null = null,
      next: string | null = null;
    if (result.status === "rejected" || result.status === "rate_limited") {
      const exhausted =
        delivery.attempts >= 3 ||
        now.getTime() - Date.parse(delivery.created_at) >= RETRY_WINDOW_MS;
      status = exhausted ? "failed" : "retry";
      reason = exhausted
        ? "retry_exhausted"
        : result.status === "rate_limited"
          ? "provider_rate_limited"
          : "provider_rejected";
      if (!exhausted)
        next = new Date(
          now.getTime() + Math.max(delivery.attempts === 1 ? 60_000 : 5 * 60_000,
            (result.retryAfterSeconds ?? 0) * 1000),
        ).toISOString();
    } else if (status === "uncertain") reason = "submission_uncertain";
    // If this batch fails, the durable claim remains. Cron marks it uncertain;
    // neither the request nor recovery can submit that claim a second time.
    await settle(env, delivery, token, status, reason, next, at);
  }
  return { processed };
}
