import test from 'node:test';
import assert from 'node:assert/strict';
import { mailDoctor } from '../../src/doctor/index.mjs';
import { receiveProbe } from '../../src/doctor/receive.mjs';
import { readJson, bounded } from '../../src/doctor/common.mjs';

const inboxId = '12345678-1234-4321-8123-123456789abc';
const options = () => ({
  domain: 'mail.example.com', provider: 'resend', live: true,
  send: { config: { provider: 'resend', mode: 'production', apiKey: 'test_sender_key' }, from: 'Sender <sender@mail.example.com>', to: 'inbox@receive.example.com' },
  receive: { provider: 'resend', apiKey: 'test_readback_key' }, timeoutMs: 100, pollIntervalMs: 100,
});
const received = probe => ({
  object: 'email', id: inboxId, from: probe.from, to: probe.to, subject: probe.subject, text: probe.text,
  created_at: new Date().toISOString(), message_id: '<actual-rfc-message@provider.example>',
  headers: { authorization: 'must-not-export', 'x-unrelated': 'private' },
});
function dependencies({ status = 'accepted', mutate = email => email, listOnly = false } = {}) {
  let probe, sends = 0, reads = 0;
  return {
    deps: {
      sender: { async send(message) { probe = message; sends++; return { provider: 'resend', status, providerMessageId: 'provider-real-id' }; } },
      async fetch(url, init) {
        reads++;
        assert.equal(new URL(url).origin, 'https://api.resend.com');
        assert.equal(init.redirect, 'manual');
        assert.equal(init.headers.authorization, 'Bearer test_readback_key');
        const email = mutate(received(probe));
        if (url.includes('?')) return Response.json({ object: 'list', has_more: false, data: [email] });
        assert.ok(!listOnly, 'must not hydrate a nonmatching summary');
        assert.equal(url, `https://api.resend.com/emails/receiving/${inboxId}`);
        return Response.json(email);
      },
    }, counts: () => ({ sends, reads }),
  };
}

test('live sender and independent inbox readback correlate fresh message body and identity', async () => {
  const fixture = dependencies();
  const result = await mailDoctor({ ...options(), timeoutMs: 2000 }, fixture.deps);
  const [send, receive] = result.items.slice(4);
  assert.equal(send.status, 'pass'); assert.equal(receive.status, 'pass');
  assert.equal(receive.evidence.inboxMessageId, inboxId);
  assert.equal(send.evidence.correlationId, receive.evidence.correlationId);
  assert.match(receive.evidence.bodySha256, /^[a-f0-9]{64}$/);
  assert.deepEqual(fixture.counts(), { sends: 1, reads: 2 });
  assert.doesNotMatch(JSON.stringify(result), /test_sender_key|test_readback_key|must-not-export|inbox@|Sender </);
});

test('acceptance alone cannot pass receipt; unrelated messages time out without hydration', async () => {
  const fixture = dependencies({ mutate: email => ({ ...email, subject: 'another run' }), listOnly: true });
  const result = await mailDoctor(options(), fixture.deps);
  assert.equal(result.items[4].status, 'pass');
  assert.equal(result.items[5].status, 'pending');
  assert.equal(result.items[5].evidence.state, 'timeout');
  assert.deepEqual(fixture.counts(), { sends: 1, reads: 1 });
});

test('rejected and rate limited submissions never poll the inbox or resend', async () => {
  for (const status of ['rejected', 'rate_limited']) {
    const fixture = dependencies({ status });
    const result = await mailDoctor(options(), fixture.deps);
    assert.equal(result.items[4].status, 'fail'); assert.equal(result.items[5].status, 'not_checked');
    assert.deepEqual(fixture.counts(), { sends: 1, reads: 0 });
  }
});

test('uncertain submission may be reconciled by actual readback but remains uncertain', async () => {
  const fixture = dependencies({ status: 'uncertain' });
  const result = await mailDoctor(options(), fixture.deps);
  assert.equal(result.items[4].status, 'pending'); assert.equal(result.items[5].status, 'pass');
  assert.equal(fixture.counts().sends, 1);
});

