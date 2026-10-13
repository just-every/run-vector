import test from 'node:test';
import assert from 'node:assert/strict';
import { cloudflare } from '../provider.mjs';
const settings = {field:'buckets', pagination:'r2-bounded'};
const response = (buckets, result_info) => Response.json({success:true, result:{buckets}, ...(result_info === undefined ? {} : {result_info})});

test('Vector explicitly delegates bounded R2 listing with opaque cursors to Base', async () => {
  const calls = [];
  const api = cloudflare({accountId:'a'.repeat(32), token:'test-only', fetch:async url => {
    const query = new URL(url).searchParams; calls.push(query);
    assert.equal(query.get('per_page'), '1000');
    assert.equal(query.has('start_after'), false);
    assert.equal(query.has('order'), false);
    return calls.length === 1 ? response([{name:'first'}], {per_page:1,cursor:'opaque+/='}) : response([], {per_page:1});
  }});
  assert.deepEqual(await api.list('/r2/buckets', settings), [{name:'first'}]);
  assert.equal(calls[1].get('cursor'), 'opaque+/=');
});

test('bounded failures never select Vector cursor pagination or retry', async () => {
  for (const failure of ['transport','metadata']) {
    let calls = 0;
    const api = cloudflare({accountId:'a'.repeat(32), token:'test-only', fetch:async () => {
      calls++;
      if (failure === 'transport') throw Error('synthetic failure');
      return response(Array.from({length:1000}, (_, i) => ({name:`bucket-${i}`})));
    }});
    await assert.rejects(api.list('/r2/buckets', settings));
    assert.equal(calls, 1);
  }
});
