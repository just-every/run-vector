import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { signed, sg, resend, NOW } from './fixtures.mjs';

const { Miniflare } = await import(process.env.MAIL_MINIFLARE_MODULE || 'miniflare');
const root = new URL('../../', import.meta.url);
async function createRuntime(path) {
  const modules = {};
  async function add(path) { modules[path] = { type: 'esm', contents: await readFile(new URL(path, root), 'utf8') }; }
  for (const dir of ['src/events', 'src/core']) {
    for (const file of await readdir(new URL(dir, root))) if (file.endsWith('.mjs')) await add(`${dir}/${file}`);
  }
  await add('tests/events/worker.mjs');
  return new Miniflare({ cf: false, resourcePersistencePath: path, workers: [{ config: {
    type: 'worker', name: 'mail-events-test', compatibilityDate: '2026-09-01',
    manifest: { mainModule: 'tests/events/worker.mjs', modulesRoot: fileURLToPath(root), modules },
    env: { LEDGER: { type: 'durable-object', worker: 'mail-events-test', exportName: 'EventLedger' }, QUEUE: { type: 'queue', name: 'mail-events' } },
    triggers: [{ type: 'queue', name: 'mail-events', maxBatchTimeout: 0 }],
    exports: { EventLedger: { type: 'durable-object', storage: 'sqlite' } },
  } }] });
}
function payload(input, extra = {}) {
  return { raw: Buffer.from(input.rawBody).toString('base64'), headers: [...input.headers],
    config: { provider: input.provider, key: input.key, now: input.now, tenantId: 'tenant', eventNamespace: 'endpoint', ...extra } };
}
async function send(runtime, path, body) {
  const response = await runtime.dispatchFetch(`https://mail.test/${path}`, { method: 'POST', body: JSON.stringify(body) });
  return response.json();
}
async function using(fn) {
  const path = await mkdtemp(join(tmpdir(), 'mail-events-'));
  let runtime;
  try { runtime = await createRuntime(path); await fn(runtime, path); }
  finally { if (runtime) await runtime.dispose(); await rm(path, { recursive: true, force: true }); }
}

test('actual workerd verifies both protocols without Node compatibility', async () => using(async runtime => {
  for (const provider of ['resend', 'sendgrid']) {
    const input = signed(provider, 'not JSON: café');
    const body = { ...input, raw: Buffer.from(input.rawBody).toString('base64'), headers: [...input.headers] };
    assert.equal(await send(runtime, 'verify', body), true);
    body.raw = Buffer.from('mutated').toString('base64');
    assert.equal(await send(runtime, 'verify', body), false);
  }
}));

test('SendGrid batch identity, replay, recipient isolation and monotonic status in durable storage', async () => using(async runtime => {
  const first = sg();
  const second = sg({ sg_event_id: 'evt_2', email: 'second@example.test' });
  const body = payload(signed('sendgrid', JSON.stringify([first, second])));
  const result = await send(runtime, 'batch', body);
  assert.deepEqual(result.result.map(value => value.outcome), ['stored', 'stored']);
  assert.deepEqual(result.result.map(value => value.recipients[0].recipient), ['recipient@example.test', 'second@example.test']);
  const replay = await send(runtime, 'batch', payload(signed('sendgrid', JSON.stringify([second, first]))));
  assert.deepEqual(replay.result.map(value => value.outcome), ['duplicate', 'duplicate']);
  for (const delta of [-10, 10]) {
    const old = sg({ sg_event_id: `evt_processed_${delta}`, event: 'processed', timestamp: NOW / 1000 + delta });
    const response = await send(runtime, 'batch', payload(signed('sendgrid', JSON.stringify([old]))));
    assert.equal(response.result[0].recipients[0].applied, false);
    assert.equal(response.result[0].recipients[0].state.status, 'delivered');
  }
  const conflict = await send(runtime, 'batch', payload(signed('sendgrid', JSON.stringify([sg({ event: 'bounce' })]))));
  assert.equal(conflict.code, 'event_identity_conflict');
}));

test('invalid crypto precedes parsing/authorization/storage; schemas and identity authorization fail atomically', async () => using(async runtime => {
  const input = signed('sendgrid', '{invalid');
  input.rawBody[0] ^= 1;
  assert.equal((await send(runtime, 'reject', payload(input))).code, 'event_signature_invalid');
  assert.equal((await send(runtime, 'reject', payload(signed('sendgrid', '{invalid')))).code, 'invalid_event_json');
  assert.equal((await send(runtime, 'reject', payload(signed('sendgrid', JSON.stringify([sg()])) , { authorize: false }))).code, 'event_unauthorized');
  assert.equal((await send(runtime, 'reject', payload(signed('sendgrid', JSON.stringify([sg(), sg({ sg_event_id: 'bad', email: 'other@foreign.test' })]))))).code, 'event_unauthorized');
  assert.equal((await send(runtime, 'reject', payload(signed('sendgrid', JSON.stringify([sg(), sg({ timestamp: '1790000000' })]))))).code, 'invalid_event_timestamp');
  assert.deepEqual(await send(runtime, 'reject', { action: 'list' }), []);
}));

