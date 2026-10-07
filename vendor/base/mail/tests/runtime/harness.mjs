import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { Miniflare } from 'miniflare';
const root = new URL('../../', import.meta.url);

export async function createWorker(entry, extra = []) {
  const modules = {};
  async function add(path) { modules[path] = { type: 'esm', contents: await readFile(new URL(path, root), 'utf8') }; }
  async function source(directory) {
    for (const item of await readdir(new URL(directory, root), { withFileTypes: true })) {
      if (item.isDirectory()) await source(`${directory}/${item.name}`);
      else if (item.name.endsWith('.mjs')) await add(`${directory}/${item.name}`);
    }
  }
  await source('src');
  for (const path of [entry, ...extra]) await add(path);
  return new Miniflare({ cf: false, resourcePersistencePath: fileURLToPath(new URL('tests/runtime/.state', root)), workers: [{ config: { type: 'worker', name: 'mail-conformance', compatibilityDate: '2026-09-01',
    manifest: { mainModule: entry, modulesRoot: fileURLToPath(root), modules },
  } }] });
}
