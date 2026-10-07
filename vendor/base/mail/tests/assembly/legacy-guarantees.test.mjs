import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { createMailSender, MailValidationError, serializeSendGridMessage } from '../../index.mjs';
const message = () => ({ from: 'Support <support@example.com>', to: ['person@example.com'], subject: 'Your request', text: 'Reply', html: '<p>Reply</p>', deliveryId: 'durable-1' });
const sender = fetch => createMailSender({ provider: 'sendgrid', mode: 'test', apiKey: 'fixture-key' }, { fetch });

test('absorbed SendGrid authenticated wire retains correlation, attachments and disabled tracking', async () => {
  let calls = 0;
  const input = { ...message(), replyTo: 'reply@example.com', headers: { 'In-Reply-To': '<first@example.com>' },
    attachments: [{ content: Uint8Array.of(104, 105), filename: 'proof.txt', contentType: 'text/plain' }] };
  const result = await sender(async (url, init) => {
    calls++; assert.equal(url, 'https://api.sendgrid.com/v3/mail/send');
    assert.equal(new Headers(init.headers).get('authorization'), 'Bearer fixture-key'); assert.equal(init.redirect, 'manual');
    const body = JSON.parse(init.body);
    assert.deepEqual(body.from, { name: 'Support', email: 'support@example.com' });
    assert.deepEqual(body.personalizations, [{ to: [{ email: 'person@example.com' }] }]);
    assert.deepEqual(body.custom_args, { rer_delivery_id: 'durable-1' });
    assert.deepEqual(body.reply_to, { email: 'reply@example.com' });
    assert.deepEqual(body.attachments[0], { content: 'aGk=', filename: 'proof.txt', type: 'text/plain', disposition: 'attachment' });
    assert.deepEqual(body.tracking_settings, { click_tracking: { enable: false, enable_text: false }, open_tracking: { enable: false }, ganalytics: { enable: false } });
    assert.equal(init.body, serializeSendGridMessage({ ...input, headers: { ...input.headers } }));
    return new Response(null, { status: 202, headers: { 'X-Message-Id': 'provider-receipt' } });
  }).send(input);
  assert.deepEqual(result, { provider: 'sendgrid', providerMessageId: 'provider-receipt', status: 'accepted' }); assert.equal(calls, 1);
});

test('absorbed uncertain submissions make one attempt and retain the structured uncertain result', async () => {
  for (const status of [null, 500, 408, 200]) {
    let calls = 0;
    const result = await sender(async () => { calls++; if (status === null) throw new Error('PRIVATE'); return new Response(null, { status }); }).send(message());
    assert.equal(result.status, 'uncertain'); assert.equal(calls, 1); assert.equal(result.providerMessageId, null);
  }
});

test('absorbed rejection and rate limiting remain distinct and never disclose provider bodies', async () => {
  for (const [status, outcome] of [[400, 'rejected'], [401, 'rejected'], [429, 'rate_limited']]) {
    const response = new Response('PRIVATE provider body', { status });
    const result = await sender(async () => response).send(message());
    assert.equal(result.status, outcome); assert.doesNotMatch(JSON.stringify(result), /PRIVATE/); assert.equal(response.bodyUsed, false);
  }
});

test('absorbed invalid recipients and reserved headers reject before provider effects', async () => {
  for (const extra of [{ to: [] }, { to: ['bad\r\n@example.com'] }, { headers: { From: 'other@example.com' } }]) {
    let calls = 0;
    await assert.rejects(sender(async () => { calls++; throw new Error('must not send'); }).send({ ...message(), ...extra }), MailValidationError);
    assert.equal(calls, 0);
  }
});

test('absorbed ASM, subscription tracking and product correlation preserve their exact meaning', async () => {
  const input = { ...message(), asmGroupId: 33984, subscriptionTracking: true, customArgs: { rer_product: 'orbit' } };
  await sender(async (_url, init) => {
    const body = JSON.parse(init.body);
    assert.deepEqual(body.asm, { group_id: 33984 }); assert.deepEqual(body.custom_args, { rer_product: 'orbit', rer_delivery_id: 'durable-1' });
    assert.deepEqual(body.tracking_settings.subscription_tracking, { enable: true });
    assert.equal(body.tracking_settings.open_tracking.enable, false); assert.equal(body.tracking_settings.click_tracking.enable, false);
    return new Response(null, { status: 202 });
  }).send(input);
});

test('absorbed invalid ASM and reserved/oversized custom arguments reject before effects', async () => {
  for (const extra of [{ asmGroupId: 0 }, { asmGroupId: 1.5 }, { customArgs: { rer_delivery_id: 'override' } }, { customArgs: { metadata: 'x'.repeat(10001) } }]) {
    let calls = 0;
    await assert.rejects(sender(async () => { calls++; throw new Error('must not send'); }).send({ ...message(), ...extra }), MailValidationError);
    assert.equal(calls, 0);
  }
});

async function localServer(handler) {
  const server = createServer(handler); server.listen(0, '127.0.0.1'); await once(server, 'listening');
  return { server, url: `http://127.0.0.1:${server.address().port}/send` };
}
async function close(server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }

test('absorbed native fetch refuses every redirect without forwarding mail or credentials', async () => {
  let destinationCalls = 0, providerCalls = 0, status = 307;
  const destination = await localServer((_request, response) => { destinationCalls++; response.writeHead(202).end(); });
  const provider = await localServer((request, response) => { providerCalls++; request.resume(); response.writeHead(status, { location: destination.url }).end(); });
  try {
    assert.equal((await fetch(provider.url, { method: 'POST', body: 'canary' })).status, 202); assert.equal(destinationCalls, 1);
    destinationCalls = 0; providerCalls = 0;
    for (status of [301, 302, 303, 307, 308]) {
      const result = await sender((url, init) => { assert.equal(url, 'https://api.sendgrid.com/v3/mail/send'); return fetch(provider.url, init); }).send(message());
      assert.equal(result.status, 'uncertain');
    }
    assert.equal(providerCalls, 5); assert.equal(destinationCalls, 0);
  } finally { await Promise.all([close(provider.server), close(destination.server)]); }
});

test('absorbed HTTP 202 without provider receipt remains accepted with null evidence', async () => {
  for (const headers of [{}, { 'x-message-id': '   ' }]) {
    let calls = 0;
    const result = await sender(async () => { calls++; return new Response(null, { status: 202, headers }); }).send(message());
    assert.deepEqual(result, { provider: 'sendgrid', status: 'accepted', providerMessageId: null }); assert.equal(calls, 1);
  }
});

test('absorbed native interruption and real transport deadline remain uncertain without retry', { timeout: 20000 }, async () => {
  let calls = 0, mode = 'interrupt';
  const provider = await localServer(request => { calls++; request.resume(); if (mode === 'interrupt') request.socket.destroy(); });
  try {
    for (mode of ['interrupt', 'timeout']) {
      const result = await sender((_url, init) => fetch(provider.url, init)).send(message());
      assert.equal(result.status, 'uncertain');
    }
    assert.equal(calls, 2);
  } finally { await close(provider.server); }
});
