import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorker } from '../runtime/harness.mjs';
test('all three inbound adapters and safe hydration run in real workerd without Node compatibility', async () => {
  const worker = await createWorker('tests/inbound/worker.mjs', ['tests/inbound/fixtures.mjs']);
  try {
    const response = await worker.dispatchFetch('https://mail.test');
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { providers: ['cloudflare', 'sendgrid', 'resend'], hydrationCalls: 2 });
  } finally { await worker.dispose(); }
});
