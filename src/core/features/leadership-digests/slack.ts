import type { WorkerBindings } from '../../app/bindings';
import type { WireRequest, WireResponse } from '../../../../vendor/base/integrations';
import { providerSend } from '../integrations/channels/provider';
import { admittedLeadership, type LeadershipReceipt } from './receipts';
import { leadershipDirectBody } from '../integrations/slack-dm/message';
const refused = (): WireResponse => ({status:409,headers:{'vector-dm-refusal':'suppressed'},body:''});
/** Rebuild after opening the DM: a withdrawn membership cannot leak a queued title. */
export async function sendLeadershipDirect(env: WorkerBindings, receipt: LeadershipReceipt, wire: WireRequest, now: Date): Promise<WireResponse> {
  const headers = {...wire.headers}; delete headers['vector-dm-event']; delete headers['vector-dm-at'];
  const first = await admittedLeadership(env,receipt,now);
  if (!first?.person.slackUserId) return refused();
  let opened: WireResponse;
  try { opened = await providerSend({url:'https://slack.com/api/conversations.open',headers,body:JSON.stringify({users:first.person.slackUserId})}); }
  catch { return {status:409,headers:{'vector-dm-refusal':'open_unknown'},body:''}; }
  let channel: string|undefined;
  try { const value=JSON.parse(opened.body); if (opened.status===200 && value.ok===true && /^D[A-Z0-9]{2,30}$/.test(value.channel?.id)) channel=value.channel.id; }
  catch { return {status:409,headers:{'vector-dm-refusal':'open_unknown'},body:''}; }
  if (!channel) return {...opened,headers:{...opened.headers,'vector-dm-stage':'open'}};
  const current = await admittedLeadership(env,receipt,now);
  if (!current || current.person.slackUserId!==first.person.slackUserId) return refused();
  // This is a guarded update of an existing receipt, never an insert after erasure.
  await env.DB.prepare("UPDATE leadership_digest_receipts SET snapshot_json=? WHERE id=? AND status='claimed'")
    .bind(JSON.stringify(current.snapshot),receipt.id).run();
  const final=await admittedLeadership(env,receipt,now);
  if (!final || final.text!==current.text || final.person.slackUserId!==current.person.slackUserId) return refused();
  return providerSend({url:wire.url,headers,body:leadershipDirectBody(channel,current.text)});
}
