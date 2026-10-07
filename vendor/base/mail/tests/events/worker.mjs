import { DurableObject } from 'cloudflare:workers';
import { createDeliveryEventIntake, verifyWebhook } from '../../src/events/index.mjs';

// Test fixture entrypoint only. Never mount this controllable route in an app.
export class EventLedger extends DurableObject {
  async consumeFromQueue(batch) {
    const intake = createDeliveryEventIntake({ provider: 'cloudflare', tenantId: 'tenant', eventNamespace: 'domain', storage: this.ctx.storage,
      clock: () => 1_790_000_000_000, authorize: event => event.recipients.every(value => value.endsWith('@example.test')),
      cloudflareSource: { queue: 'mail-events', accountId: 'account', zoneId: 'zone', domain: 'example.test', eventSubscriptionId: 'subscription' } });
    return intake.consumeQueue(batch);
  }
  async fetch(request) {
    const input = await request.json();
    if (input.action === 'list') return Response.json([...await this.ctx.storage.list()]);
    const { config, raw, headers } = input;
    const options = { ...config, storage: this.ctx.storage, clock: () => config.now,
      authorize: event => config.authorize !== false && event.recipients.every(value => value.endsWith('@example.test')) };
    try {
      const intake = createDeliveryEventIntake(options);
      const result = input.action === 'queue'
        ? await intake.consumeQueue({ queue: input.queue, messages: input.events.map(body => ({ body, ack() {}, retry() {} })) })
        : await intake.ingestWebhook({ rawBody: Uint8Array.from(atob(raw), c => c.charCodeAt(0)), headers: new Headers(headers) });
      return Response.json({ result });
    } catch (error) { return Response.json({ code: error.code ?? 'unexpected', message: error.message }, { status: 400 }); }
  }
}
export default {
  async queue(batch, env) {
    const stub = env.LEDGER.get(env.LEDGER.idFromName('/trusted-queue'));
    await stub.consumeFromQueue({ queue: batch.queue, messages: batch.messages.map(({ body }) => ({ body })) });
    batch.ackAll();
  },
  async fetch(request, env) {
    if (new URL(request.url).pathname === '/verify') {
      const input = await request.json();
      return Response.json(await verifyWebhook({ ...input, rawBody: Uint8Array.from(atob(input.raw), c => c.charCodeAt(0)), headers: new Headers(input.headers) }));
    }
    const id = env.LEDGER.idFromName(new URL(request.url).pathname);
    return env.LEDGER.get(id).fetch(request);
  },
};
