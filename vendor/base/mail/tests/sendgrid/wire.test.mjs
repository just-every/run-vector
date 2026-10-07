import test from 'node:test';
import assert from 'node:assert/strict';
import { runSendGridConformance, message, config } from './conformance.mjs';
import { sendSendGrid, serializeSendGridMessage } from '../../src/adapters/sendgrid/index.mjs';

test('portable SendGrid wire, receipt and transport conformance', runSendGridConformance);

test('text-only and HTML-only bodies remain exact; omitted settings are omitted', () => {
  for (const field of ['text', 'html']) {
    const input = { deliveryId: 'minimal', from: 'from@example.com', to: ['to@example.net'], subject: 'Subject', [field]: 'Contents ✓' };
    const wire = JSON.parse(serializeSendGridMessage(input));
    assert.deepEqual(wire.content, [{ type: `text/${field === 'text' ? 'plain' : 'html'}`, value: input[field] }]);
    assert.equal(wire.asm, undefined);
    assert.equal(wire.tracking_settings.subscription_tracking, undefined);
    assert.deepEqual(wire.custom_args, { rer_delivery_id: 'minimal' });
  }
  const wire = JSON.parse(serializeSendGridMessage({ ...message(), subscriptionTracking: false }));
  assert.deepEqual(wire.tracking_settings.subscription_tracking, { enable: false });
});

test('preassembled unsubscribe and thread headers are serialized verbatim', () => {
  const headers = { ...message().headers, 'List-Unsubscribe': '<https://example.org/unsubscribe>, <mailto:unsubscribe@example.org>', 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' };
  assert.deepEqual(JSON.parse(serializeSendGridMessage({ ...message(), headers })).headers, headers);
});

test('null-prototype custom arguments and exact 10,000 byte limit preserve reserved correlation', () => {
  const input = message();
  const args = Object.create(null);
  args.marker = '';
  const overhead = new TextEncoder().encode(JSON.stringify({ marker: '', rer_delivery_id: input.deliveryId })).byteLength;
  args.marker = 'é'.repeat(Math.floor((10000 - overhead) / 2));
  if ((10000 - overhead) % 2) args.marker += 'a';
  const custom = JSON.parse(serializeSendGridMessage({ ...input, customArgs: args })).custom_args;
  assert.equal(new TextEncoder().encode(JSON.stringify(custom)).byteLength, 10000);
  assert.equal(custom.marker, args.marker);
  assert.throws(() => serializeSendGridMessage({ ...input, customArgs: { marker: `${args.marker}a` } }), { code: 'custom_args_too_large' });
});

test('remote test and development modes always use configured provider', async () => {
  for (const mode of ['test', 'development', 'production']) {
    let calls = 0;
    let outboxWrites = 0;
    const result = await sendSendGrid({ ...config, mode }, message(), { fetch: async () => { calls++; return new Response(null, { status: 202 }); }, outbox: { put: async () => { outboxWrites++; } } });
    assert.equal(result.status, 'accepted');
    assert.equal(calls, 1);
    assert.equal(outboxWrites, 0);
  }
});

test('many small custom arguments retain the original aggregate byte guarantee', () => {
  const customArgs = Object.fromEntries(Array.from({ length: 1001 }, (_, index) => [String.fromCodePoint(0x400 + index), '']));
  const wire = JSON.parse(serializeSendGridMessage({ ...message(), customArgs }));
  assert.deepEqual(wire.custom_args, { ...customArgs, rer_delivery_id: message().deliveryId });
});
