import test from 'node:test';
import assert from 'node:assert/strict';
import { createMailSender, MailValidationError } from '../../index.mjs';

const message = () => ({
  deliveryId: 'delivery/orbit/2026-10-06/42',
  from: 'sender@example.com', to: ['recipient@example.net'],
  subject: 'Requested update', text: 'Update contents',
});
const config = { provider: 'sendgrid', mode: 'test', apiKey: 'fixture-key' };
const disabledTracking = {
  click_tracking: { enable: false, enable_text: false },
  open_tracking: { enable: false }, ganalytics: { enable: false },
};

function captureSender(configuration = config) {
  const requests = [];
  const captures = [];
  const sender = createMailSender(configuration, {
    // Transport catches fetch exceptions. Record only here; every assertion and
    // JSON parse runs after send resolves, outside that catch boundary.
    fetch: async (url, init) => {
      requests.push({ url, init });
      return new Response(null, { status: 202, headers: { 'X-Message-Id': 'remote-receipt-72' } });
    },
    outbox: { put: async value => { captures.push(value); } },
  });
  return { sender, requests, captures };
}

async function acceptedWire(input) {
  const { sender, requests, captures } = captureSender();
  const result = await sender.send(input);
  assert.deepEqual(result, {
    provider: 'sendgrid', status: 'accepted', providerMessageId: 'remote-receipt-72',
  });
  assert.equal(requests.length, 1, 'one provider submission');
  assert.deepEqual(captures, [], 'remote send must not capture development mail');
  const [{ url, init }] = requests;
  assert.equal(url, 'https://api.sendgrid.com/v3/mail/send');
  assert.equal(init.method, 'POST');
  assert.equal(init.redirect, 'manual');
  assert.equal(new Headers(init.headers).get('authorization'), 'Bearer fixture-key');
  return JSON.parse(init.body);
}

test('public SendGrid omits absent settings and retains the caller durable ID', async () => {
  for (const deliveryId of ['a', 'delivery/orbit/42', 'd'.repeat(512)]) {
    const wire = await acceptedWire({ ...message(), deliveryId });
    assert.equal(Object.hasOwn(wire, 'asm'), false);
    assert.deepEqual(wire.tracking_settings, disabledTracking);
    assert.deepEqual(wire.custom_args, { rer_delivery_id: deliveryId });
  }
});

for (const asmGroupId of [1, 33984, Number.MAX_SAFE_INTEGER]) {
  test(`public SendGrid preserves positive ASM group ${asmGroupId}`, async () => {
    const wire = await acceptedWire({ ...message(), asmGroupId });
    assert.deepEqual(wire.asm, { group_id: asmGroupId });
    assert.deepEqual(wire.tracking_settings, disabledTracking);
    assert.deepEqual(wire.custom_args, { rer_delivery_id: message().deliveryId });
  });
}

for (const subscriptionTracking of [false, true]) {
  test(`public SendGrid preserves explicit subscription tracking ${subscriptionTracking}`, async () => {
    const wire = await acceptedWire({ ...message(), subscriptionTracking });
    assert.deepEqual(wire.tracking_settings, {
      ...disabledTracking, subscription_tracking: { enable: subscriptionTracking },
    });
  });

  test(`public SendGrid keeps all optional settings through unsubscribe assembly (${subscriptionTracking})`, async () => {
    const input = {
      ...message(), asmGroupId: 582, subscriptionTracking,
      customArgs: { rer_product: 'orbit', campaign: 'customer follow-up / café', empty: '' },
      unsubscribe: { url: 'https://example.com/unsubscribe/42', oneClick: true },
    };
    const before = structuredClone(input);
    const wire = await acceptedWire(input);
    assert.deepEqual(wire.asm, { group_id: 582 });
    assert.deepEqual(wire.custom_args, {
      rer_product: 'orbit', campaign: 'customer follow-up / café', empty: '',
      rer_delivery_id: 'delivery/orbit/2026-10-06/42',
    });
    assert.deepEqual(wire.tracking_settings, {
      ...disabledTracking, subscription_tracking: { enable: subscriptionTracking },
    });
    assert.equal(wire.headers['List-Unsubscribe'], '<https://example.com/unsubscribe/42>');
    assert.equal(wire.headers['List-Unsubscribe-Post'], 'List-Unsubscribe=One-Click');
    assert.deepEqual(input, before, 'submission must not consume caller settings');
  });
}