test('stale, wrong sender and wrong recipient do not correlate', async () => {
  for (const alteration of [{ created_at: '2000-01-01T00:00:00Z' }, { from: 'other@mail.example.com' }, { to: ['wrong@receive.example.com'] }]) {
    const fixture = dependencies({ mutate: email => ({ ...email, ...alteration }), listOnly: true });
    const result = await mailDoctor(options(), fixture.deps);
    assert.equal(result.items[5].evidence.state, 'timeout');
  }
});

test('wrong body and hydrated identity conflict cannot become received proof', async () => {
  for (const alteration of [{ text: 'other body' }, { id: '87654321-4321-4321-8123-123456789abc' }]) {
    const fixture = dependencies();
    const fetcher = fixture.deps.fetch;
    fixture.deps.fetch = async (url, init) => {
      const response = await fetcher(url, init);
      return url.includes('?') ? response : Response.json({ ...await response.json(), ...alteration });
    };
    const result = await mailDoctor(options(), fixture.deps);
    assert.equal(result.items[5].status, 'fail');
  }
});

test('live options fail before any effect when provider, mailbox, domain or budget is invalid', async () => {
  for (const mutate of [
    value => delete value.receive,
    value => { value.receive.apiKey = ''; },
    value => { value.send.config.provider = 'development'; value.send.config.mode = 'development'; },
    value => { value.send.from = 'sender@other.example.com'; },
    value => { value.timeoutMs = Infinity; },
    value => { value.pollIntervalMs = 0; },
  ]) {
    const value = options(); mutate(value);
    await assert.rejects(mailDoctor(value, { fetch() { assert.fail('network effect'); }, sender: { send() { assert.fail('send effect'); } } }));
  }
});

test('mailbox transport errors, redirects and oversized bodies fail with redacted evidence', async () => {
  for (const fetcher of [async () => { throw new Error('test_readback_key private'); }, async () => new Response(null, { status: 302 }), async () => new Response('x'.repeat(262145))]) {
    const fixture = dependencies(); fixture.deps.fetch = fetcher;
    const result = await mailDoctor(options(), fixture.deps);
    assert.equal(result.items[5].evidence.state, 'error');
    assert.doesNotMatch(JSON.stringify(result), /test_readback_key|private/);
  }
});

test('provider data cannot select an arbitrary receiving endpoint', async () => {
  const fixture = dependencies();
  let calls = 0;
  fixture.deps.fetch = async url => {
    calls++; assert.equal(new URL(url).origin, 'https://api.resend.com');
    return Response.json({ object: 'list', has_more: true, data: [{ id: '../../secrets' }] });
  };
  const result = await mailDoctor(options(), fixture.deps);
  assert.equal(result.items[5].status, 'fail'); assert.equal(calls, 1);
});

test('receive scan caps pages and time even when mailbox has more messages', async t => {
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: 1700000000000 });
  let calls = 0;
  let pollingWait;
  const waiting = new Promise(resolve => { pollingWait = resolve; });
  const setTimeout = globalThis.setTimeout;
  t.mock.method(globalThis, 'setTimeout', (callback, delay, ...args) => {
    const timer = setTimeout(callback, delay, ...args);
    // Request timers are installed before fetch; this is the post-page poll sleep.
    if (calls === 3) pollingWait(delay);
    return timer;
  });
  const probe = { deliveryId: 'fresh', from: 'a@mail.example.com', to: ['b@receive.example.com'], subject: 'fresh', text: 'fresh' };
  const pending = receiveProbe({ apiKey: 'test_readback_key', probe, startedAt: Date.now(), timeoutMs: 100, pollIntervalMs: 100 }, { fetch: async () => {
    calls++;
    return Response.json({ object: 'list', has_more: true, data: [{ id: `12345678-1234-4321-8123-${String(calls).padStart(12, '0')}` }] });
  } });
  assert.equal(await Promise.race([waiting, pending.then(() => assert.fail('scan ended before its poll sleep'))]), 100);
  assert.equal(calls, 3);
  t.mock.timers.tick(99);
  assert.equal(calls, 3);
  t.mock.timers.tick(1);
  const result = await pending;
  assert.equal(calls, 3); assert.equal(result.evidence.state, 'timeout');
  assert.equal(result.evidence.polls, 1); assert.equal(result.evidence.requests, 3);
});

test('bounded operation times out even if an injected transport ignores abort', async () => {
  await assert.rejects(bounded(() => new Promise(() => {}), 20));
  await assert.rejects(readJson(new Response('x'.repeat(20)), 10));
});
