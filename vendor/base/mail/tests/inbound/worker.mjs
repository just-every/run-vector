import { normalizeInbound, createResendAttachmentFetcher } from '../../src/inbound/index.mjs';
import { cloudflare, sendgrid, resend, expected, limits, attachment } from './fixtures.mjs';
function serial(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value) || value instanceof Uint8Array) return `[${[...value].map(serial).join(',')}]`;
  return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${serial(value[key])}`).join(',')}}`;
}
export default {
  async fetch() {
    const providers = [];
    for (const fixture of [cloudflare, sendgrid, resend]) {
      const input = fixture(); const actual = await normalizeInbound(input, limits);
      if (serial(actual) !== serial({ provider: input.provider, ...expected })) throw new Error('Normalization mismatch');
      let rejected = false;
      try { await normalizeInbound(fixture(), { ...limits, maxBodyBytes: 1 }); } catch (error) { rejected = error.code === 'inbound_body_limit'; }
      if (!rejected) throw new Error('Missing body limit');
      providers.push(input.provider);
    }
    let calls = 0;
    const input = resend();
    input.fetchAttachment = createResendAttachmentFetcher({ apiKey: 'workerd-fixture-key', maxAttachmentBytes: 100 }, {
      clock: () => Date.parse('2026-10-06T12:00:00Z'),
      fetch: async (url, init) => {
        if (init.redirect !== 'manual') throw new Error('Redirect allowed'); calls++;
        if (calls === 1) return Response.json({ ...input.email.attachments[0], download_url: 'https://inbound-cdn.resend.com/email-1/attachments/attachment-1?signature=test', expires_at: '2026-10-06T13:00:00Z' });
        if (init.headers) throw new Error('Credential leak');
        return new Response(attachment);
      },
    });
    await normalizeInbound(input, limits);
    return Response.json({ providers, hydrationCalls: calls });
  },
};
