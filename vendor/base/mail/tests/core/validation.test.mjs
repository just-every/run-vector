import test from 'node:test';
import assert from 'node:assert/strict';
import { validateConfig, validateMessage, parseAddress, validateHeaders, encodeBase64, validateSendResult } from '../../src/core/validation.mjs';
import { MailValidationError } from '../../src/core/errors.mjs';
const message = () => ({ deliveryId: 'command-7', from: 'Équipe <help@example.com>', to: ['reader@example.net'], subject: '', text: 'Hello' });
const rejects = (operation, code) => assert.throws(operation, error => error instanceof MailValidationError && error.code === code && !error.message.includes('SENSITIVE'));

test('explicit provider configuration never falls back to development', () => {
  for (const provider of ['sendgrid', 'resend', 'cloudflare']) {
    rejects(() => validateConfig({ provider, mode: 'production' }), 'api_key_required');
    const config = { provider, mode: 'test', apiKey: 'test-token', ...(provider === 'cloudflare' ? { accountId: 'a'.repeat(32) } : {}) };
    assert.equal(validateConfig(config), config);
  }
  rejects(() => validateConfig({ provider: 'fixture', mode: 'test' }), 'invalid_provider');
  rejects(() => validateConfig({ provider: 'development', mode: 'production' }), 'development_mode_required');
  rejects(() => validateConfig({ provider: 'development', mode: 'development' }), 'development_outbox_required');
  assert.equal(validateConfig({ provider: 'development', mode: 'development' }, { outbox: { async put() {} } }).provider, 'development');
  rejects(() => validateConfig({ provider: 'sendgrid', mode: 'production', apiKey: 'SENSITIVE\r\nInjected:x' }), 'invalid_api_key');
});

test('envelope, threading and binary contents remain intact', () => {
  const input = { ...message(), html: '<p>你好</p>', cc: ['Céline <copy@example.net>'], bcc: ['blind@example.net'], replyTo: 'reply@example.org',
    headers: { 'Message-ID': '<new@example.com>', 'In-Reply-To': '<old@example.com>', References: '<first@example.com> <old@example.com>' },
    attachments: [{ filename: '图.png', contentType: 'image/png', content: Uint8Array.of(0, 255, 128), disposition: 'inline', contentId: 'image-1' }] };
  assert.equal(validateMessage(input, 'sendgrid'), input);
  assert.deepEqual(parseAddress(input.from), { email: 'help@example.com', name: 'Équipe' });
  assert.equal(encodeBase64(input.attachments[0].content), 'AP+A');
  assert.deepEqual(input.headers, { 'Message-ID': '<new@example.com>', 'In-Reply-To': '<old@example.com>', References: '<first@example.com> <old@example.com>' });
});

test('malformed inputs and injection fail before dispatch', () => {
  for (const address of ['victim@example.net\r\nBcc: secret@example.net', 'a@example.net,b@example.net', 'bad..local@example.net', 'x@-bad.example', 'SENSITIVE']) rejects(() => parseAddress(address), 'invalid_address');
  rejects(() => validateMessage({ ...message(), to: [] }), 'invalid_recipients');
  rejects(() => validateMessage({ ...message(), text: undefined }), 'body_required');
  rejects(() => validateMessage({ ...message(), html: false }), 'invalid_body');
  rejects(() => validateMessage({ ...message(), subject: 'SENSITIVE\nBcc' }), 'invalid_subject');
  rejects(() => validateMessage({ ...message(), surprise: true }), 'invalid_message');
  rejects(() => validateHeaders({ 'X-Trace': 'SENSITIVE\nBcc:x' }), 'invalid_header_value');
  rejects(() => validateHeaders({ 'X-Trace': '1', 'x-trace': '2' }), 'reserved_or_duplicate_header');
  rejects(() => validateHeaders({ To: 'other@example.net' }), 'reserved_or_duplicate_header');
  rejects(() => validateHeaders({ 'X Bad': 'x' }), 'invalid_header_name');
});

test('SendGrid custom argument limits count UTF-8 bytes and reserve correlation', () => {
  for (const name of ['rer_delivery_id', 'event', 'email', 'timestamp', 'sg_event_id', 'sg_message_id']) rejects(() => validateMessage({ ...message(), customArgs: { [name]: 'replacement' } }, 'sendgrid'), 'invalid_custom_arg');
  const overhead = new TextEncoder().encode(JSON.stringify({ x: '', rer_delivery_id: 'command-7' })).length;
  const exact = { ...message(), customArgs: { x: 'a'.repeat(10000 - overhead) } };
  assert.equal(validateMessage(exact, 'sendgrid'), exact);
  rejects(() => validateMessage({ ...message(), customArgs: { x: 'a'.repeat(10001 - overhead) } }, 'sendgrid'), 'custom_args_too_large');
  rejects(() => validateMessage({ ...message(), customArgs: { x: '界'.repeat(4000) } }, 'sendgrid'), 'custom_args_too_large');
  rejects(() => validateMessage({ ...message(), asmGroupId: 0 }, 'sendgrid'), 'invalid_asm_group');
  rejects(() => validateMessage({ ...message(), subscriptionTracking: 1 }, 'sendgrid'), 'invalid_subscription_tracking');
  for (const provider of ['resend', 'cloudflare']) for (const setting of [{ customArgs: {} }, { asmGroupId: 1 }, { subscriptionTracking: false }]) rejects(() => validateMessage({ ...message(), ...setting }, provider), 'unsupported_provider_setting');
});

test('attachments and unsubscribe inputs reject unsafe or unsupported shapes', () => {
  for (const attachment of [{ filename: 'x', contentType: 'text/plain', content: 'Zg==' }, { filename: 'x\r\nInjected', contentType: 'text/plain', content: new Uint8Array() }, { filename: 'x', contentType: 'text/plain', content: new Uint8Array(), disposition: 'inline' }]) assert.throws(() => validateMessage({ ...message(), attachments: [attachment] }), MailValidationError);
  for (const url of ['http://example.net/unsubscribe', 'https://user:pass@example.net/u', 'https://example.net/u%0d%0aInjected']) rejects(() => validateMessage({ ...message(), unsubscribe: { url } }), 'invalid_unsubscribe_url');
  const valid = { ...message(), unsubscribe: { url: 'https://example.net/u?a=1', mailto: 'leave@example.net', oneClick: true } };
  assert.equal(validateMessage(valid), valid);
});

test('result contract forbids false remote acceptance and unsafe identifiers', () => {
  const valid = { provider: 'sendgrid', status: 'accepted', providerMessageId: null };
  assert.equal(validateSendResult(valid, 'sendgrid'), valid);
  rejects(() => validateSendResult({ ...valid, provider: 'development' }, 'development'), 'invalid_send_result');
  rejects(() => validateSendResult({ ...valid, status: 'delivered' }, 'sendgrid'), 'invalid_send_result');
  rejects(() => validateSendResult({ ...valid, providerMessageId: 'SENSITIVE\n' }, 'sendgrid'), 'invalid_provider_message_id');
  rejects(() => validateSendResult({ ...valid, recipientResults: [{ recipient: 'a@example.net', status: 'delivered' }] }, 'sendgrid'), 'invalid_recipient_status');
});
