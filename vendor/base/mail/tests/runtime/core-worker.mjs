import { validateConfig, validateMessage, encodeBase64 } from '../../src/core/validation.mjs';
import { requestProvider, classifyHttpStatus } from '../../src/core/transport.mjs';
export default {
  async fetch() {
    const message = { deliveryId: 'worker-test', from: 'sender@example.com', to: ['reader@example.net'], subject: 'Unicode ✓', text: 'Body', attachments: [{ filename: 'x.bin', contentType: 'application/octet-stream', content: Uint8Array.of(0, 255, 128) }] };
    validateConfig({ provider: 'resend', mode: 'test', apiKey: 'fixture-token' });
    validateMessage(message, 'resend');
    let calls = 0;
    const response = await requestProvider('https://fixture.example.test', { method: 'POST', redirect: 'follow' }, { fetch: async (_url, init) => {
      calls++;
      if (init.redirect !== 'manual' || !(init.signal instanceof AbortSignal)) throw new Error('unsafe request');
      return new Response(null, { status: 408 });
    } });
    return Response.json({ base64: encodeBase64(message.attachments[0].content), status: classifyHttpStatus(response.status), calls });
  },
};
