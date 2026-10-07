import assert from 'node:assert/strict';
import test from 'node:test';
import { sendCloudflare } from '../../src/adapters/cloudflare/index.mjs';
import { config, message, success, transport } from './fixtures.mjs';

async function denied(input, code, settings = config) {
  const fixture = transport();
  await assert.rejects(sendCloudflare(settings, input, fixture), error => {
    assert.equal(error.name, 'MailValidationError');
    if (code) assert.equal(error.code, code);
    assert.equal(error.message, 'Mail input is invalid; check the error code and module contract.');
    return true;
  });
  assert.equal(fixture.calls.length, 0);
}

test('REST request preserves named envelope, bodies, thread/list headers and binary inline attachments', async () => {
  const headers = {
    'In-Reply-To': '<parent@example.com>', References: '<first@example.com> <parent@example.com>',
    'Thread-Topic': 'An existing thread', 'List-Unsubscribe': '<https://example.com/unsubscribe?id=42>, <mailto:leave@example.com>',
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click', 'X-Trace_ID': 'trace',
  };
  const bytes = new Uint8Array([0, 1, 127, 128, 255]);
  const input = message({
    from: 'Support Team <sender@example.com>', to: ['Alice <a@example.com>'],
    cc: ['CC Person <c@example.com>'], bcc: ['hidden@example.com'],
    replyTo: 'Replies <reply@example.com>', html: '<p>Héllo<img src="cid:logo"></p>', headers,
    attachments: [
      { filename: 'report.bin', contentType: 'application/octet-stream', content: bytes },
      { filename: 'logo.png', contentType: 'image/png', content: bytes.subarray(2), disposition: 'inline', contentId: 'logo' },
    ],
  });
  const snapshot = structuredClone(input);
  const fixture = transport(success({ queued: ['c@example.com', 'hidden@example.com'] }));
  const result = await sendCloudflare(config, input, fixture);
  assert.equal(result.status, 'accepted');
  assert.equal(fixture.calls.length, 1);
  const { url, init } = fixture.calls[0];
  assert.equal(url, `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/email/sending/send`);
  assert.equal(init.method, 'POST');
  assert.equal(init.redirect, 'manual');
  assert.ok(init.signal instanceof AbortSignal);
  assert.deepEqual(init.headers, { Authorization: 'Bearer fixture-token', 'Content-Type': 'application/json' });
  assert.deepEqual(JSON.parse(init.body), {
    from: { address: 'sender@example.com', name: 'Support Team' },
    to: [{ address: 'a@example.com', name: 'Alice' }], subject: 'Hello', text: 'Hello\nWorld',
    html: input.html, headers, cc: [{ address: 'c@example.com', name: 'CC Person' }], bcc: ['hidden@example.com'],
    reply_to: { address: 'reply@example.com', name: 'Replies' },
    attachments: [
      { filename: 'report.bin', type: 'application/octet-stream', content: 'AAF/gP8=', disposition: 'attachment' },
      { filename: 'logo.png', type: 'image/png', content: 'f4D/', disposition: 'inline', content_id: 'logo' },
    ],
  });
  assert.deepEqual(input, snapshot);
  assert.equal(result.providerMessageId, null);
});

test('text-only, HTML-only and optional empty fields retain exact caller content', async () => {
  for (const overrides of [{ html: '<p>Hi</p>', text: undefined }, { text: 'Hi', html: '' }, { subject: '', cc: [], bcc: [], attachments: [] }]) {
    const input = message(overrides);
    const fixture = transport();
    await sendCloudflare(config, input, fixture);
    const body = JSON.parse(fixture.calls[0].init.body);
    for (const field of ['text', 'html', 'subject', 'cc', 'bcc', 'attachments']) assert.deepEqual(body[field], input[field]);
    assert.equal(body.deliveryId, undefined);
  }
});

test('direct calls validate configuration and fixed account path before transport', async () => {
  for (const settings of [
    { ...config, accountId: '../escape' }, { ...config, accountId: 'a'.repeat(33) },
    { ...config, apiKey: 'token\r\nInjected: yes' }, { ...config, apiKey: '' },
    { ...config, mode: undefined }, { ...config, endpoint: 'https://example.com' },
    { provider: 'resend', mode: 'test', apiKey: 'fixture-token' },
  ]) await denied(message(), undefined, settings);
});

test('unsupported requests are explicit before any effect', async () => {
  for (const field of [{ customArgs: {} }, { asmGroupId: 7 }, { subscriptionTracking: false }]) {
    await denied(message(field), 'unsupported_provider_setting');
  }
  await denied(message({ unsubscribe: { url: 'https://example.com/unsubscribe' } }), 'unsubscribe_requires_facade');
  await denied(message({ unsubscribe: undefined }), 'unsubscribe_requires_facade');
  await denied(message({ attachments: [{ filename: 'a', contentType: 'text/plain', content: new Uint8Array(), contentId: 'part' }] }), 'cloudflare_unsupported_attachment_content_id');
  await denied(message({ attachments: [{ filename: 'a', contentType: 'text/plain', content: new Uint8Array(), disposition: 'attachment', contentId: 'part' }] }), 'cloudflare_unsupported_attachment_content_id');
  await denied(message({ unknownFeature: true }), 'invalid_message');
});

