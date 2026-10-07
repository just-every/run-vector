import { createHmac, generateKeyPairSync, randomBytes, sign } from 'node:crypto';

export const NOW = 1_790_000_000_000;
export const encoder = new TextEncoder();
export const pair = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
export const publicKey = pair.publicKey.export({ type: 'spki', format: 'der' }).toString('base64');
export const secretBytes = randomBytes(32);
export const secret = `whsec_${secretBytes.toString('base64')}`;

export function signed(provider, body, { timestamp = String(NOW / 1000), id = 'msg_test', signingKey } = {}) {
  const rawBody = typeof body === 'string' ? encoder.encode(body) : new Uint8Array(body);
  const headers = new Headers();
  if (provider === 'sendgrid') {
    headers.set('x-twilio-email-event-webhook-timestamp', timestamp);
    headers.set('x-twilio-email-event-webhook-signature', sign('sha256', Buffer.concat([Buffer.from(timestamp), Buffer.from(rawBody)]), signingKey ?? pair.privateKey).toString('base64'));
  } else {
    headers.set('svix-id', id); headers.set('svix-timestamp', timestamp);
    headers.set('svix-signature', `v1,${createHmac('sha256', signingKey ?? secretBytes).update(`${id}.${timestamp}.`).update(rawBody).digest('base64')}`);
  }
  return { provider, rawBody, headers, key: provider === 'sendgrid' ? publicKey : secret, now: NOW };
}

export function sg(overrides = {}) {
  return { sg_event_id: 'evt_1', sg_message_id: 'remote_1', event: 'delivered', email: 'recipient@example.test', timestamp: NOW / 1000, rer_delivery_id: 'local_1', rer_product: 'product', ...overrides };
}
export function resend(overrides = {}) {
  return { type: 'email.delivered', created_at: new Date(NOW).toISOString(), data: { email_id: 'remote_1', to: ['recipient@example.test'] }, ...overrides };
}
