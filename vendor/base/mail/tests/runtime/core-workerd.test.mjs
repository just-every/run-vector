import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorker } from './harness.mjs';

test('portable core executes in actual workerd without Node compatibility', async () => {
  const worker = await createWorker('tests/runtime/core-worker.mjs');
  try {
    const response = await worker.dispatchFetch('https://mail.test');
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { base64: 'AP+A', status: 'uncertain', calls: 1 });
  } finally { await worker.dispose(); }
});
