// Node-only test loader; application and conformance modules get Web globals only.
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
const context = vm.createContext({ TextEncoder, TextDecoder, URL, Headers, Response, Request, AbortSignal, setTimeout, clearTimeout, btoa, atob });
const cache = new Map();
async function load(url) {
  if (!url.pathname.startsWith(new URL('../../', import.meta.url).pathname) || !url.pathname.endsWith('.mjs')) throw new Error('Unexpected import');
  if (!cache.has(url.href)) {
    cache.set(url.href, readFile(url, 'utf8').then(source => new vm.SourceTextModule(source, { context, identifier: url.href })));
  }
  return cache.get(url.href);
}
const module = await load(new URL('./conformance.mjs', import.meta.url));
await module.link((specifier, parent) => {
  if (!specifier.startsWith('.')) throw new Error('Nonportable import');
  return load(new URL(specifier, parent.identifier));
});
await module.evaluate();
if (vm.runInContext('typeof Buffer !== "undefined" || typeof process !== "undefined" || typeof require !== "undefined"', context)) throw new Error('Node globals leaked');
console.log(JSON.stringify(await module.namespace.runSendGridConformance()));
