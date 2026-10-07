import { createMailSender, applyUnsubscribeHeaders } from '../../index.mjs';
import { sendSendGrid } from '../../src/adapters/sendgrid/index.mjs';
import { sendResend } from '../../src/adapters/resend/index.mjs';
import { sendCloudflare } from '../../src/adapters/cloudflare/index.mjs';
import { sendDevelopment } from '../../src/development/index.mjs';

export function message() {
  return { deliveryId: 'assembly-1', from: 'Sender <sender@example.test>', to: ['Reader <reader@example.test>'], cc: ['copy@example.test'], bcc: ['blind@example.test'],
    replyTo: 'Reply <reply@example.test>', subject: 'Café ✓', text: 'Text ✓', html: '<p>HTML ✓</p>',
    headers: { 'In-Reply-To': '<parent@example.test>', References: '<first@example.test> <parent@example.test>' },
    attachments: [{ filename: 'binary.bin', contentType: 'application/octet-stream', content: Uint8Array.of(0, 255, 128, 10), disposition: 'inline', contentId: 'logo' }],
    unsubscribe: { url: 'https://example.test/unsubscribe', mailto: 'leave@example.test', oneClick: true },
  };
}
export async function sendScenario(provider, scenario = 'accepted') {
  const calls = [], captured = [];
  const input = message();
  const config = provider === 'development' ? { provider, mode: 'development' } : { provider, mode: 'test', apiKey: 'assembly-fixture-key', ...(provider === 'cloudflare' ? { accountId: 'a'.repeat(32) } : {}) };
  const dependencies = { outbox: { async put(value) { captured.push(value); } }, fetch: async (url, init) => {
    calls.push({ url, method: init.method, redirect: init.redirect, signal: init.signal instanceof AbortSignal, headers: Object.fromEntries(new Headers(init.headers)), body: JSON.parse(init.body) });
    if (scenario === 'network') throw new Error('PRIVATE transport detail');
    if (/^http-/.test(scenario)) return new Response('PRIVATE provider detail', { status: Number(scenario.slice(5)) });
    if (provider === 'sendgrid') return new Response(null, { status: 202, headers: { 'x-message-id': 'sg-assembly' } });
    if (provider === 'resend') return Response.json({ id: 'resend-assembly' });
    return Response.json({ success: true, errors: [], result: { message_id: 'cf-assembly', delivered: ['reader@example.test'], queued: ['copy@example.test', ...(scenario === 'partial' ? [] : ['blind@example.test'])], permanent_bounces: scenario === 'partial' ? ['blind@example.test'] : [] } });
  } };
  const before = structuredClone(input);
  if (scenario === 'invalid') input.to = ['bad\r\n@example.test'];
  try {
    if (scenario === 'direct') {
      await ({ sendgrid: sendSendGrid, resend: sendResend, cloudflare: sendCloudflare, development: sendDevelopment })[provider](config, input, dependencies);
      throw new Error('Unconsumed unsubscribe accepted');
    }
    if (scenario === 'prepared') {
      const prepared = applyUnsubscribeHeaders(input);
      return { result: await createMailSender(config, dependencies).send(prepared), calls, captured };
    }
    const result = await createMailSender(config, dependencies).send(input);
    return { result, calls, captured, unchanged: JSON.stringify(input) === JSON.stringify(before) };
  } catch (error) { return { error: { code: error.code, message: error.message }, calls, captured }; }
}
