import test from 'node:test';
import assert from 'node:assert/strict';
import { sendResend } from '../../src/adapters/resend/index.mjs';
import { MailValidationError } from '../../src/core/errors.mjs';
import { config, message, providerFixture } from './fixtures.mjs';

async function refuses(input, expectedCode, settings = config) {
  const fixture = providerFixture();
  await assert.rejects(sendResend(settings, input, fixture), error => {
    assert.ok(error instanceof MailValidationError);
    if (expectedCode) assert.equal(error.code, expectedCode);
    assert.equal(error.message.includes('SENSITIVE'), false);
    return true;
  });
  assert.equal(fixture.calls.length, 0);
}

test('standalone validation rejects missing credentials, mismatched providers and endpoint overrides', async () => {
  await refuses(message(), 'api_key_required', { provider: 'resend', mode: 'production' });
  await refuses(message(), 'invalid_provider', { ...config, provider: 'sendgrid' });
  await refuses(message(), 'invalid_config', { ...config, endpoint: 'https://untrusted.example' });
  await refuses(message(), 'invalid_mode', { ...config, mode: undefined });
  await refuses(message(), 'invalid_api_key', { ...config, apiKey: 'SENSITIVE\r\nInjected: x' });
});

test('unsupported requests cannot silently disappear before sending', async () => {
  for (const field of [{ customArgs: {} }, { asmGroupId: 1 }, { subscriptionTracking: false }]) await refuses({ ...message(), ...field }, 'unsupported_provider_setting');
  await refuses({ ...message(), unsubscribe: { url: 'https://example.net/leave' } }, 'unsubscribe_requires_facade');
  await refuses({ ...message(), scheduledAt: '2030-01-01' }, 'invalid_message');
  await refuses({ ...message(), attachments: [{ filename: 'x', contentType: 'text/plain', content: new Uint8Array(), contentId: 'x', disposition: 'attachment' }] }, 'unsupported_resend_attachment_disposition');
  await refuses({ ...message(), attachments: [{ filename: 'x', contentType: 'text/plain', content: new Uint8Array(), disposition: 'inline' }] }, 'inline_content_id_required');
});

test('invalid idempotency keys and recipient limits fail before transport', async () => {
  for (const deliveryId of ['x'.repeat(257), '界', ' padded', 'padded ', 'bad\nkey', '']) await refuses({ ...message(), deliveryId });
  await refuses({ ...message(), to: Array.from({ length: 51 }, (_, i) => `r${i}@example.net`) }, 'resend_recipient_limit');
  await refuses({ ...message(), to: [] }, 'invalid_recipients');
});

test('injection, reserved headers and malformed attachment bytes fail closed', async () => {
  for (const field of ['from', 'replyTo']) await refuses({ ...message(), [field]: 'SENSITIVE@example.net\r\nBcc: victim@example.net' });
  for (const field of ['to', 'cc', 'bcc']) await refuses({ ...message(), [field]: ['SENSITIVE@example.net\nInjected:x'] });
  for (const headers of [
    { 'X-Trace': 'SENSITIVE\r\nBcc:x' }, { 'Bad\nName': 'x' }, { To: 'victim@example.net' },
    { 'X-Trace': '1', 'x-trace': '2' }, { 'Resend-Idempotency-Key': 'other' }, { 'iDeMpOtEnCy-KeY': 'other' },
  ]) await refuses({ ...message(), headers });
  await refuses({ ...message(), subject: 'SENSITIVE\r\nInjected:x' });
  await refuses({ ...message(), text: '', html: undefined }, 'body_required');
  for (const extra of [{ content: 'Zm9v' }, { contentType: 'text/plain\r\nInjected:x' }, { filename: 'SENSITIVE\nname' }, { path: 'https://untrusted.example' }, { disposition: 'inline', contentId: 'bad\nid' }]) {
    await refuses({ ...message(), attachments: [{ filename: 'x.txt', contentType: 'text/plain', content: Uint8Array.of(1), ...extra }] });
  }
});

test('explicit remote configuration remains remote even in development mode', async () => {
  const fixture = providerFixture();
  let writes = 0;
  const result = await sendResend({ ...config, mode: 'development' }, message(), { fetch: fixture.fetch, outbox: { async put() { writes++; } } });
  assert.equal(result.status, 'accepted');
  assert.equal(fixture.calls.length, 1);
  assert.equal(writes, 0);
});

test('every remaining unsubscribe property requires facade assembly', async () => {
  for (const unsubscribe of [undefined, null, { url: 'http://example.net/unsafe' }]) await refuses({ ...message(), unsubscribe }, 'unsubscribe_requires_facade');
});
