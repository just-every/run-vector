import test from 'node:test';
import assert from 'node:assert/strict';
import { sendSendGrid } from '../../src/adapters/sendgrid/index.mjs';
import { config, message } from './conformance.mjs';

test('default fetch uses the same single fixed endpoint and refuses redirect forwarding', async () => {
  const original = globalThis.fetch;
  let calls = 0;
  let forwarded = 0;
  globalThis.fetch = async (url, init) => {
    calls++;
    assert.equal(url, 'https://api.sendgrid.com/v3/mail/send');
    // A redirect-aware fixture exposes any request that allowed automatic forwarding.
    if (init.redirect !== 'manual') forwarded++;
    return new Response('PRIVATE', { status: 307, headers: { location: 'https://untrusted.invalid/capture' } });
  };
  try {
    const result = await sendSendGrid(config, message());
    assert.equal(result.status, 'uncertain');
    assert.equal(result.providerMessageId, null);
    assert.equal(calls, 1);
    assert.equal(forwarded, 0);
  } finally { globalThis.fetch = original; }
});

test('neither acceptance nor rejection consumes the provider body', async () => {
  for (const status of [202, 400, 429, 500]) {
    const response = new Response('PRIVATE recipient metadata', { status });
    const result = await sendSendGrid(config, message(), { fetch: async () => response });
    assert.equal(response.bodyUsed, false);
    assert.ok(!JSON.stringify(result).includes('PRIVATE'));
  }
});

test('unresponsive transport is bounded without retries or provider fallback', { timeout: 20_000 }, async () => {
  let calls = 0;
  let signal;
  const start = performance.now();
  const result = await sendSendGrid(config, message(), { fetch: async (_url, init) => {
    calls++;
    signal = init.signal;
    return new Promise(() => {});
  } });
  assert.equal(result.status, 'uncertain');
  assert.equal(result.providerMessageId, null);
  assert.equal(calls, 1);
  assert.ok(signal instanceof AbortSignal);
  assert.ok(performance.now() - start >= 14_000);
  assert.ok(performance.now() - start < 19_000);
});
