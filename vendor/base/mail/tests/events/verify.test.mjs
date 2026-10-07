import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, randomBytes } from 'node:crypto';
import { verifyWebhook, MAX_WEBHOOK_BYTES } from '../../src/events/index.mjs';
import { signed, NOW, encoder } from './fixtures.mjs';

for (const provider of ['sendgrid', 'resend']) {
  test(`${provider}: genuine signature covers arbitrary raw bytes including multipart`, async () => {
    const binary = Buffer.concat([Buffer.from('--boundary\r\nContent-Disposition: form-data; name="email"\r\n\r\nUnicode café\r\n'), Buffer.from([0, 255, 128]), Buffer.from('\r\n--boundary--\r\n')]);
    const input = signed(provider, binary);
    assert.equal(await verifyWebhook(input), true);
    for (const index of [0, 10, binary.length - 1]) {
      const rawBody = new Uint8Array(input.rawBody); rawBody[index] ^= 1;
      assert.equal(await verifyWebhook({ ...input, rawBody }), false);
    }
    assert.equal(await verifyWebhook({ ...input, rawBody: input.rawBody.slice(1) }), false);
    assert.equal(await verifyWebhook({ ...input, headers: new Headers() }), false);
  });
  test(`${provider}: inclusive clock boundary, stale/future and invalid time fail closed`, async () => {
    const input = signed(provider, '{}');
    for (const offset of [-300_000, 300_000]) assert.equal(await verifyWebhook({ ...input, now: NOW + offset }), true);
    for (const offset of [-300_001, 300_001]) assert.equal(await verifyWebhook({ ...input, now: NOW + offset }), false);
    for (const now of [NaN, Infinity, -1, NOW + 0.5]) assert.equal(await verifyWebhook({ ...input, now }), false);
    for (const toleranceSeconds of [-1, Infinity, 3601, 0.5]) assert.equal(await verifyWebhook({ ...input, toleranceSeconds }), false);
    assert.equal(await verifyWebhook({ ...input, toleranceSeconds: 0 }), true);
    assert.equal(await verifyWebhook({ ...input, now: NOW + 1, toleranceSeconds: 0 }), false);
    for (const timestamp of ['01790000000', '+1790000000', '1790000000.0', '1790000000,1790000000']) assert.equal(await verifyWebhook(signed(provider, '{}', { timestamp })), false);
  });
  test(`${provider}: bad key, encoding, signature and size rejection`, async () => {
    const input = signed(provider, '{}');
    for (const key of ['', 'not a key', input.key + '\n', input.key + '=', null]) assert.equal(await verifyWebhook({ ...input, key }), false);
    const header = provider === 'sendgrid' ? 'x-twilio-email-event-webhook-signature' : 'svix-signature';
    for (const signature of ['%%%', '', 'AA==', 'v1,AA==', input.headers.get(header) + ',']) {
      const headers = new Headers(input.headers); headers.set(header, signature);
      assert.equal(await verifyWebhook({ ...input, headers }), false);
    }
    assert.equal(await verifyWebhook({ ...input, rawBody: new Uint8Array(MAX_WEBHOOK_BYTES + 1) }), false);
    assert.equal(await verifyWebhook({ ...input, rawBody: '{}' }), false);
  });
}

test('SendGrid rejects wrong key, P-384, negative/nonminimal DER, P1363 and trailing ASN.1', async () => {
  const input = signed('sendgrid', '{}');
  const other = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const p384 = generateKeyPairSync('ec', { namedCurve: 'secp384r1' });
  for (const pair of [other, p384]) assert.equal(await verifyWebhook({ ...input, key: pair.publicKey.export({ type: 'spki', format: 'der' }).toString('base64') }), false);
  const signature = Buffer.from(input.headers.get('x-twilio-email-event-webhook-signature'), 'base64');
  const negative = Buffer.from(signature); negative[4] |= 128;
  const nonminimal = Buffer.concat([signature.subarray(0, 4), Buffer.from([0]), signature.subarray(4)]); nonminimal[1]++; nonminimal[3]++;
  for (const bytes of [negative, nonminimal, Buffer.concat([signature, Buffer.from([0])]), randomBytes(64), Buffer.from([48, 6, 2, 1, 0, 2, 1, 1])]) {
    const headers = new Headers(input.headers); headers.set('x-twilio-email-event-webhook-signature', bytes.toString('base64'));
    assert.equal(await verifyWebhook({ ...input, headers }), false);
  }
  assert.equal(await verifyWebhook({ ...input, key: Buffer.concat([Buffer.from(input.key, 'base64'), Buffer.from([0])]).toString('base64') }), false);
});

test('Resend verifies rotation signatures and binds Svix identity and timestamp', async () => {
  const input = signed('resend', '{}');
  const headers = new Headers(input.headers);
  headers.set('svix-signature', `v1,${randomBytes(32).toString('base64')} ${headers.get('svix-signature')}`);
  assert.equal(await verifyWebhook({ ...input, headers }), true);
  headers.set('svix-id', 'other'); assert.equal(await verifyWebhook({ ...input, headers }), false);
  const changedTime = new Headers(input.headers); changedTime.set('svix-timestamp', String(NOW / 1000 - 1));
  assert.equal(await verifyWebhook({ ...input, headers: changedTime }), false);
  assert.equal(await verifyWebhook({ ...input, key: `whsec_${randomBytes(32).toString('base64')}` }), false);
  assert.equal(await verifyWebhook({ ...input, key: `whsec_${Buffer.from('short').toString('base64')}` }), false);
  const malformed = new Headers(input.headers); malformed.set('svix-signature', `${malformed.get('svix-signature')} invalid`);
  assert.equal(await verifyWebhook({ ...input, headers: malformed }), false);
  // Non-zero padding bits must not alias a valid MAC.
  const signature = input.headers.get('svix-signature');
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const position = signature.length - 2;
  const aliased = signature.slice(0, position) + alphabet[alphabet.indexOf(signature[position]) + 1] + '=';
  const aliases = new Headers(input.headers); aliases.set('svix-signature', aliased);
  assert.equal(await verifyWebhook({ ...input, headers: aliases }), false);
});

test('published Svix interoperability vector', async () => {
  assert.equal(await verifyWebhook({ provider: 'resend', rawBody: encoder.encode('{"event_type":"ping","data":{"success":true}}'), key: 'whsec_plJ3nmyCDGBKInavdOK15jsl', now: 1731705121000,
    headers: new Headers({ 'svix-id': 'msg_loFOjxBNrRLzqYUf', 'svix-timestamp': '1731705121', 'svix-signature': 'v1,rAvfW3dJ/X/qxhsaXPOyyCGmRKsaKWcsNccKXlIktD0=' }) }), true);
});

test('raw body is snapshotted before asynchronous crypto', async () => {
  const input = signed('resend', '{}');
  const verification = verifyWebhook(input); input.rawBody.fill(0);
  assert.equal(await verification, true);
});

test('exact raw-byte limit succeeds, unsupported provider and invalid input fail closed', async () => {
  assert.equal(await verifyWebhook(signed('resend', new Uint8Array(MAX_WEBHOOK_BYTES))), true);
  assert.equal(await verifyWebhook(undefined), false);
  assert.equal(await verifyWebhook({ ...signed('resend', '{}'), provider: 'cloudflare' }), false);
});
