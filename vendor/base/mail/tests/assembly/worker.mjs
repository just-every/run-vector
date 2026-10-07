import { DurableObject } from 'cloudflare:workers';
import * as mail from '../../index.mjs';
import { sendScenario } from './sender-fixtures.mjs';
import { doctorScenario } from './doctor-fixture.mjs';
import { limits, resend, attachment } from '../inbound/fixtures.mjs';

const source = { queue: 'assembly-events', accountId: 'account', zoneId: 'zone', domain: 'example.test', eventSubscriptionId: 'subscription' };
export class MailLedger extends DurableObject {
  async storeInbound(value) { await this.ctx.storage.put('inbound', value); }
  async rows() { return [...await this.ctx.storage.list()]; }
  async ingest(input) {
    const intake = mail.createDeliveryEventIntake({ provider: input.provider, tenantId: 'tenant', eventNamespace: 'assembly', key: input.key,
      storage: this.ctx.storage, clock: () => input.now, authorize: event => event.recipients.every(value => value.endsWith('@example.test')),
      ...(input.provider === 'cloudflare' ? { cloudflareSource: source } : {}) });
    return input.provider === 'cloudflare' ? intake.consumeQueue(input.batch) : intake.ingestWebhook({ rawBody: Uint8Array.from(input.bytes), headers: new Headers(input.headers) });
  }
}
function ledger(env) { return env.LEDGER.get(env.LEDGER.idFromName('assembly')); }
async function inbound(input) {
  const rawBody = Uint8Array.from(input.bytes), headers = new Headers(input.headers);
  let hydrationCalls = 0;
  if (!await mail.verifyWebhook({ provider: input.provider, rawBody, headers, key: input.key, now: input.now })) return { rejected: true, hydrationCalls };
  if (input.provider === 'sendgrid') return { message: await mail.normalizeInbound({ provider: 'sendgrid', rawBody, contentType: input.contentType }, limits), hydrationCalls };
  const event = JSON.parse(new TextDecoder().decode(rawBody));
  if (event.type !== 'email.received' || event.data?.email_id !== 'email-1') throw new Error('Invalid signed event');
  const fixture = resend();
  const fetcher = async (url, init) => {
    hydrationCalls++;
    if (init.redirect !== 'manual') throw new Error('Redirects permitted');
    if (url === 'https://api.resend.com/emails/receiving/email-1?html_format=cid') return Response.json(fixture.email);
    if (url === 'https://api.resend.com/emails/receiving/email-1/attachments/attachment-1') return Response.json({ ...fixture.email.attachments[0], download_url: 'https://inbound-cdn.resend.com/email-1/attachments/attachment-1?signature=fixture', expires_at: '2026-10-06T13:00:00Z' });
    if (url === 'https://inbound-cdn.resend.com/email-1/attachments/attachment-1?signature=fixture') {
      if (init.headers) throw new Error('CDN credential leak');
      return new Response(attachment);
    }
    throw new Error('Unexpected provider fixture URL');
  };
  // Test host's authenticated hydration; parser and attachment fetcher are public real implementations.
  const response = await fetcher(`https://api.resend.com/emails/receiving/${event.data.email_id}?html_format=cid`, { redirect: 'manual' });
  const email = await response.json();
  return { message: await mail.normalizeInbound({ provider: 'resend', signedEmailId: event.data.email_id, email,
    fetchAttachment: mail.createResendAttachmentFetcher({ apiKey: 'fixture-read', maxAttachmentBytes: limits.maxAttachmentBytes }, { fetch: fetcher, clock: () => Date.parse('2026-10-06T12:00:00Z') }),
  }, limits), hydrationCalls };
}
const json = value => new Response(JSON.stringify(value, (_key, item) => item instanceof Uint8Array ? [...item] : item), { headers: { 'content-type': 'application/json' } });
export default {
  async email(message, env) { await ledger(env).storeInbound(await mail.normalizeInbound({ provider: 'cloudflare', message }, limits)); },
  async queue(batch, env) { await ledger(env).ingest({ provider: 'cloudflare', now: 1_790_000_000_000, batch: { queue: batch.queue, messages: batch.messages.map(({ body }) => ({ body })) } }); batch.ackAll(); },
  async fetch(request, env) {
    const action = new URL(request.url).pathname.slice(1);
    const input = await request.json();
    if (action === 'exports') return json({ names: Object.keys(mail).sort(), max: mail.MAX_WEBHOOK_BYTES });
    if (action === 'sender') return json(await sendScenario(input.provider, input.scenario));
    if (action === 'doctor') return json(await doctorScenario(input.provider, input.missingReceipt));
    if (action === 'inbound') return json(await inbound(input));
    if (action === 'rows') return json(await ledger(env).rows());
    if (action === 'events') {
      try { return json({ result: await ledger(env).ingest(input) }); }
      catch (error) { return json({ code: error.code }); }
    }
    return new Response('Unknown test route', { status: 404 });
  },
};