test('same-ID conflict rolls back all earlier events in the same real transaction', async () => using(async runtime => {
  await send(runtime, 'rollback', payload(signed('sendgrid', JSON.stringify([sg()]))));
  const prior = await send(runtime, 'rollback', { action: 'list' });
  const result = await send(runtime, 'rollback', payload(signed('sendgrid', JSON.stringify([
    sg({ sg_event_id: 'new', email: 'second@example.test' }), sg({ event: 'bounce' }),
  ]))));
  assert.equal(result.code, 'event_identity_conflict');
  assert.deepEqual(await send(runtime, 'rollback', { action: 'list' }), prior);
}));

test('concurrent deliveries admit one receipt and duplicate nineteen, conflicting races admit one payload', async () => using(async runtime => {
  const body = payload(signed('resend', JSON.stringify(resend())));
  const results = await Promise.all(Array.from({ length: 20 }, () => send(runtime, 'race', body)));
  assert.equal(results.filter(value => value.result?.[0].outcome === 'stored').length, 1);
  assert.equal(results.filter(value => value.result?.[0].outcome === 'duplicate').length, 19);
  const competing = ['email.delivered', 'email.bounced'].map(type => payload(signed('resend', JSON.stringify(resend({ type })), { id: 'msg_conflict' })));
  const conflicts = await Promise.all(competing.map(value => send(runtime, 'race-conflict', value)));
  assert.equal(conflicts.filter(value => value.result?.[0].outcome === 'stored').length, 1);
  assert.equal(conflicts.filter(value => value.code === 'event_identity_conflict').length, 1);
}));

test('provider, tenant and endpoint namespaces isolate identical event IDs', async () => using(async runtime => {
  for (const tenantId of ['tenant', 'tenant-two']) for (const eventNamespace of ['endpoint', 'other-endpoint']) {
    const result = await send(runtime, 'namespaces', payload(signed('resend', JSON.stringify(resend())), { tenantId, eventNamespace }));
    assert.equal(result.result[0].outcome, 'stored');
  }
  const result = await send(runtime, 'namespaces', payload(signed('sendgrid', JSON.stringify([sg({ sg_event_id: 'msg_test' })]))));
  assert.equal(result.result[0].outcome, 'stored');
}));

test('deduplication and recipient status survive full workerd restart', async () => {
  const path = await mkdtemp(join(tmpdir(), 'mail-events-restart-'));
  let runtime;
  try {
    runtime = await createRuntime(path);
    const body = payload(signed('resend', JSON.stringify(resend())));
    assert.equal((await send(runtime, 'restart', body)).result[0].outcome, 'stored');
    await runtime.dispose(); runtime = await createRuntime(path);
    assert.equal((await send(runtime, 'restart', body)).result[0].outcome, 'duplicate');
    const older = payload(signed('resend', JSON.stringify(resend({ type: 'email.sent', created_at: new Date(NOW - 1000).toISOString() })), { id: 'msg_old' }));
    const result = await send(runtime, 'restart', older);
    assert.equal(result.result[0].recipients[0].state.status, 'delivered');
    assert.equal(result.result[0].recipients[0].applied, false);
    const conflict = payload(signed('resend', JSON.stringify(resend({ type: 'email.bounced' }))));
    assert.equal((await send(runtime, 'restart', conflict)).code, 'event_identity_conflict');
  } finally { if (runtime) await runtime.dispose(); await rm(path, { recursive: true, force: true }); }
});

test('Cloudflare documented queue schema requires configured source and recipient authorization', async () => using(async runtime => {
  const source = { queue: 'mail-events', zoneId: 'zone', accountId: 'account', domain: 'example.test', eventSubscriptionId: 'subscription' };
  const event = { type: 'cf.email.sending.message.delivered', source: { type: 'email.sending', zoneId: 'zone', domain: 'example.test' },
    payload: { eventId: 'evt_cf', messageId: 'remote_cf', recipient: 'recipient@example.test', terminal: true, delivery: { status: 'delivered' } },
    metadata: { accountId: 'account', eventSubscriptionId: 'subscription', eventSchemaVersion: 1, eventTimestamp: new Date(NOW).toISOString() } };
  const body = { action: 'queue', queue: 'mail-events', events: [event], config: { provider: 'cloudflare', tenantId: 'tenant', eventNamespace: 'domain', cloudflareSource: source, now: NOW } };
  assert.equal((await send(runtime, 'queue', body)).result[0].outcome, 'stored');
  assert.equal((await send(runtime, 'queue', body)).result[0].outcome, 'duplicate');
  assert.equal((await send(runtime, 'queue', { ...body, queue: 'wrong' })).code, 'invalid_event_queue');
  event.metadata.accountId = 'other';
  assert.equal((await send(runtime, 'queue', body)).code, 'event_source_unauthorized');
  event.metadata.accountId = 'account'; event.payload.terminal = false;
  assert.equal((await send(runtime, 'queue', body)).code, 'invalid_event_schema');
  assert.equal((await send(runtime, 'verify', { provider: 'cloudflare', raw: '', headers: [], now: NOW, key: '' })), false);
}));

