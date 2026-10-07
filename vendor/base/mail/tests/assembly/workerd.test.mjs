import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRuntime, request } from './runtime.mjs';
import { signed, sg, resend as event, NOW } from '../events/fixtures.mjs';
import { sendgrid, mimeFixture, expected } from '../inbound/fixtures.mjs';
const wire = input => ({ provider: input.provider, bytes: [...input.rawBody], headers: [...input.headers], key: input.key, now: input.now });
const plain = value => JSON.parse(JSON.stringify(value, (_key, item) => item instanceof Uint8Array ? [...item] : item));

test('complete public facade runs in workerd with real SQLite, email and queue events', async t => {
  const path = await mkdtemp(join(tmpdir(), 'mail-assembly-'));
  let runtime;
  const run = (route, value = {}) => request(runtime, route, value);
  try {
    runtime = await createRuntime(path);
    await t.test('portable facade exposes every documented intake/hydration API', async () => {
      const data = await run('exports');
      assert.deepEqual(data.names, ['MAX_WEBHOOK_BYTES', 'MailValidationError', 'applyUnsubscribeHeaders', 'createDeliveryEventIntake', 'createMailSender', 'createResendAttachmentFetcher', 'mailDoctor', 'normalizeInbound', 'serializeSendGridMessage', 'verifyWebhook']);
      assert.equal(data.max, 32 * 1024 * 1024);
    });
    for (const provider of ['sendgrid', 'resend', 'cloudflare', 'development']) {
      await t.test(`${provider} facade dispatch preserves content and consumes unsubscribe`, async () => {
        const data = await run('sender', { provider });
        assert.equal(data.error, undefined); assert.equal(data.unchanged, true);
        assert.equal(data.result.status, provider === 'development' ? 'development' : 'accepted');
        if (provider === 'development') {
          assert.equal(data.calls.length, 0); assert.equal(data.captured.length, 1);
          const captured = data.captured[0];
          assert.equal(Object.hasOwn(captured, 'unsubscribe'), false);
          assert.deepEqual(captured.attachments[0].content, [0, 255, 128, 10]);
          assert.equal(captured.headers['List-Unsubscribe-Post'], 'List-Unsubscribe=One-Click');
        } else {
          assert.equal(data.calls.length, 1); const call = data.calls[0];
          assert.equal(call.url, provider === 'sendgrid' ? 'https://api.sendgrid.com/v3/mail/send' : provider === 'resend' ? 'https://api.resend.com/emails' : `https://api.cloudflare.com/client/v4/accounts/${'a'.repeat(32)}/email/sending/send`);
          assert.equal(call.method, 'POST'); assert.equal(call.redirect, 'manual'); assert.equal(call.signal, true);
          assert.equal(call.headers.authorization, 'Bearer assembly-fixture-key');
          const body = call.body;
          assert.equal(body.subject, 'Café ✓'); assert.equal(body.attachments[0].content, 'AP+ACg==');
          assert.equal(body.attachments[0].content_id, 'logo');
          assert.equal(body.headers['In-Reply-To'], '<parent@example.test>');
          assert.equal(body.headers.References, '<first@example.test> <parent@example.test>');
          assert.equal(body.headers['List-Unsubscribe'], '<https://example.test/unsubscribe>, <mailto:leave@example.test>');
          assert.equal(body.headers['List-Unsubscribe-Post'], 'List-Unsubscribe=One-Click');
          assert.equal(Object.hasOwn(body, 'unsubscribe'), false);
          if (provider === 'sendgrid') {
            assert.deepEqual(body.personalizations[0], { to: [{ email: 'reader@example.test', name: 'Reader' }], cc: [{ email: 'copy@example.test' }], bcc: [{ email: 'blind@example.test' }] });
            assert.deepEqual(body.from, { email: 'sender@example.test', name: 'Sender' });
            assert.deepEqual(body.reply_to, { email: 'reply@example.test', name: 'Reply' });
            assert.deepEqual(body.content, [{ type: 'text/plain', value: 'Text ✓' }, { type: 'text/html', value: '<p>HTML ✓</p>' }]);
            assert.equal(body.custom_args.rer_delivery_id, 'assembly-1');
          } else {
            assert.deepEqual(body.to, provider === 'cloudflare' ? [{ address: 'reader@example.test', name: 'Reader' }] : ['Reader <reader@example.test>']);
            assert.deepEqual(body.from, provider === 'cloudflare' ? { address: 'sender@example.test', name: 'Sender' } : 'Sender <sender@example.test>');
            assert.deepEqual(body.reply_to, provider === 'cloudflare' ? { address: 'reply@example.test', name: 'Reply' } : 'Reply <reply@example.test>');
            assert.deepEqual(body.cc, ['copy@example.test']); assert.deepEqual(body.bcc, ['blind@example.test']);
            assert.equal(body.text, 'Text ✓'); assert.equal(body.html, '<p>HTML ✓</p>');
          }
          if (provider === 'resend') assert.equal(call.headers['idempotency-key'], 'assembly-1');
        }
        const prepared = await run('sender', { provider, scenario: 'prepared' });
        assert.equal(prepared.result.status, data.result.status);
      });
      await t.test(`${provider} direct calls reject unconsumed unsubscribe before effects`, async () => {
        const data = await run('sender', { provider, scenario: 'direct' });
        assert.equal(data.error.code, provider === 'development' ? 'unsubscribe_not_assembled' : 'unsubscribe_requires_facade');
        assert.equal(data.calls.length, 0); assert.equal(data.captured.length, 0);
      });
      await t.test(`${provider} invalid envelope never dispatches`, async () => {
        const data = await run('sender', { provider, scenario: 'invalid' });
        assert.equal(data.error.code, 'invalid_address'); assert.equal(data.calls.length, 0); assert.equal(data.captured.length, 0);
      });
      if (provider !== 'development') await t.test(`${provider} failures remain single attempts without fallback`, async () => {
        for (const [scenario, status] of [['network', 'uncertain'], ['http-302', 'uncertain'], ['http-408', 'uncertain'], ['http-500', 'uncertain'], ['http-429', 'rate_limited'], ['http-401', 'rejected']]) {
          const data = await run('sender', { provider, scenario });
          assert.equal(data.result.status, status); assert.equal(data.calls.length, 1); assert.equal(data.captured.length, 0);
          assert.doesNotMatch(JSON.stringify(data.result), /PRIVATE/);
        }
      });
    }
    await t.test('Cloudflare partial recipient result survives facade validation', async () => {
      const { result } = await run('sender', { provider: 'cloudflare', scenario: 'partial' });
      assert.equal(result.status, 'uncertain'); assert.equal(result.code, 'cloudflare_partial_recipient_failure');
      assert.deepEqual(result.recipientResults.map(row => row.status), ['accepted', 'accepted', 'rejected']);
    });
    await t.test('doctor resolves real sender facade for all remote providers', async () => {
      for (const provider of ['sendgrid', 'resend', 'cloudflare']) {
        const { result, calls } = await run('doctor', { provider });
        assert.deepEqual(result.items.slice(4).map(row => row.status), ['pass', 'pass']);
        assert.equal(result.items[5].evidence.source, 'resend_received_email_api');
        assert.equal(result.items[4].evidence.correlationId, result.items[5].evidence.correlationId);
        assert.equal(calls.filter(row => row.method === 'POST').length, 1);
        assert.equal(calls.filter(row => row.method === 'GET').length, 2);
        assert.ok(calls.every(row => row.redirect === 'manual'));
        assert.equal(calls[0].authorization, 'Bearer fixture-send');
        assert.ok(calls.slice(1).every(row => row.authorization === 'Bearer fixture-read'));
        assert.doesNotMatch(JSON.stringify(result), /fixture-send|fixture-read|inbox@/);
      }
      const { result, calls } = await run('doctor', { provider: 'resend', missingReceipt: true });
      assert.equal(result.items[4].status, 'pass'); assert.equal(result.items[5].status, 'pending');
      assert.equal(calls.filter(row => row.method === 'POST').length, 1);
    });
    await t.test('actual Routing email event produces normalized MIME and decoded attachment', async () => {
      const response = await runtime.dispatchFetch('https://mail.test/cdn-cgi/local/email?from=sender@example.test&to=receiver@example.test', { method: 'POST', body: mimeFixture() });
      assert.equal(response.status, 200, await response.text());
      const rows = await run('rows');
      assert.deepEqual(rows.find(([key]) => key === 'inbound')[1], plain({ provider: 'cloudflare', ...expected }));
    });
    await t.test('signed multipart and Resend hydration normalize through public APIs only after verification', async () => {
      for (const provider of ['sendgrid', 'resend']) {
        const multipart = sendgrid();
        const input = wire(signed(provider, provider === 'sendgrid' ? multipart.rawBody : JSON.stringify({ type: 'email.received', data: { email_id: 'email-1' } })));
        input.contentType = multipart.contentType;
        const data = await run('inbound', input);
        assert.deepEqual(data.message, plain({ provider, ...expected }));
        assert.equal(data.hydrationCalls, provider === 'resend' ? 3 : 0);
        input.bytes[0] ^= 1;
        assert.deepEqual(await run('inbound', input), { rejected: true, hydrationCalls: 0 });
      }
    });
    await t.test('public event intake persists races, conflicts and state across real runtime restart', async () => {
      const input = wire(signed('resend', JSON.stringify(event())));
      const raced = await Promise.all(Array.from({ length: 6 }, () => run('events', input)));
      assert.equal(raced.filter(row => row.result[0].outcome === 'stored').length, 1);
      assert.equal(raced.filter(row => row.result[0].outcome === 'duplicate').length, 5);
      const sendgridResult = await run('events', wire(signed('sendgrid', JSON.stringify([sg()]))));
      assert.equal(sendgridResult.result[0].outcome, 'stored');
      await runtime.dispose(); runtime = await createRuntime(path);
      assert.equal((await run('events', input)).result[0].outcome, 'duplicate');
      const older = wire(signed('resend', JSON.stringify(event({ type: 'email.sent', created_at: new Date(NOW - 1000).toISOString() })), { id: 'older' }));
      assert.equal((await run('events', older)).result[0].recipients[0].state.status, 'delivered');
      const conflict = wire(signed('resend', JSON.stringify(event({ type: 'email.bounced' }))));
      assert.equal((await run('events', conflict)).code, 'event_identity_conflict');
    });
    await t.test('actual trusted Queue dispatch reaches public intake and SQLite ledger', async () => {
      const producer = await runtime.getQueueProducer('QUEUE');
      await producer.send({ type: 'cf.email.sending.message.delivered', source: { type: 'email.sending', zoneId: 'zone', domain: 'example.test' },
        payload: { eventId: 'assembly-queue', messageId: 'cf-message', recipient: 'reader@example.test', terminal: true, delivery: { status: 'delivered' } },
        metadata: { accountId: 'account', eventSubscriptionId: 'subscription', eventSchemaVersion: 1, eventTimestamp: new Date(NOW).toISOString() } });
      let receipt; const deadline = Date.now() + 5000;
      do {
        receipt = (await run('rows')).find(([key, value]) => key.includes(':receipt:') && value.eventId === 'assembly-queue');
        if (receipt) break;
        await new Promise(resolve => setTimeout(resolve, 20));
      } while (Date.now() < deadline);
      assert.equal(receipt?.[1].status, 'delivered');
    });
  } finally { await runtime?.dispose(); await rm(path, { recursive: true, force: true }); }
});
