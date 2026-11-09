import type { WorkerBindings } from '../../app/bindings';
import { CLAIM_TIMEOUT_MS, RETRY_WINDOW_MS, type MailResult } from '../notifications/mail';
import { notificationSender } from '../notifications/mail-sender';
import { notificationEmailAvailable } from '../notifications/context';
import { leadershipWeekSlot, leadershipWeekIdentity } from '../notifications/digest-calendar';
import { outboundService } from '../integrations/outbound';
import { credentialProblem } from '../integrations/channels/settings';
import { directDestination } from '../integrations/slack-dm/intent';
import { effectsAllowed, leadershipRecipient, recipientInitiatives } from './recipients';
import { admittedLeadership, settleLeadership, unheldReceipt, type LeadershipReceipt } from './receipts';
export type LeadershipDependencies = {fetch?: typeof fetch; beforeAdmission?: (receipt: LeadershipReceipt)=>Promise<void>; afterSubmission?: ()=>Promise<void>};
/** Durable week reservations precede every effect. Unknown transport outcomes never replay. */
export async function sendLeadershipDigests(env: WorkerBindings, now: Date, dependencies: LeadershipDependencies = {}) {
  const db = env.DB, at = now.toISOString();
  if (!await db.prepare(`SELECT ${effectsAllowed} allowed`).first<number>('allowed')) return;
  await db.prepare(`UPDATE leadership_digest_receipts SET status='uncertain',claim_token=NULL,reason='claim_expired',updated_at=?
    WHERE channel='email' AND status='claimed' AND claimed_at<? AND ${unheldReceipt}`)
    .bind(at,new Date(now.getTime()-CLAIM_TIMEOUT_MS).toISOString()).run();
  const people = (await db.prepare(`SELECT o.id,p.email_enabled,p.slack_enabled FROM operators o
    JOIN leadership_digest_preferences p ON p.operator_id=o.id WHERE o.removed_at IS NULL AND (p.email_enabled=1 OR p.slack_enabled=1)`)
    .all<{id: string; email_enabled: number; slack_enabled: number}>()).results;
  for (const row of people) for (const channel of ['email','slack'] as const) {
    if (!row[channel==='email'?'email_enabled':'slack_enabled']) continue;
    const person = await leadershipRecipient(db,row.id,channel), slot = person && leadershipWeekSlot(now,person);
    if (!person || !slot || !(await recipientInitiatives(db,row.id,person.workspace)).length) continue;
    await db.prepare(`INSERT OR IGNORE INTO leadership_digest_receipts
      (id,workspace_id,recipient_id,slot,channel,status,preference_revision,created_at,updated_at)
      SELECT ?,?,?,?,?,'pending',?,?,? WHERE ${effectsAllowed}`)
      .bind('leadership-'+crypto.randomUUID(),person.workspace,person.id,slot,channel,person.revision,at,at).run();
  }
  const due = (await db.prepare(`SELECT * FROM leadership_digest_receipts WHERE ${unheldReceipt}
    AND (status='pending' OR status='claimed' AND channel='slack' OR status='retry' AND next_attempt_at<=?)
    ORDER BY created_at,id`).bind(at).all<LeadershipReceipt>()).results;
  let processed=0;
  for (const receipt of due) {
    if (receipt.channel==='slack' && receipt.status==='claimed' && await reconcileSlack(db,receipt,now)) continue;
    const person = await leadershipRecipient(db,receipt.recipient_id,receipt.channel);
    if (!person || person.revision!==receipt.preference_revision) {
      await db.prepare("UPDATE leadership_digest_receipts SET status='suppressed',reason='no_longer_eligible',updated_at=? WHERE id=? AND status IN('pending','retry','claimed')").bind(at,receipt.id).run(); continue;
    }
    if (leadershipWeekIdentity(now,person)>receipt.slot) {
      await db.prepare("UPDATE leadership_digest_receipts SET status='suppressed',reason='week_expired',claim_token=NULL,updated_at=? WHERE id=? AND status IN('pending','retry','claimed')").bind(at,receipt.id).run();continue;
    }
    if (leadershipWeekSlot(now,person)!==receipt.slot || processed>=20) continue;
    processed++;
    if (receipt.status!=='claimed') {
      const token=crypto.randomUUID();
      const claimed=await db.prepare(`UPDATE leadership_digest_receipts SET status='claimed',claim_token=?,claimed_at=?,attempts=attempts+1,updated_at=?
        WHERE id=? AND (status='pending' OR status='retry' AND next_attempt_at<=?) AND attempts<3 AND ${effectsAllowed} AND ${unheldReceipt}`)
        .bind(token,at,at,receipt.id,at).run();
      if (!claimed.meta.changes) continue;
      receipt.claim_token=token;receipt.status='claimed';receipt.attempts++;
    }
    if (receipt.channel==='slack') { await deliverSlack(env,receipt,now,dependencies); continue; }
    await dependencies.beforeAdmission?.(receipt);
    const content=await admittedLeadership(env,receipt,now);
    if (!content || !notificationEmailAvailable(env)) {
      await settleLeadership(db,receipt,receipt.claim_token!,'suppressed',now,{reason:'no_longer_eligible'}); continue;
    }
    let result: MailResult;
    try { result=await notificationSender(env,dependencies.fetch).send({deliveryId:receipt.id,from:env.MAIL_FROM!,to:[content.person.email],subject:'Weekly leadership digest',text:content.text}); }
    catch { await settleLeadership(db,receipt,receipt.claim_token!,'uncertain',now,{reason:'submission_uncertain'});continue; }
    await dependencies.afterSubmission?.();
    const rejected=result.status==='rejected'||result.status==='rate_limited';
    const exhausted=receipt.attempts>=3||now.getTime()-Date.parse(receipt.created_at)>=RETRY_WINDOW_MS;
    await settleLeadership(db,receipt,receipt.claim_token!,rejected?(exhausted?'failed':'retry'):result.status==='development'?'accepted':result.status,now,
      {snapshot:['accepted','development'].includes(result.status)?content.snapshot:undefined,reason:rejected?'provider_rejected':result.status==='uncertain'?'submission_uncertain':undefined,
       next:rejected&&!exhausted?new Date(now.getTime()+Math.max(receipt.attempts===1?60_000:300_000,(result.retryAfterSeconds??0)*1000)).toISOString():undefined});
  }
}
async function deliverSlack(env: WorkerBindings, receipt: LeadershipReceipt, now: Date, dependencies: LeadershipDependencies) {
  if (await credentialProblem(env,'slack:'+receipt.workspace_id)) return;
  const service=outboundService(env,receipt.workspace_id,()=>now.getTime());
  const existing=await env.DB.prepare('SELECT state FROM integration_deliveries WHERE namespace=? AND id=?').bind(receipt.workspace_id,receipt.id).first<{state:string}>();
  if (!existing) {
    await dependencies.beforeAdmission?.(receipt);
    if (!await admittedLeadership(env,receipt,now)) {
      await settleLeadership(env.DB,receipt,receipt.claim_token!,'suppressed',now,{reason:'no_longer_eligible'});return;
    }
    await service.enqueue({id:receipt.id,tenant:receipt.workspace_id,destinationId:directDestination,event:'leadership.digest',protocol:'slack_dm',body:'{"leadershipDigest":true}'},
      {maxAttempts:3,retryDelaysMs:[60_000,300_000]});
  }
  await service.dispatch(receipt.id);
  await reconcileSlack(env.DB,receipt,now);
}
async function reconcileSlack(db: D1Database, receipt: LeadershipReceipt, now: Date) {
  const result=await db.prepare('SELECT state,attempts FROM integration_deliveries WHERE namespace=? AND id=?')
    .bind(receipt.workspace_id,receipt.id).first<{state:string;attempts:number}>();
  const status=result?.state==='accepted'?'accepted':result?.state==='uncertain'?'uncertain':result?.state==='rejected'?'failed':null;
  if (!status) return false;
  await db.prepare("UPDATE leadership_digest_receipts SET attempts=? WHERE id=? AND claim_token=? AND status='claimed'").bind(result!.attempts,receipt.id,receipt.claim_token).run();
  await settleLeadership(db,receipt,receipt.claim_token!,status,now);
  return true;
}
