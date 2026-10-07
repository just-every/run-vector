import { mailDoctor } from '../../index.mjs';
// Provider transport fixtures only: the doctor must resolve and invoke its real facade.
export async function doctorScenario(provider, missingReceipt = false) {
  const calls = []; let sent;
  const id = '12345678-1234-4321-8123-123456789abc';
  const result = await mailDoctor({ domain: 'mail.example.test', provider, live: true,
    send: { config: { provider, mode: 'production', apiKey: 'fixture-send', ...(provider === 'cloudflare' ? { accountId: 'a'.repeat(32) } : {}) }, from: 'probe@mail.example.test', to: 'inbox@receive.example.test' },
    receive: { provider: 'resend', apiKey: 'fixture-read' }, timeoutMs: missingReceipt ? 100 : 2000, pollIntervalMs: 100,
  }, { fetch: async (url, init) => {
    calls.push({ url, method: init.method, redirect: init.redirect, authorization: new Headers(init.headers).get('authorization') });
    if (init.method === 'POST') {
      const body = JSON.parse(init.body);
      sent = { subject: body.subject, text: provider === 'sendgrid' ? body.content[0].value : body.text };
      if (provider === 'sendgrid') return new Response(null, { status: 202, headers: { 'x-message-id': 'sg-doctor' } });
      if (provider === 'resend') return Response.json({ id: 'resend-doctor' });
      return Response.json({ success: true, errors: [], result: { queued: ['inbox@receive.example.test'], delivered: [], permanent_bounces: [] } });
    }
    if (!sent) throw new Error('readback before submission');
    const email = { object: 'email', id, from: 'probe@mail.example.test', to: ['inbox@receive.example.test'], ...sent, created_at: new Date().toISOString(), message_id: '<fixture-independent-receipt@example.test>' };
    return Response.json(url.includes('?') ? { object: 'list', has_more: false, data: missingReceipt ? [] : [email] } : email);
  } });
  return { result, calls };
}
