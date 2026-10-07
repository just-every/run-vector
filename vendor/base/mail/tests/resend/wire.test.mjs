import test from 'node:test';
import assert from 'node:assert/strict';
import { sendResend } from '../../src/adapters/resend/index.mjs';
import { config, receipt, message, providerFixture } from './fixtures.mjs';

test('official endpoint, auth, exact wire schema, threading and bytes', async () => {
  const input = { ...message(), html: '<p>你好<img src="cid:logo-1"></p>',
    cc: ['copy@example.org'], bcc: ['Private <blind@example.org>'], replyTo: 'Replies <reply@example.com>',
    headers: { 'Message-ID': '<new@example.com>', 'In-Reply-To': '<old@example.com>', References: '<first@example.com> <old@example.com>', 'X-Case': '42',
      'List-Unsubscribe': '<https://example.com/unsubscribe/42>', 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
    attachments: [
      { filename: 'binary.dat', contentType: 'application/octet-stream', content: Uint8Array.of(0, 255, 128, 13, 10), disposition: 'attachment' },
      { filename: '标志.png', contentType: 'image/png', content: Uint8Array.of(137, 80, 78, 71), disposition: 'inline', contentId: 'logo-1' },
    ],
  };
  const original = structuredClone(input);
  const fixture = providerFixture();
  assert.deepEqual(await sendResend(config, input, fixture), { provider: 'resend', status: 'accepted', providerMessageId: receipt });
  assert.deepEqual(input, original);
  assert.equal(fixture.calls.length, 1);
  const { request, body, init } = fixture.calls[0];
  assert.equal(request.url, 'https://api.resend.com/emails');
  assert.equal(request.method, 'POST');
  assert.equal(request.headers.get('authorization'), 'Bearer fixture-token');
  assert.equal(request.headers.get('content-type'), 'application/json');
  assert.equal(request.headers.get('idempotency-key'), input.deliveryId);
  assert.equal(init.redirect, 'manual');
  assert.ok(init.signal instanceof AbortSignal);
  const expected = {
    from: input.from, to: input.to, subject: input.subject, text: input.text, html: input.html,
    cc: input.cc, bcc: input.bcc, reply_to: input.replyTo, headers: input.headers,
    attachments: [
      { filename: 'binary.dat', content: 'AP+ADQo=', content_type: 'application/octet-stream' },
      { filename: '标志.png', content: 'iVBORw==', content_type: 'image/png', content_id: 'logo-1' },
    ],
  };
  assert.equal(body, JSON.stringify(expected));
  assert.deepEqual(JSON.parse(body), expected);
  for (let i = 0; i < expected.attachments.length; i++) assert.deepEqual(new Uint8Array(Buffer.from(expected.attachments[i].content, 'base64')), input.attachments[i].content);
});

test('HTML-only, explicit empty text, empty subject and omitted options retain distinct semantics', async () => {
  for (const text of [undefined, '']) {
    const fixture = providerFixture();
    const input = { ...message(), text, html: '<p>Hello</p>', subject: '' };
    await sendResend(config, input, fixture);
    const body = JSON.parse(fixture.calls[0].body);
    assert.deepEqual(body, { from: input.from, to: input.to, subject: '', ...(text === undefined ? {} : { text }), html: input.html });
  }
});

test('display name punctuation remains inside one mailbox and contentId implies inline', async () => {
  const fixture = providerFixture();
  await sendResend(config, { ...message(), from: 'Doe, Jane <jane@example.com>', replyTo: 'Team: Help <help@example.com>',
    attachments: [{ filename: 'image.png', contentType: 'image/png', content: new Uint8Array(), contentId: 'logo' }],
  }, fixture);
  const body = JSON.parse(fixture.calls[0].body);
  assert.equal(body.from, '"Doe, Jane" <jane@example.com>');
  assert.equal(body.reply_to, '"Team: Help" <help@example.com>');
  assert.deepEqual(body.attachments, [{ filename: 'image.png', content: '', content_type: 'image/png', content_id: 'logo' }]);
});

test('256-character key and 50 to-recipients reach the provider without mutation', async () => {
  const fixture = providerFixture();
  const input = { ...message(), deliveryId: 'x'.repeat(256), to: Array.from({ length: 50 }, (_, i) => `reader${i}@example.net`) };
  await sendResend(config, input, fixture);
  assert.equal(fixture.calls[0].request.headers.get('idempotency-key'), input.deliveryId);
  assert.deepEqual(JSON.parse(fixture.calls[0].body).to, input.to);
});

test('same caller key and body remain identical across explicit caller submissions', async () => {
  const fixture = providerFixture();
  const input = message();
  await sendResend(config, input, fixture);
  await sendResend(config, input, fixture);
  assert.equal(fixture.calls.length, 2);
  assert.equal(fixture.calls[0].body, fixture.calls[1].body);
  assert.equal(fixture.calls[0].request.headers.get('idempotency-key'), fixture.calls[1].request.headers.get('idempotency-key'));
});

test('binary subarrays serialize only their selected bytes across encoder chunk boundaries', async () => {
  const storage = Uint8Array.from({ length: 17000 }, (_, i) => i % 256);
  const content = storage.subarray(37, 16937);
  const fixture = providerFixture();
  await sendResend(config, { ...message(), attachments: [{ filename: 'segment.bin', contentType: 'application/octet-stream', content }] }, fixture);
  const attachment = JSON.parse(fixture.calls[0].body).attachments[0];
  assert.deepEqual(new Uint8Array(Buffer.from(attachment.content, 'base64')), content);
  assert.equal(storage.byteLength, 17000);
});
