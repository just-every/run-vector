export const config = {
  provider: 'cloudflare', mode: 'test', apiKey: 'fixture-token',
  accountId: '0123456789abcdef0123456789abcdef',
};
export function message(overrides = {}) {
  return { deliveryId: 'fixture-delivery', from: 'sender@example.com', to: ['a@example.com'], subject: 'Hello', text: 'Hello\nWorld', ...overrides };
}
export function success(result = {}) {
  return { success: true, errors: [], messages: [], result: {
    delivered: ['a@example.com'], permanent_bounces: [], queued: [], ...result,
  } };
}
export function transport(body = success(), status = 200) {
  const calls = [];
  return { calls, fetch: async (url, init) => {
    calls.push({ url, init });
    return new Response(status === 204 ? null : JSON.stringify(body), { status });
  } };
}