test('exact intake byte limit succeeds and one extra byte fails before storage', async () => using(async runtime => {
  const text = JSON.stringify([sg()]);
  const exact = text + ' '.repeat(1024 * 1024 - Buffer.byteLength(text));
  assert.equal((await send(runtime, 'exact', payload(signed('sendgrid', exact)))).result[0].outcome, 'stored');
  assert.equal((await send(runtime, 'large', payload(signed('sendgrid', exact + ' ')))).code, 'invalid_event_input');
  assert.deepEqual(await send(runtime, 'large', { action: 'list' }), []);
}));

test('Resend keeps recipient identity and finalizes older terminal evidence without losing newer complaints', async () => using(async runtime => {
  const data = { email_id: 'multi', to: ['First@example.test', 'first@example.test'] };
  const sent = resend({ type: 'email.sent', data });
  await send(runtime, 'state', payload(signed('resend', JSON.stringify(sent), { id: 'pending' })));
  const delivered = resend({ data, created_at: new Date(NOW - 1000).toISOString() });
  const first = await send(runtime, 'state', payload(signed('resend', JSON.stringify(delivered), { id: 'final' })));
  assert.equal(first.result[0].recipients.length, 2);
  assert.ok(first.result[0].recipients.every(value => value.applied && value.state.status === 'delivered'));
  const complaint = resend({ data, type: 'email.complained', created_at: new Date(NOW + 1000).toISOString() });
  const second = await send(runtime, 'state', payload(signed('resend', JSON.stringify(complaint), { id: 'complaint' })));
  assert.ok(second.result[0].recipients.every(value => value.applied && value.state.status === 'complained'));
  const third = await send(runtime, 'state', payload(signed('resend', JSON.stringify(delivered), { id: 'old-final' })));
  assert.ok(third.result[0].recipients.every(value => !value.applied && value.state.status === 'complained'));
}));

test('full payload fingerprints reject changed unused fields and tracking events do not overwrite delivery', async () => using(async runtime => {
  const event = sg({ extra: { quoted: 'a } \\" [ b', array: [1, { key: 'value' }] } });
  await send(runtime, 'fingerprint', payload(signed('sendgrid', JSON.stringify([event]))));
  const changed = { ...event, extra: { ignored: 'still fingerprinted' } };
  assert.equal((await send(runtime, 'fingerprint', payload(signed('sendgrid', JSON.stringify([changed]))))).code, 'event_identity_conflict');
  const tracking = sg({ sg_event_id: 'open', event: 'open', timestamp: NOW / 1000 + 1 });
  const result = await send(runtime, 'fingerprint', payload(signed('sendgrid', JSON.stringify([tracking]))));
  assert.equal(result.result[0].recipients[0].applied, false);
  assert.equal(result.result[0].recipients[0].state.status, 'delivered');
}));

test('malformed dates, invalid UTF-8, absent identity and excess batch length fail before storage', async () => using(async runtime => {
  const malformed = resend({ created_at: '2026-02-30T00:00:00Z' });
  assert.equal((await send(runtime, 'schema', payload(signed('resend', JSON.stringify(malformed))))).code, 'invalid_event_timestamp');
  assert.equal((await send(runtime, 'schema', payload(signed('resend', Buffer.from([255]))))).code, 'invalid_event_json');
  assert.equal((await send(runtime, 'schema', payload(signed('sendgrid', JSON.stringify([sg({ sg_event_id: '' })]))))).code, 'invalid_event_identity');
  const events = Array.from({ length: 1001 }, (_, index) => sg({ sg_event_id: String(index) }));
  assert.equal((await send(runtime, 'schema', payload(signed('sendgrid', JSON.stringify(events))))).code, 'invalid_event_batch');
  assert.deepEqual(await send(runtime, 'schema', { action: 'list' }), []);
}));

test('actual Queue dispatch carries Cloudflare event to private Durable Object binding before acknowledgment', async () => using(async runtime => {
  const producer = await runtime.getQueueProducer('QUEUE');
  await producer.send({ type: 'cf.email.sending.message.delivered', source: { type: 'email.sending', zoneId: 'zone', domain: 'example.test' },
    payload: { eventId: 'actual-queue', messageId: 'actual-message', recipient: 'recipient@example.test', terminal: true, delivery: { status: 'delivered' } },
    metadata: { accountId: 'account', eventSubscriptionId: 'subscription', eventSchemaVersion: 1, eventTimestamp: new Date(NOW).toISOString() } });
  let rows;
  const deadline = Date.now() + 5000;
  do {
    rows = await send(runtime, 'trusted-queue', { action: 'list' });
    if (rows.length === 2) break;
    await new Promise(resolve => setTimeout(resolve, 20));
  } while (Date.now() < deadline);
  assert.equal(rows.length, 2);
  assert.equal(rows.find(([key]) => key.includes(':receipt:'))[1].eventId, 'actual-queue');
  assert.equal(rows.find(([key]) => key.includes(':state:'))[1].status, 'delivered');
}));
