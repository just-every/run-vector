import test from 'node:test';
import assert from 'node:assert/strict';
import { receiveProbe } from '../../src/doctor/receive.mjs';

test('an early timer wake cannot spend another mailbox request before the polling deadline', async t => {
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: 1700000000000 });
  let requests = 0;
  let sleepStarted;
  const sleeping = new Promise(resolve => { sleepStarted = resolve; });
  const setTimeout = globalThis.setTimeout;
  t.mock.method(globalThis, 'setTimeout', (callback, delay, ...args) => {
    // Deterministically reproduce a clock/timer boundary rounding one ms early.
    const timer = setTimeout(callback, Math.max(1, delay - 1), ...args);
    if (requests === 1) sleepStarted();
    return timer;
  });
  const pending = receiveProbe({ apiKey: 'test_readback_key', startedAt: Date.now(), timeoutMs: 100, pollIntervalMs: 100,
    probe: { deliveryId: 'fixture', from: 'a@mail.example.com', to: ['b@receive.example.com'], subject: 'fixture', text: 'fixture' },
  }, { fetch: async () => {
    requests++;
    return Response.json({ object: 'list', has_more: false, data: [] });
  } });
  await sleeping;
  assert.equal(requests, 1);
  t.mock.timers.tick(99);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(requests, 1, 'an early wake is not permission for a new provider read');
  t.mock.timers.tick(1);
  const result = await pending;
  assert.equal(result.status, 'pending');
  assert.equal(result.evidence.state, 'timeout');
  assert.equal(result.evidence.polls, 1);
  assert.equal(result.evidence.requests, 1);
});
