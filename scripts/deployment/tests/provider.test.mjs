import test from 'node:test';
import assert from 'node:assert/strict';
import { cloudflare } from '../provider.mjs';
const options = { accountId: 'a'.repeat(32), token: 'test-only' };
const settings = { field: 'buckets', pagination: 'cursor' };
const response = (buckets, info) => Response.json({ success: true, errors: [], result: { buckets }, ...(info === undefined ? {} : { result_info: info }) });

test('R2 sorted start_after pagination traverses full pages with optional metadata', async () => {
  for (const info of [undefined, { per_page: 100, cursor: 'next==' }]) {
    const calls = [];
    const api = cloudflare({ ...options, fetch: async url => {
      const parsed = new URL(url); calls.push(parsed);
      assert.equal(parsed.searchParams.get('order'), 'name'); assert.equal(parsed.searchParams.get('direction'), 'asc'); assert.equal(parsed.searchParams.get('per_page'), '100');
      return calls.length === 1 ? response(Array.from({ length: 100 }, (_, index) => ({ name: `bucket-${String(index).padStart(3, '0')}` })), info) : response([{ name: 'bucket-100' }]);
    } });
    const rows = await api.list('/r2/buckets', settings); assert.equal(rows.length, 101); assert.equal(calls[1].searchParams.get('start_after'), 'bucket-099');
  }
});

test('R2 refuses contradictory short-page cursor, repeated names, invalid ordering and pagination', async () => {
  for (const make of [() => response([{ name: 'bucket-b' }, { name: 'bucket-a' }]), () => response([{ name: 'bucket-a' }, { name: 'bucket-a' }]), () => response([{}]), () => response([], { cursor: 'more' }), () => response([], { per_page: 0 }), () => response([], { cursor: 'bad cursor' })]) {
    const api = cloudflare({ ...options, fetch: async () => make() }); await assert.rejects(api.list('/r2/buckets', settings));
  }
  let calls = 0;
  const api = cloudflare({ ...options, fetch: async () => { calls++; return response(Array.from({ length: 100 }, (_, index) => ({ name: `bucket-${String(index).padStart(3, '0')}` }))); } });
  await assert.rejects(api.list('/r2/buckets', settings), /provider-invalid-r2-order/); assert.equal(calls, 2);
  const transport = cloudflare({ ...options, fetch: async () => { throw new Error('test-only'); } }); await assert.rejects(transport.list('/r2/buckets', settings), /provider-transport-failed/);
});

test('optional metadata is confined to the R2 buckets endpoint', async () => {
  const api = cloudflare({ ...options, fetch: async () => Response.json({ success: true, result: { other: [] } }) });
  await assert.rejects(api.list('/queues', { field: 'other', pagination: 'cursor' }), /provider-incomplete-pagination/);
});