test('public SendGrid preserves exact product arguments independently of ASM and tracking', async () => {
  const customArgs = { rer_product: 'ferry', command: 'mail/α-17', empty: '' };
  const wire = await acceptedWire({ ...message(), customArgs });
  assert.deepEqual(wire.custom_args, { ...customArgs, rer_delivery_id: message().deliveryId });
  assert.equal(Object.hasOwn(wire, 'asm'), false);
  assert.deepEqual(wire.tracking_settings, disabledTracking);
});

test('public SendGrid accepts exactly 10,000 UTF-8 custom argument bytes including durable ID', async () => {
  const input = message();
  const customArgs = { rer_product: 'orbit', marker: '' };
  const overhead = Buffer.byteLength(JSON.stringify({ ...customArgs, rer_delivery_id: input.deliveryId }));
  customArgs.marker = 'é'.repeat(Math.floor((10000 - overhead) / 2)) + 'x'.repeat((10000 - overhead) % 2);
  const wire = await acceptedWire({ ...input, customArgs });
  assert.deepEqual(wire.custom_args, { ...customArgs, rer_delivery_id: input.deliveryId });
  assert.equal(Buffer.byteLength(JSON.stringify(wire.custom_args)), 10000);
  await rejectsWithoutEffects({ ...input, customArgs: { ...customArgs, marker: customArgs.marker + 'x' } }, 'custom_args_too_large');
});

async function rejectsWithoutEffects(input, code, configuration = config) {
  const { sender, requests, captures } = captureSender(configuration);
  await assert.rejects(sender.send(input), error => error instanceof MailValidationError && error.code === code);
  assert.deepEqual(requests, [], 'invalid settings must not reach a provider');
  assert.deepEqual(captures, [], 'invalid settings must not enter an outbox');
}

test('public SendGrid rejects invalid optional settings before any effect', async () => {
  const invalid = [
    ...[0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, '33984', null].map(asmGroupId => [{ asmGroupId }, 'invalid_asm_group']),
    ...['true', 0, 1, null].map(subscriptionTracking => [{ subscriptionTracking }, 'invalid_subscription_tracking']),
    ...[null, [], 'orbit'].map(customArgs => [{ customArgs }, 'invalid_custom_args']),
    [{ customArgs: { rer_product: 42 } }, 'invalid_custom_arg'],
    [{ customArgs: { 'bad\nkey': 'value' } }, 'invalid_custom_arg'],
    ...['rer_delivery_id', 'email', 'event', 'timestamp', 'sg_event_id', 'sg_message_id']
      .map(key => [{ customArgs: { [key]: 'replacement' } }, 'invalid_custom_arg']),
  ];
  for (const [extra, code] of invalid) await rejectsWithoutEffects({ ...message(), ...extra }, code);
});

test('public remote providers reject unsupported SendGrid settings even when false or empty', async () => {
  for (const provider of ['resend', 'cloudflare']) {
    const configuration = { ...config, provider, ...(provider === 'cloudflare' ? { accountId: 'a'.repeat(32) } : {}) };
    for (const extra of [{ asmGroupId: 1 }, { subscriptionTracking: false }, { subscriptionTracking: true }, { customArgs: {} }, { customArgs: { rer_product: 'orbit' } }]) {
      await rejectsWithoutEffects({ ...message(), ...extra }, 'unsupported_provider_setting', configuration);
    }
  }
});
