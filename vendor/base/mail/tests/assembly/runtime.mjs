import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { Miniflare } from 'miniflare';
const root = new URL('../../', import.meta.url);

export async function createRuntime(path) {
  const modules = {};
  async function add(name) { modules[name] = { type: 'esm', contents: await readFile(new URL(name, root), 'utf8') }; }
  async function directory(name) {
    for (const entry of await readdir(new URL(name, root), { withFileTypes: true })) {
      if (entry.isDirectory()) await directory(`${name}/${entry.name}`);
      else if (entry.name.endsWith('.mjs') && !entry.name.endsWith('.test.mjs') && entry.name !== 'runtime.mjs') await add(`${name}/${entry.name}`);
    }
  }
  await directory('src'); await directory('tests/assembly');
  await add('index.mjs'); await add('tests/inbound/fixtures.mjs');
  return new Miniflare({ cf: false, unsafeTriggerHandlers: true, resourcePersistencePath: path, workers: [{ config: {
    type: 'worker', name: 'mail-assembly', compatibilityDate: '2026-09-01',
    manifest: { mainModule: 'tests/assembly/worker.mjs', modulesRoot: fileURLToPath(root), modules },
    env: { LEDGER: { type: 'durable-object', worker: 'mail-assembly', exportName: 'MailLedger' }, QUEUE: { type: 'queue', name: 'assembly-events' } },
    triggers: [{ type: 'queue', name: 'assembly-events', maxBatchTimeout: 0 }, { type: 'email', addresses: ['receiver@example.test'] }],
    exports: { MailLedger: { type: 'durable-object', storage: 'sqlite' } },
  } }] });
}
export async function request(runtime, path, value) {
  const response = await runtime.dispatchFetch(`https://mail.test/${path}`, { method: 'POST', body: JSON.stringify(value) });
  if (response.status !== 200) throw new Error(`Assembly route failed: ${response.status} ${await response.text()}`);
  return response.json();
}
