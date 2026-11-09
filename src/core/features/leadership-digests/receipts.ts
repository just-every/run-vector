import { leadershipAuthorityStamp } from './admission';
import { effectsAllowed, leadershipRecipient, type LeadershipChannel } from './recipients';
import { leadershipWeekSlot } from '../notifications/digest-calendar';
import { leadershipContent, type DigestSnapshot } from './content';
import type { WorkerBindings } from '../../app/bindings';
export type LeadershipReceipt = {id: string; workspace_id: string; recipient_id: string; slot: string; channel: LeadershipChannel;
  status: string; attempts: number; claim_token: string|null; preference_revision: string; created_at: string; snapshot_json: string};
export const unheldReceipt = `NOT EXISTS(SELECT 1 FROM leadership_digest_restore_holds h WHERE h.receipt_id=leadership_digest_receipts.id)`;
export async function admittedLeadership(env: WorkerBindings, receipt: LeadershipReceipt, now: Date) {
  const person = await leadershipRecipient(env.DB,receipt.recipient_id,receipt.channel);
  if (!person || person.workspace!==receipt.workspace_id || person.revision!==receipt.preference_revision || leadershipWeekSlot(now,person)!==receipt.slot) return null;
  const current = await env.DB.prepare(`SELECT 1 FROM leadership_digest_receipts WHERE id=? AND ${unheldReceipt} AND ${effectsAllowed}
    AND status IN('claimed','retry')`).bind(receipt.id).first();
  if (!current) return null;
  const previous = await env.DB.prepare(`SELECT snapshot_json FROM leadership_digest_receipts WHERE recipient_id=? AND channel=?
    AND status='accepted' AND slot<? ORDER BY slot DESC LIMIT 1`).bind(person.id,receipt.channel,receipt.slot).first<string>('snapshot_json');
  const stamp = await leadershipAuthorityStamp(env.DB,person.id,person.workspace);
  const content = await leadershipContent(env.DB,person.id,person.workspace,env.APP_ORIGIN,now,JSON.parse(previous??'{}') as DigestSnapshot);
  const finalPerson = await leadershipRecipient(env.DB,person.id,receipt.channel);
  if (JSON.stringify(finalPerson)!==JSON.stringify(person) || stamp!==await leadershipAuthorityStamp(env.DB,person.id,person.workspace)) return null;
  return content ? {person,...content} : null;
}
export async function settleLeadership(db: D1Database, receipt: LeadershipReceipt, token: string, status: string, now: Date,
  options: {reason?: string; snapshot?: DigestSnapshot; next?: string} = {}) {
  await db.prepare(`UPDATE leadership_digest_receipts SET status=?,claim_token=NULL,reason=?,next_attempt_at=?,snapshot_json=COALESCE(?,snapshot_json),updated_at=?
    WHERE id=? AND claim_token=? AND status='claimed' AND ${unheldReceipt}`)
    .bind(status,options.reason??null,options.next??null,options.snapshot ? JSON.stringify(options.snapshot) : null,now.toISOString(),receipt.id,token).run();
}
