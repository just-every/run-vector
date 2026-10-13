import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
// The local key gate: the outbox answers only a request that holds the runtime's RER_DEV_KEY. Runtimes that a
// test starts itself get `devKey`; installations that `rer setup` made have their own key file.
export const devKey = 'vector-test-dev-key-abcdefghijklmnopqrstuvwxyz0123456789';
export const keyHeader = key => ({ 'x-rer-dev-key': key });
export async function readCheckoutKey(root) { return /^RER_DEV_KEY=(\S+)$/m.exec(await readFile(join(root, '.rer/local/dev-key.env'), 'utf8'))[1]; }
// Trade the key for the gate cookie in a browser context, as the RER_OPEN page does (works without JavaScript).
export async function openGate(context, origin, key = devKey) {
  const response = await context.request.post(origin + '/__dev/key', { data: { key } });
  assert.equal(response.status(), 204, 'the key opens the outbox gate');
}
