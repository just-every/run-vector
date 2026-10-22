// @ts-expect-error Base's native ESM facade has no TypeScript declarations.
import { MailValidationError } from '../../../../vendor/base/mail/index.mjs';
import type { WorkerBindings } from '../../app/bindings';
import { notificationEmailAvailable } from './context';
import { CLAIM_TIMEOUT_MS, RETRY_WINDOW_MS, type MailResult } from './mail';
import { notificationSender } from './mail-sender';
import { digestCalendar, digestSlotCutoff } from './digest-calendar';
import { admittedDigest, claimDigest, deferDigest, digestRecipient, effectsAllowed, formDigestBatches, type DigestBatch } from './digest-repository';
import { expireDigestClaims, settleDigest } from './digest-settlement';
export type DigestDependencies = {fetch?: typeof fetch; beforeAdmission?: (batch: DigestBatch) => Promise<void>; afterSubmission?: (batch: DigestBatch,result: MailResult) => Promise<void>};

/** Digest envelopes share Base's mail facade and immediate mail's finite claim policy. */
export async function drainNotificationDigests(env: WorkerBindings, options: {now?: Date; dependencies?: DigestDependencies} = {}) {
  const now = options.now ?? new Date(), at = now.toISOString(), db = env.DB;
  if (!(await db.prepare(`SELECT ${effectsAllowed} allowed`).first<number>('allowed'))) return {processed: 0};
  await expireDigestClaims(db,at,new Date(now.getTime()-CLAIM_TIMEOUT_MS).toISOString());
  await formDigestBatches(db,now);
  const batches = (await db.prepare(`SELECT * FROM notification_digest_batches
    WHERE status='pending' OR (status='retry' AND next_attempt_at<=?) ORDER BY created_at,id`).bind(at).all<DigestBatch>()).results;
  let processed = 0;
  for (const batch of batches) {
    if (processed >= 20) break;
    const observed = await digestRecipient(db,batch.recipient_id);
    const slot = observed && digestCalendar(now,observed,batch.cadence);
    if (!slot) continue;
    const cutoff = digestSlotCutoff(slot,observed!,batch.cadence);
    const lastItem = await db.prepare(`SELECT MAX(d.created_at) at FROM notification_digest_items item
      JOIN notification_deliveries d ON d.notification_id=item.notification_id WHERE item.batch_id=?`).bind(batch.id).first<string>('at');
    if (lastItem && lastItem>cutoff) continue;
    const token = crypto.randomUUID();
    if (!await claimDigest(db,batch,token,at,slot)) continue;
    processed++;
    batch.attempts++;
    batch.status = 'claimed';
    batch.claim_token = token;
    await options.dependencies?.beforeAdmission?.(batch);
    const person = await digestRecipient(db,batch.recipient_id);
    if (!person || digestCalendar(now,person,batch.cadence)!==slot ||
      (lastItem && lastItem>digestSlotCutoff(slot,person,batch.cadence))) {
      await deferDigest(db,batch.id,token,at);
      continue;
    }
    if (batch.attempts > 1 && now.getTime()-Date.parse(batch.created_at)>RETRY_WINDOW_MS) {
      await settleDigest(db,batch,token,'failed','retry_window_exhausted',null,at);
      continue;
    }
    let sender: ReturnType<typeof notificationSender>;
    try { sender = notificationEmailAvailable(env) ? notificationSender(env,options.dependencies?.fetch) : undefined; }
    catch { await settleDigest(db,batch,token,'failed','invalid_mail_configuration',null,at); continue; }
    const message = await admittedDigest(db,batch,token,person);
    if (!message) {
      const changed = await digestRecipient(db,batch.recipient_id);
      if (changed && (changed.revision !== person.revision || changed.timezone !== person.timezone ||
        changed.workingHoursStart !== person.workingHoursStart || changed.workingHoursEnd !== person.workingHoursEnd ||
        JSON.stringify(changed.workingDays) !== JSON.stringify(person.workingDays))) {
        await deferDigest(db,batch.id,token,at);
        continue;
      }
    }
    if (!message || !sender) {
      await settleDigest(db,batch,token,'suppressed','no_longer_eligible',null,at);
      continue;
    }
    const identifiers = JSON.parse(message.identifiers_json) as string[];
    const deliveryIds = JSON.parse(message.delivery_ids_json) as string[];
    let result: MailResult;
    try {
      result = await sender.send({deliveryId: batch.id,from: env.MAIL_FROM!,to: [message.email],subject: message.subject,text: message.text});
    } catch (error) {
      const validation = error instanceof MailValidationError;
      await settleDigest(db,batch,token,validation ? 'failed' : 'uncertain',validation ? 'invalid_mail_message' : 'submission_uncertain',null,at,identifiers,deliveryIds);
      continue;
    }
    await options.dependencies?.afterSubmission?.(batch,result);
    let status: string = result.status, reason: string|null = null, next: string|null = null;
    if (result.status === 'rejected' || result.status === 'rate_limited') {
      const exhausted = batch.attempts>=3 || now.getTime()-Date.parse(batch.created_at)>=RETRY_WINDOW_MS;
      status = exhausted ? 'failed' : 'retry';
      reason = exhausted ? 'retry_exhausted' : result.status === 'rate_limited' ? 'provider_rate_limited' : 'provider_rejected';
      if (!exhausted) next = new Date(now.getTime()+Math.max(batch.attempts===1 ? 60_000 : 300_000,(result.retryAfterSeconds??0)*1000)).toISOString();
    } else if (status === 'uncertain') reason = 'submission_uncertain';
    await settleDigest(db,batch,token,status,reason,next,at,identifiers,deliveryIds);
  }
  return {processed};
}
