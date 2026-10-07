import test from 'node:test';
import assert from 'node:assert/strict';
import { createMailSender, MailValidationError } from '../../index.mjs';
import { sendResend } from '../../src/adapters/resend/index.mjs';
import { assertResendRequestSize } from '../../src/adapters/resend/size.mjs';

const config = { provider: 'resend', mode: 'test', apiKey: 'size-fixture-key' };
const message = () => ({ deliveryId: 'size-1', from: 's@example.test', to: ['r@example.test'], subject: '', text: 'x' });
const attachment = content => ({ filename: 'part.bin', contentType: 'application/octet-stream', content });
const send = (facade, input, dependencies) => facade
  ? createMailSender(config, dependencies).send(input) : sendResend(config, input, dependencies);

async function refuses(input, facade = false) {
  let calls = 0;
  let writes = 0;
  let encodes = 0;
  let serializations = 0;
  const originalBase64 = globalThis.btoa;
  const originalStringify = JSON.stringify;
  globalThis.btoa = value => { encodes++; return originalBase64(value); };
  JSON.stringify = (value, ...args) => {
    if (value && Object.hasOwn(value, 'from')) serializations++;
    return originalStringify(value, ...args);
  };
  try {
    await assert.rejects(send(facade, input, {
      fetch: async () => { calls++; return Response.json({ id: 'should-not-send' }); },
      outbox: { async put() { writes++; } },
    }), error => {
      assert.ok(error instanceof MailValidationError);
      assert.equal(error.code, 'resend_message_too_large');
      assert.equal(error.message, 'Mail input is invalid; check the error code and module contract.');
      return true;
    });
  } finally {
    globalThis.btoa = originalBase64;
    JSON.stringify = originalStringify;
  }
  assert.deepEqual({ calls, writes, encodes, serializations }, { calls: 0, writes: 0, encodes: 0, serializations: 0 });
}

async function accepts(input, facade = false) {
  let calls = 0;
  let bodyBytes = 0;
  const result = await send(facade, input, { fetch: async (url, init) => {
    calls++;
    assert.equal(url, 'https://api.resend.com/emails');
    assert.equal(init.redirect, 'manual');
    bodyBytes = Buffer.byteLength(init.body, 'utf8');
    assert.ok(bodyBytes <= 39_000_000);
    return Response.json({ id: 'size-receipt' });
  } });
  assert.deepEqual(result, { provider: 'resend', status: 'accepted', providerMessageId: 'size-receipt' });
  assert.equal(calls, 1);
  return bodyBytes;
}

test('41 MiB ASCII is invalid through both public paths with zero effects or encoding', async () => {
  const input = { ...message(), text: 'x'.repeat(41 * 1024 * 1024), attachments: [attachment(Uint8Array.of(1))] };
  await refuses(input);
  await refuses(input, true);
});

test('UTF-8 text, HTML and aggregate alternatives are charged by bytes and transfer encoding', async () => {
  await refuses({ ...message(), text: '界'.repeat(5_000_000) });
  await refuses({ ...message(), text: '', html: '🙂'.repeat(3_300_000) }, true);
  // Each alternative fits alone; their combined Base64 projection does not.
  await refuses({ ...message(), text: 'x'.repeat(15_000_000), html: 'y'.repeat(15_000_000) });
  // Omitted text allows generated plain text; explicit empty text suppresses it.
  await refuses({ ...message(), text: undefined, html: 'x'.repeat(15_000_000) }, true);
  await accepts({ ...message(), text: '', html: 'x'.repeat(15_000_000) }, true);
});

test('all Base64 attachment sizes and body bytes are aggregated before any encoder runs', async () => {
  const half = new Uint8Array(15_000_000);
  await refuses({ ...message(), attachments: [attachment(half), attachment(half)] });
  await refuses({ ...message(), attachments: [attachment(half), attachment(half)] }, true);
  await refuses({ ...message(), text: 'x'.repeat(15_000_000), attachments: [attachment(half)] });
  await refuses({ ...message(), attachments: [attachment(new Uint8Array(30_000_000))] });
});

