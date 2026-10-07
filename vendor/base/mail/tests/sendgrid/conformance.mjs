// Portable test-only cases: import and await this in Node or a workerd handler.
import { sendSendGrid, serializeSendGridMessage } from '../../src/adapters/sendgrid/index.mjs';

export const config = { provider: 'sendgrid', mode: 'test', apiKey: 'fixture-sendgrid-key' };
export function message() {
  return {
    deliveryId: 'command-78', from: 'Support <support@example.org>',
    to: ['Ada <ada@example.net>', 'grace@example.net'], cc: ['Copy <copy@example.net>'], bcc: ['blind@example.net'],
    replyTo: 'Replies <reply@example.org>', subject: 'Résumé ✓', text: 'Line one\nLine two ✓', html: '<p>Résumé <img src="cid:logo-1"></p>',
    headers: { 'Message-ID': '<new@example.org>', 'In-Reply-To': '<prior@example.org>', References: '<root@example.org> <prior@example.org>', 'X-Application': 'test' },
    attachments: [
      { filename: 'bytes.bin', contentType: 'application/octet-stream', content: Uint8Array.of(0, 255, 128, 10) },
      { filename: 'logo.png', contentType: 'image/png', content: Uint8Array.of(137, 80, 78, 71), disposition: 'inline', contentId: 'logo-1' },
    ],
    customArgs: { rer_product: 'mail-unit', trace: 'correlation-only' }, asmGroupId: 37, subscriptionTracking: true,
  };
}
function equal(actual, expected, label) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`SendGrid conformance: ${label}`);
}
function check(value, label) { if (!value) throw new Error(`SendGrid conformance: ${label}`); }

export async function runSendGridConformance() {
  const input = message();
  const expected = {
    personalizations: [{ to: [{ email: 'ada@example.net', name: 'Ada' }, { email: 'grace@example.net' }], cc: [{ email: 'copy@example.net', name: 'Copy' }], bcc: [{ email: 'blind@example.net' }] }],
    from: { email: 'support@example.org', name: 'Support' }, subject: input.subject,
    content: [{ type: 'text/plain', value: input.text }, { type: 'text/html', value: input.html }],
    reply_to: { email: 'reply@example.org', name: 'Replies' }, headers: input.headers,
    attachments: [
      { content: 'AP+ACg==', type: 'application/octet-stream', filename: 'bytes.bin', disposition: 'attachment' },
      { content: 'iVBORw==', type: 'image/png', filename: 'logo.png', disposition: 'inline', content_id: 'logo-1' },
    ],
    custom_args: { rer_product: 'mail-unit', trace: 'correlation-only', rer_delivery_id: input.deliveryId }, asm: { group_id: 37 },
    tracking_settings: { click_tracking: { enable: false, enable_text: false }, open_tracking: { enable: false }, ganalytics: { enable: false }, subscription_tracking: { enable: true } },
  };
  const before = serializeSendGridMessage(input);
  equal(JSON.parse(before), expected, 'exact complete body');
  let calls = 0;
  const accepted = await sendSendGrid(config, input, { fetch: async (url, init) => {
    calls++;
    equal(url, 'https://api.sendgrid.com/v3/mail/send', 'fixed endpoint');
    equal(init.method, 'POST', 'method');
    equal(init.redirect, 'manual', 'redirect policy');
    check(init.signal instanceof AbortSignal, 'abort signal');
    equal(Object.fromEntries(new Headers(init.headers)), { authorization: 'Bearer fixture-sendgrid-key', 'content-type': 'application/json' }, 'authentication');
    equal(init.body, before, 'serializer and transport agree');
    return new Response(null, { status: 202, headers: { 'X-Message-Id': 'actual-provider-id' } });
  } });
  equal(accepted, { provider: 'sendgrid', status: 'accepted', providerMessageId: 'actual-provider-id' }, 'accepted receipt');
  equal(calls, 1, 'one request');
  equal(serializeSendGridMessage(input), before, 'input unchanged');
  const outcomes = [[200, 'uncertain'], [201, 'uncertain'], [204, 'uncertain'], [301, 'uncertain'], [302, 'uncertain'], [303, 'uncertain'], [307, 'uncertain'], [308, 'uncertain'], [400, 'rejected'], [401, 'rejected'], [403, 'rejected'], [404, 'rejected'], [405, 'rejected'], [408, 'uncertain'], [413, 'rejected'], [422, 'rejected'], [429, 'rate_limited'], [500, 'uncertain'], [503, 'uncertain']];
  for (const [status, outcome] of outcomes) {
    calls = 0;
    const result = await sendSendGrid(config, input, { fetch: async () => {
      calls++;
      return new Response(status === 204 ? null : 'PRIVATE provider body', { status, headers: { 'X-Message-Id': 'not-an-accepted-receipt', location: 'https://other.invalid/exfiltrate' } });
    } });
    equal(result.status, outcome, `HTTP ${status}`);
    equal(result.providerMessageId, null, `no rejected receipt ${status}`);
    check(!JSON.stringify(result).includes('PRIVATE'), 'body redaction');
    equal(calls, 1, `no retry ${status}`);
  }
  for (const receipt of [null, '', '   ', 'x'.repeat(1025), 'bad\tidentifier']) {
    const result = await sendSendGrid(config, input, { fetch: async () => new Response(null, { status: 202, headers: receipt === null ? {} : { 'x-message-id': receipt } }) });
    equal(result, { provider: 'sendgrid', status: 'accepted', providerMessageId: null }, 'nullable real receipt');
  }
  for (const failure of ['throw', 'invalid-response']) {
    calls = 0;
    const result = await sendSendGrid(config, input, { fetch: async () => {
      calls++;
      if (failure === 'throw') throw new Error('PRIVATE network diagnostic fixture-sendgrid-key');
      return { status: 202, headers: new Headers({ 'x-message-id': 'fake' }) };
    } });
    equal(result.status, 'uncertain', 'failed transport');
    check(!JSON.stringify(result).includes('PRIVATE'), 'exception redaction');
    equal(calls, 1, 'no transport retry');
  }
  return { passed: true, httpCases: outcomes.length, receiptCases: 5, transportCases: 2 };
}