test('header and address injection, malformed bodies and attachments cannot cause a send', async () => {
  for (const overrides of [
    { from: 'sender@example.com\nBcc: thief@example.com' }, { to: ['a@example.com\r\nX: y'] },
    { replyTo: 'a@example.com\u0000' }, { subject: 'Hi\nSubject: other' },
    { headers: { 'X-Good': 'a\r\nb' } }, { headers: { 'X\nBad': 'value' } },
    { headers: { 'X-A': 'one', 'x-a': 'two' } }, { to: [] }, { text: '', html: ' ' },
    { attachments: [{ filename: 'a\n', contentType: 'text/plain', content: new Uint8Array() }] },
    { attachments: [{ filename: 'a', contentType: 'text/plain', content: 'not-bytes' }] },
    { attachments: [{ filename: 'a', contentType: 'text/plain', content: new Uint8Array(), disposition: 'inline' }] },
  ]) await denied(message(overrides));
});

test('Cloudflare rejects platform controlled and non-allowlisted headers locally', async () => {
  for (const name of ['Message-ID', 'Date', 'Feedback-ID', 'ARC-Seal', 'TLS-Required', 'CFBL-Address', 'Unrecognized', 'X-Bad!']) {
    await denied(message({ headers: { [name]: 'value' } }), 'cloudflare_unsupported_header');
  }
  for (const name of ['From', 'To', 'Cc', 'Bcc', 'Subject', 'Reply-To', 'Content-Type', 'Return-Path']) {
    await denied(message({ headers: { [name]: 'value' } }), 'reserved_or_duplicate_header');
  }
});

test('Cloudflare enforces byte header limits and value restrictions', async () => {
  await denied(message({ headers: { ['X-' + 'a'.repeat(99)]: 'v' } }), 'cloudflare_invalid_header_name');
  await denied(message({ headers: { 'X-Test': 'é'.repeat(1025) } }), 'cloudflare_invalid_header_value');
  await denied(message({ headers: { 'X-Test': '' } }), 'cloudflare_invalid_header_value');
  await denied(message({ headers: { Importance: 'extreme' } }), 'cloudflare_invalid_header_value');
  await denied(message({ headers: Object.fromEntries(Array.from({ length: 9 }, (_, n) => [`X-${n}`, 'a'.repeat(2048)])) }), 'cloudflare_headers_too_large');
  const fixture = transport();
  await sendCloudflare(config, message({ headers: { 'x-trace': 'é'.repeat(1024), Importance: 'high' } }), fixture);
  assert.equal(fixture.calls.length, 1);
});

test('raw list headers obey HTTPS, mailto and exact one-click pairing', async () => {
  for (const headers of [
    { 'List-Unsubscribe': '<http://example.com/u>' }, { 'List-Unsubscribe': 'https://example.com/u' },
    { 'List-Unsubscribe': '<https://user:pass@example.com/u>' },
    { 'List-Unsubscribe': '<https://example.com/%0d%0aInjected>' },
    { 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
    { 'List-Unsubscribe': '<mailto:leave@example.com>', 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
    { 'List-Unsubscribe': '<https://example.com/u>', 'List-Unsubscribe-Post': 'List-Unsubscribe=one-click' },
  ]) await denied(message({ headers }), 'cloudflare_invalid_unsubscribe_header');
});

test('oversized serialized payload is rejected before effects', async () => {
  await denied(message({ text: 'a'.repeat(5 * 1024 * 1024) }), 'cloudflare_message_too_large');
});

test('total header byte boundary is exact, and twenty standard headers are the maximum', async () => {
  // Eight X headers: 8 * (name bytes 3 + framing 4) + value bytes = 16 KiB.
  const headers = Object.fromEntries(Array.from({ length: 8 }, (_, n) => [`X-${n}`, 'a'.repeat(n === 7 ? 1992 : 2048)]));
  const fixture = transport();
  await sendCloudflare(config, message({ headers }), fixture);
  assert.equal(fixture.calls.length, 1);
  await denied(message({ headers: { ...headers, 'X-7': headers['X-7'] + 'a' } }), 'cloudflare_headers_too_large');
  const names = ['In-Reply-To', 'References', 'Thread-Index', 'Thread-Topic', 'List-Id', 'List-Archive', 'List-Help', 'List-Owner', 'List-Post', 'List-Subscribe', 'Content-Language', 'Keywords', 'Comments', 'Organization', 'Require-Recipient-Valid-Since', 'Expires', 'Reply-By', 'Archived-At'];
  const twenty = { ...Object.fromEntries(names.map(name => [name, 'value'])), Importance: 'normal', Priority: 'normal' };
  const accepted = transport();
  await sendCloudflare(config, message({ headers: twenty }), accepted);
  assert.equal(accepted.calls.length, 1);
  await denied(message({ headers: { ...twenty, Sensitivity: 'private' } }), 'cloudflare_headers_too_large');
});
