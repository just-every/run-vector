import test from 'node:test';
import assert from 'node:assert/strict';
import { sendSendGrid, serializeSendGridMessage } from '../../src/adapters/sendgrid/index.mjs';
import { MailValidationError } from '../../src/core/errors.mjs';
import { message, config } from './conformance.mjs';

const badMessages = [
  ['no recipients', { to: [] }], ['address injection', { from: 'bad\r\nBcc: private@example.net' }],
  ['recipient injection', { cc: ['good@example.net\nBcc: bad@example.net'] }], ['reply injection', { replyTo: 'bad\0@example.net' }],
  ['invalid recipients', { bcc: 'person@example.net' }], ['missing body', { text: undefined, html: undefined }],
  ['empty supplied part', { text: '' }], ['empty subject', { subject: '' }], ['subject injection', { subject: 'hello\r\nX-Secret: value' }],
  ['bad id', { deliveryId: '\nsecret' }], ['id bound', { deliveryId: 'x'.repeat(513) }],
  ['provider field', { templateId: 'd-unsupported' }], ['raw provider setting', { tracking_settings: {} }],
  ['header injection', { headers: { 'X-Test': 'value\r\nBcc: other@example.net' } }],
  ['duplicate header', { headers: { References: 'one', references: 'two' } }], ['reserved header', { headers: { 'X-SG-ID': 'fake' } }],
  ['header name', { headers: { 'Bad:Name': 'value' } }], ['no silent unsubscribe', { unsubscribe: { url: 'https://example.org/unsubscribe' } }],
  ['not assembled by having a header', { unsubscribe: { url: 'https://example.org/unsubscribe' }, headers: { 'List-Unsubscribe': '<https://example.org/unsubscribe>' } }],
  ['ASM zero', { asmGroupId: 0 }], ['ASM fraction', { asmGroupId: 2.5 }], ['ASM unsafe', { asmGroupId: Number.MAX_SAFE_INTEGER + 1 }],
  ['tracking must be boolean', { subscriptionTracking: 'true' }], ['non-string arg', { customArgs: { number: 4 } }],
  ['arg key injection', { customArgs: { 'foo\n': 'value' } }], ['duplicate recipient', { bcc: ['Ada <ADA@example.net>'] }],
  ['Unicode sender mailbox', { from: 'sénd@example.org' }],
];
for (const reserved of ['rer_delivery_id', 'email', 'event', 'timestamp', 'sg_event_id', 'sg_message_id']) {
  badMessages.push([`reserved arg ${reserved}`, { customArgs: { [reserved]: 'replace' } }]);
}
for (const attachment of [
  { filename: 'bytes.bin', contentType: 'application/octet-stream', content: 'not bytes' },
  { filename: 'bytes.bin', contentType: 'application/octet-stream', content: new Uint8Array() },
  { filename: 'bytes.bin', contentType: 'application/octet-stream', content: Uint8Array.of(1), disposition: 'inline' },
  { filename: 'bytes.bin', contentType: 'application/octet-stream', content: Uint8Array.of(1), contentId: '<bad>' },
  { filename: 'bytes.bin', contentType: 'application/octet-stream', content: Uint8Array.of(1), extra: true },
  { filename: 'bad\nname', contentType: 'application/octet-stream', content: Uint8Array.of(1) },
  { filename: 'bytes.bin', contentType: 'text/plain\r\nX-Other: value', content: Uint8Array.of(1) },
]) badMessages.push(['invalid attachment', { attachments: [attachment] }]);

test('direct send and serializer reject unsupported/invalid inputs before effects', async () => {
  let calls = 0;
  for (const [label, patch] of badMessages) {
    const input = { ...message(), ...patch };
    assert.throws(() => serializeSendGridMessage(input), MailValidationError, label);
    await assert.rejects(sendSendGrid(config, input, { fetch: async () => { calls++; throw new Error('PRIVATE'); } }), MailValidationError, label);
  }
  assert.equal(calls, 0);
});

test('configuration never permits endpoint overrides, missing credentials or provider fallback', async () => {
  let calls = 0;
  const invalidConfigs = [null, {}, { ...config, provider: 'resend' }, { ...config, mode: undefined }, { ...config, apiKey: '' },
    { ...config, apiKey: 'secret\r\nX-Extra: leak' }, { ...config, endpoint: 'https://other.invalid/collect' },
    { ...config, accountId: 'unused' }, { ...config, provider: 'development', mode: 'development', apiKey: undefined }];
  for (const invalid of invalidConfigs) {
    await assert.rejects(sendSendGrid(invalid, message(), { fetch: async () => { calls++; return new Response(null, { status: 202 }); } }), MailValidationError);
  }
  assert.equal(calls, 0);
  await assert.rejects(sendSendGrid(config, message(), { fetch: 'not a function' }), { code: 'invalid_fetch' });
});

test('recipient and payload allocation bounds apply before transport', async () => {
  let calls = 0;
  const dependencies = { fetch: async () => { calls++; return new Response(null, { status: 202 }); } };
  const input = { ...message(), to: Array.from({ length: 998 }, (_, index) => `person${index}@example.net`) };
  assert.equal((await sendSendGrid(config, input, dependencies)).status, 'accepted');
  await assert.rejects(sendSendGrid(config, { ...input, to: [...input.to, 'overflow@example.net'] }, dependencies), { code: 'sendgrid_too_many_recipients' });
  for (const patch of [
    { text: 'x'.repeat(30_000_000) },
    { attachments: [{ filename: 'large.bin', contentType: 'application/octet-stream', content: new Uint8Array(22_500_000) }] },
    { attachments: Array.from({ length: 1001 }, () => message().attachments[0]) },
    { customArgs: { huge: 'x'.repeat(10001) } },
  ]) await assert.rejects(sendSendGrid(config, { ...message(), ...patch }, dependencies), MailValidationError);
  assert.equal(calls, 1);
});

test('unexpected input exceptions are fixed and redacted', async () => {
  const input = message();
  Object.defineProperty(input, 'text', { get() { throw new Error('PRIVATE content or key'); } });
  assert.throws(() => serializeSendGridMessage(input), error => error instanceof MailValidationError && !String(error).includes('PRIVATE'));
  await assert.rejects(sendSendGrid(config, input), error => error instanceof MailValidationError && !String(error).includes('PRIVATE'));
});

test('large binary attachment is encoded completely using Web Platform base64', () => {
  const bytes = Uint8Array.from({ length: 24_581 }, (_, index) => index % 256);
  const wire = JSON.parse(serializeSendGridMessage({ ...message(), attachments: [{ filename: 'many.bin', contentType: 'application/octet-stream', content: bytes }] }));
  const decoded = Uint8Array.from(atob(wire.attachments[0].content), character => character.charCodeAt(0));
  assert.deepEqual(decoded, bytes);
});
