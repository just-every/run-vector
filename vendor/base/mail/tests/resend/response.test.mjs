import test from 'node:test';
import assert from 'node:assert/strict';
import { sendResend } from '../../src/adapters/resend/index.mjs';
import { resendResult } from '../../src/adapters/resend/response.mjs';
import { config, receipt, message, providerFixture } from './fixtures.mjs';

async function responseCase(response, status, code) {
  const fixture = providerFixture(response);
  const result = await sendResend(config, message(), fixture);
  assert.deepEqual(result, { provider: 'resend', status, providerMessageId: null, code });
  assert.equal(fixture.calls.length, 1);
  assert.equal(JSON.stringify(result).includes('SENSITIVE'), false);
}

test('only HTTP 200 with a real usable body ID establishes acceptance', async () => {
  for (const data of [null, [], {}, { id: null }, { id: 42 }, { id: '' }, { id: ' ' }, { id: ' padded ' }, { id: 'bad\nvalue' }, { id: 'x'.repeat(1025) }, { data: { id: receipt } }, { id: receipt, error: 'SENSITIVE' }, { id: receipt, name: 'validation_error' }]) {
    await responseCase(Response.json(data), 'uncertain', 'invalid_provider_response');
  }
  for (const body of ['', '{"id":', '<html>SENSITIVE</html>']) await responseCase(new Response(body), 'uncertain', 'invalid_provider_response');
  for (const status of [201, 202, 204, 206, 299]) await responseCase(new Response(status === 204 ? null : JSON.stringify({ id: receipt }), { status }), 'uncertain', 'unexpected_response');
});

test('HTTP failure matrix never reports delivery or follows redirect instructions', async () => {
  for (const status of [301, 302, 303, 307, 308, 408, 500, 502, 503, 504]) {
    await responseCase(new Response('SENSITIVE provider details', { status, headers: { Location: 'https://untrusted.example/steal' } }), 'uncertain', 'unexpected_response');
  }
  for (const status of [400, 401, 403, 404, 413, 422]) await responseCase(new Response('SENSITIVE provider details', { status }), 'rejected', 'provider_rejected');
  await responseCase(new Response('SENSITIVE provider details', { status: 429, headers: { 'Retry-After': '0' } }), 'rate_limited', 'rate_limited');
});

test('idempotency conflicts distinguish payload mismatch from an in-progress request', async () => {
  await responseCase(Response.json({ name: 'invalid_idempotent_request', message: 'SENSITIVE' }, { status: 409 }), 'rejected', 'idempotency_conflict');
  await responseCase(Response.json({ name: 'concurrent_idempotent_requests', message: 'SENSITIVE' }, { status: 409 }), 'uncertain', 'idempotency_in_progress');
  for (const data of [{ name: 'unrecognized', message: 'SENSITIVE' }, {}, { error: { name: 'invalid_idempotent_request' } }]) {
    await responseCase(Response.json(data, { status: 409 }), 'uncertain', 'idempotency_unknown_conflict');
  }
  await responseCase(new Response('SENSITIVE', { status: 409 }), 'uncertain', 'idempotency_unknown_conflict');
});

test('transport interruption and invalid fetch responses remain uncertain without leaking exceptions', async () => {
  for (const operation of [() => { throw new Error('SENSITIVE credentials and body'); }, async () => { throw new Error('SENSITIVE'); }, async () => null, async () => ({ status: 200, id: receipt })]) {
    let calls = 0;
    const result = await sendResend(config, message(), { fetch: (...args) => { calls++; return operation(...args); } });
    assert.deepEqual(result, { provider: 'resend', status: 'uncertain', providerMessageId: null, code: 'transport_error' });
    assert.equal(calls, 1);
  }
});

test('body streaming, UTF-8 errors, transport errors and oversized responses are bounded', async () => {
  const encoded = new TextEncoder().encode(JSON.stringify({ id: receipt }));
  const chunks = new ReadableStream({ start(controller) { for (const byte of encoded) controller.enqueue(Uint8Array.of(byte)); controller.close(); } });
  assert.deepEqual(await sendResend(config, message(), providerFixture(new Response(chunks))), { provider: 'resend', status: 'accepted', providerMessageId: receipt });
  const broken = new ReadableStream({ start(controller) { controller.error(new Error('SENSITIVE')); } });
  await responseCase(new Response(broken), 'uncertain', 'invalid_provider_response');
  await responseCase(new Response(Uint8Array.of(255)), 'uncertain', 'invalid_provider_response');
  let canceled = false;
  const oversized = new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(65537)); }, cancel() { canceled = true; } });
  await responseCase(new Response(oversized), 'uncertain', 'invalid_provider_response');
  assert.equal(canceled, true);
});

test('an unfinished response body times out and its stream is canceled', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let canceled = false;
  const pending = resendResult(new Response(new ReadableStream({ cancel() { canceled = true; } })));
  t.mock.timers.tick(15_000);
  assert.deepEqual(await pending, { provider: 'resend', status: 'uncertain', providerMessageId: null, code: 'invalid_provider_response' });
  assert.equal(canceled, true);
});

test('normal default transport uses global Fetch and the fixed provider URL', async t => {
  const fixture = providerFixture();
  t.mock.method(globalThis, 'fetch', fixture.fetch);
  assert.equal((await sendResend(config, message())).providerMessageId, receipt);
  assert.equal(fixture.calls.length, 1);
  assert.equal(fixture.calls[0].request.url, 'https://api.resend.com/emails');
});

test('fetch that never settles is bounded and never retried', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let calls = 0;
  const pending = sendResend(config, message(), { fetch() { calls++; return new Promise(() => {}); } });
  await Promise.resolve();
  t.mock.timers.tick(15_000);
  assert.deepEqual(await pending, { provider: 'resend', status: 'uncertain', providerMessageId: null, code: 'transport_error' });
  assert.equal(calls, 1);
});

test('a valid response at the exact body byte limit succeeds', async () => {
  const body = JSON.stringify({ id: receipt }).padEnd(65536, ' ');
  assert.equal((await sendResend(config, message(), providerFixture(new Response(body)))).providerMessageId, receipt);
});
