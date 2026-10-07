import { createMailSender } from '../../index.mjs';
import { fixtureMessage, fixtureResponse } from './provider-fixtures.mjs';
export default {
  async fetch(request) {
    const url = new URL(request.url);
    const provider = url.searchParams.get('provider');
    const scenario = url.searchParams.get('scenario') ?? 'accepted';
    const calls = [];
    const config = { provider, mode: 'test', apiKey: 'fixture-token', ...(provider === 'cloudflare' ? { accountId: 'a'.repeat(32) } : {}) };
    const sender = createMailSender(config, { fetch: async (target, init) => {
      calls.push({ url: String(target), method: init.method, redirect: init.redirect, signal: init.signal instanceof AbortSignal, headers: Object.fromEntries(new Headers(init.headers)), body: JSON.parse(init.body) });
      return fixtureResponse(provider, scenario);
    } });
    const message = fixtureMessage();
    // Cloudflare assigns Message-ID; its documented header allowlist excludes it.
    if (provider === 'cloudflare') delete message.headers['Message-ID'];
    if (scenario === 'invalid') message.to[0] = 'bad\r\nBcc: leak@example.com';
    if (scenario === 'unsupported') message.customArgs = { product: 'test' };
    try { return Response.json({ result: await sender.send(message), calls }); }
    catch (error) { return Response.json({ error: { name: error.name, code: error.code, message: error.message }, calls }); }
  },
};
