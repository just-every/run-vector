export const config = { provider: 'resend', mode: 'test', apiKey: 'fixture-token' };
export const receipt = 'e5191a63-9cbe-40ad-8b8d-1427e13fc116';
export const message = () => ({
  deliveryId: 'ticket-reply/42', from: 'Équipe <help@example.com>',
  to: ['Reader <reader@example.net>'], subject: 'Reply — 你好', text: 'Hello\n你好',
});
export const accepted = () => Response.json({ id: receipt });

export function providerFixture(response = accepted) {
  const calls = [];
  return {
    calls,
    fetch: async (url, init) => {
      // Build a real Web Request so tests check the serialized Fetch contract.
      const request = new Request(url, init);
      calls.push({ request, body: await request.text(), init });
      return typeof response === 'function' ? response() : response;
    },
  };
}
