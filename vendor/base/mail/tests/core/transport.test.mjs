import test from 'node:test';
import assert from 'node:assert/strict';
import { requestProvider, classifyHttpStatus, safeProviderMessageId, sendResult } from '../../src/core/transport.mjs';

test('status classification conservatively preserves ambiguous attempts', () => {
  for (const status of [0, 101, 301, 302, 307, 308, 408, 500, 503]) assert.equal(classifyHttpStatus(status), 'uncertain');
  for (const status of [400, 401, 403, 404, 409, 422]) assert.equal(classifyHttpStatus(status), 'rejected');
  assert.equal(classifyHttpStatus(429), 'rate_limited');
  for (const status of [200, 202, 204]) assert.equal(classifyHttpStatus(status), null);
});

test('one request forces manual redirects and an abort signal', async () => {
  let calls = 0;
  const response = new Response(null, { status: 302, headers: { location: 'https://untrusted.example' } });
  const result = await requestProvider('https://api.example.test/send', { method: 'POST', body: '{}', redirect: 'follow' }, { fetch: async (url, init) => {
    calls++;
    assert.equal(url, 'https://api.example.test/send');
    assert.equal(init.redirect, 'manual');
    assert.ok(init.signal instanceof AbortSignal);
    return response;
  } });
  assert.equal(result, response);
  assert.equal(calls, 1);
});

test('network failures and malformed transports reveal no secrets or synthetic receipt', async () => {
  let calls = 0;
  assert.equal(await requestProvider('https://api.example.test/send', {}, { fetch() { calls++; throw new Error('SENSITIVE key and body'); } }), null);
  assert.equal(calls, 1);
  assert.equal(await requestProvider('https://api.example.test/send', {}, { fetch: async () => ({ status: 202 }) }), null);
  for (const input of [null, undefined, '', ' \t', 'id\r\ninjected', 'x'.repeat(1025)]) assert.equal(safeProviderMessageId(input), null);
  assert.equal(safeProviderMessageId(' real-id '), 'real-id');
  assert.deepEqual(sendResult('sendgrid', 'uncertain', null, 'transport_uncertain'), { provider: 'sendgrid', status: 'uncertain', providerMessageId: null, code: 'transport_uncertain' });
});
