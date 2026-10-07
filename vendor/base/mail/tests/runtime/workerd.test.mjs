import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorker } from './harness.mjs';

const endpoints = {
  sendgrid: 'https://api.sendgrid.com/v3/mail/send', resend: 'https://api.resend.com/emails',
  cloudflare: `https://api.cloudflare.com/client/v4/accounts/${'a'.repeat(32)}/email/sending/send`,
};

test('each real adapter conforms inside workerd against isolated provider fixtures', async (t) => {
  const worker = await createWorker('tests/runtime/provider-worker.mjs', ['index.mjs', 'tests/runtime/provider-fixtures.mjs']);
  async function run(provider, scenario = 'accepted') {
    const response = await worker.dispatchFetch(`https://mail.test/?provider=${provider}&scenario=${scenario}`);
    assert.equal(response.status, 200);
    return response.json();
  }
  try {
    for (const provider of Object.keys(endpoints)) {
      await t.test(`${provider}: envelope, bodies, threading, attachments and unsubscribe`, async () => {
        const { result, calls, error } = await run(provider);
        assert.equal(error, undefined);
        assert.equal(result.status, 'accepted');
        assert.equal(result.provider, provider);
        assert.equal(result.providerMessageId, { sendgrid: 'sg-worker-receipt', resend: 'resend-worker-receipt', cloudflare: 'cf-worker-receipt' }[provider]);
        assert.equal(calls.length, 1);
        const [call] = calls;
        assert.equal(call.url, endpoints[provider]);
        assert.equal(call.method, 'POST');
        assert.equal(call.redirect, 'manual');
        assert.equal(call.signal, true);
        assert.equal(call.headers.authorization, 'Bearer fixture-token');
        assert.match(call.headers['content-type'], /application\/json/);
        const body = call.body;
        assert.equal(body.subject, 'Unicode ✓');
        const headers = Object.fromEntries(Object.entries(body.headers).map(([key, value]) => [key.toLowerCase(), value]));
        assert.equal(headers['in-reply-to'], '<parent@example.com>');
        assert.equal(headers.references, '<first@example.com> <parent@example.com>');
        assert.equal(headers['list-unsubscribe'], '<https://example.com/unsubscribe?id=1>');
        assert.equal(headers['list-unsubscribe-post'], 'List-Unsubscribe=One-Click');
        assert.equal(body.attachments[0].content, 'AP+ACg==');
        assert.equal(body.attachments[0].filename, 'bytes.bin');
        if (provider === 'sendgrid') {
          assert.deepEqual(body.personalizations[0], { to: [{ email: 'reader@example.net' }], cc: [{ email: 'copy@example.net' }], bcc: [{ email: 'blind@example.net' }] });
          assert.deepEqual(body.from, { email: 'sender@example.com', name: 'Sender' });
          assert.deepEqual(body.reply_to, { email: 'replies@example.com' });
          assert.deepEqual(body.content, [{ type: 'text/plain', value: 'Plain body' }, { type: 'text/html', value: '<p>HTML body</p>' }]);
          assert.equal(body.custom_args.rer_delivery_id, 'worker-command-1');
          assert.equal(body.tracking_settings.click_tracking.enable, false);
          assert.equal(body.tracking_settings.open_tracking.enable, false);
        } else {
          assert.deepEqual(body.to, ['reader@example.net']);
          assert.deepEqual(body.cc, ['copy@example.net']);
          assert.deepEqual(body.bcc, ['blind@example.net']);
          assert.equal(body.reply_to, 'replies@example.com');
          assert.equal(body.text, 'Plain body');
          assert.equal(body.html, '<p>HTML body</p>');
        }
        if (provider === 'resend') assert.equal(call.headers['idempotency-key'], 'worker-command-1');
      });
      await t.test(`${provider}: no retries or response-body disclosure`, async () => {
        for (const [scenario, status] of [['network', 'uncertain'], ['http-302', 'uncertain'], ['http-408', 'uncertain'], ['http-500', 'uncertain'], ['http-429', 'rate_limited'], ['http-401', 'rejected']]) {
          const data = await run(provider, scenario);
          assert.equal(data.result?.status, status, `${provider}/${scenario}`);
          assert.equal(data.calls.length, 1);
          assert.equal(JSON.stringify(data.result).includes('TEST SECRET'), false);
        }
      });
      await t.test(`${provider}: invalid envelope produces zero calls`, async () => {
        const data = await run(provider, 'invalid');
        assert.equal(data.calls.length, 0);
        assert.equal(data.error.name, 'MailValidationError');
      });
      if (provider !== 'sendgrid') await t.test(`${provider}: rejects unsupported SendGrid settings`, async () => {
        const data = await run(provider, 'unsupported');
        assert.equal(data.calls.length, 0);
        assert.equal(data.error.code, 'unsupported_provider_setting');
      });
    }
    await t.test('SendGrid accepted receipt can be null; Resend malformed/missing ID is uncertain', async () => {
      assert.equal((await run('sendgrid', 'missing-id')).result.providerMessageId, null);
      assert.equal((await run('sendgrid', 'missing-id')).result.status, 'accepted');
      for (const scenario of ['missing-id', 'malformed']) assert.equal((await run('resend', scenario)).result.status, 'uncertain');
    });
    await t.test('Cloudflare validates success and preserves mixed recipient outcomes', async () => {
      assert.notEqual((await run('cloudflare', 'false-success')).result.status, 'accepted');
      const result = (await run('cloudflare', 'partial')).result;
      assert.deepEqual(result.recipientResults, [{ recipient: 'reader@example.net', status: 'accepted' }, { recipient: 'copy@example.net', status: 'accepted' }, { recipient: 'blind@example.net', status: 'rejected' }]);
    });
  } finally { await worker.dispose(); }
});