test('recipient, header and attachment metadata are bounded before wire copies', async () => {
  class NoMapBeforeLimit extends Array {
    map() { assert.fail('oversized recipient metadata must not allocate a mapped wire array'); }
  }
  const cc = new NoMapBeforeLimit(8_000).fill(`${'名'.repeat(900)} <c@example.test>`);
  await refuses({ ...message(), cc });
  const headers = Object.fromEntries(Array.from({ length: 1700 }, (_, i) => [`X-${i}`, '界'.repeat(8192)]));
  await refuses({ ...message(), headers }, true);
  const emptyPart = { ...attachment(new Uint8Array()), filename: '名'.repeat(998) };
  await refuses({ ...message(), attachments: Array(2000).fill(emptyPart) });
});

test('a legal ASCII body at the conservative MIME boundary sends; the next byte fails', async () => {
  // Independent arithmetic from the documented budget: 1 MB reserve, three
  // metadata fields, one 2048-byte part and folded Base64 (dominates ASCII QP).
  const metadata = 6 * (Buffer.byteLength('s@example.test') + Buffer.byteLength('r@example.test')) + 3 * 128;
  const overhead = 1_000_000 + metadata + 2048;
  let low = 0;
  let high = 40_000_000;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    const base64 = 4 * Math.ceil(mid / 3);
    if (overhead + base64 + 2 * Math.ceil(base64 / 76) <= 40_000_000) low = mid;
    else high = mid - 1;
  }
  assert.ok(low > 28_000_000);
  for (const facade of [false, true]) {
    const bytes = await accepts({ ...message(), text: 'x'.repeat(low) }, facade);
    assert.ok(bytes > 28_000_000);
    await refuses({ ...message(), text: 'x'.repeat(low + 1) }, facade);
  }
});

test('Base64 padding, subarray length and metadata affect the attachment boundary', async () => {
  // Many references to a modest source view exercise aggregate expansion without
  // allocating a giant source fixture. Every part still has its own MIME overhead.
  const storage = Uint8Array.from({ length: 1_100_005 }, (_, i) => i % 256);
  const content = storage.subarray(2, 1_000_003);
  const input = { ...message(), attachments: Array.from({ length: 28 }, () => attachment(content)) };
  let calls = 0;
  const result = await sendResend(config, input, { fetch: async (_url, init) => {
    calls++;
    assert.ok(Buffer.byteLength(init.body) < 39_000_000);
    const body = JSON.parse(init.body);
    assert.equal(body.attachments.length, 28);
    assert.equal(body.attachments[27].content.length, 4 * Math.ceil(content.byteLength / 3));
    assert.deepEqual(Buffer.from(body.attachments[0].content, 'base64'), Buffer.from(content));
    return Response.json({ id: 'attachment-boundary' });
  } });
  assert.equal(result.status, 'accepted');
  assert.equal(calls, 1);
  await refuses({ ...input, attachments: [...input.attachments, attachment(content)] });
});

test('JSON escape expansion is budgeted, including lone surrogates and control bytes', async () => {
  for (const text of ['\0'.repeat(6_500_000), '\ud800'.repeat(6_500_000)]) await refuses({ ...message(), text });
  await accepts({ ...message(), text: '\0'.repeat(6_499_000) }, true);
  await accepts({ ...message(), text: 'A🙂界\ud800\udfff\n\t\\"', html: '<b>é</b>' });
});

test('actual serialized UTF-8 size has an inclusive 39 MB hard bound', () => {
  assert.doesNotThrow(() => assertResendRequestSize('x'.repeat(39_000_000)));
  assert.doesNotThrow(() => assertResendRequestSize('界'.repeat(13_000_000)));
  assert.doesNotThrow(() => assertResendRequestSize('🙂'.repeat(9_750_000)));
  for (const body of ['x'.repeat(39_000_001), '界'.repeat(13_000_000) + 'x', '🙂'.repeat(9_750_000) + 'x']) {
    assert.throws(() => assertResendRequestSize(body), { name: 'MailValidationError', code: 'resend_message_too_large' });
  }
});

test('final request guard runs after serialization and before transport', async () => {
  const stringify = JSON.stringify;
  let calls = 0;
  JSON.stringify = (value, ...args) => value && Object.hasOwn(value, 'from')
    ? '界'.repeat(13_000_001) : stringify(value, ...args);
  try {
    await assert.rejects(sendResend(config, message(), {
      fetch: async () => { calls++; return Response.json({ id: 'must-not-send' }); },
    }), { name: 'MailValidationError', code: 'resend_message_too_large' });
  } finally { JSON.stringify = stringify; }
  assert.equal(calls, 0);
});
