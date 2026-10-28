import { readFile, readdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join, resolve, extname } from 'node:path';
import { pathToFileURL } from 'node:url';

async function files(directory) {
  const found = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const name = join(directory, entry.name);
    if (entry.isDirectory()) found.push(...await files(name)); else found.push(name);
  }
  return found;
}

/** Actual production modules and assets; the separate test RPC has no deployed
 * route. Both Workers use the same real D1/R2 installation and native services. */
export async function nativeRuntime({ root, bindings, scratch, generationOnly }) {
  const require = createRequire(join(root, 'package.json'));
  const wrangler = createRequire(require.resolve('wrangler/package.json'));
  const { Miniflare, convertV4MiniflareOptions = value => value } = await import(pathToFileURL(wrangler.resolve('miniflare')));
  const { build } = await import(pathToFileURL(wrangler.resolve('esbuild')));
  const bundle = await build({ entryPoints: ['tests/agent-door/runtime-worker.ts'], bundle: true, write: false,
    format: 'esm', platform: 'neutral', conditions: ['workerd', 'worker', 'module'], mainFields: ['module', 'main'],
    target: 'es2022', external: ['cloudflare:*', 'node:*'],
    plugins: [{ name: 'native-wasm', setup(builder) { builder.onResolve({ filter: /\.wasm$/ }, () => ({ path: './egress.wasm', external: true })); } }],
    loader: { '.css': 'empty' }, logLevel: 'warning' });
  const native = { name: 'native', modulesRoot: scratch, modules: [
    { type: 'ESModule', path: join(scratch, 'native.mjs'), contents: bundle.outputFiles[0].text },
    { type: 'CompiledWasm', path: join(scratch, 'egress.wasm'), contents: await readFile('vendor/base/egress-service/tls/egress.wasm') },
  ],
    compatibilityDate: '2026-09-01', compatibilityFlags: ['nodejs_compat'], bindings,
    d1Databases: { DB: 'vector-agent-conformance' }, r2Buckets: { FILES: 'vector-agent-files' },
    outboundService: () => new Response('No provider is declared for this internal native journey.', { status: 502 }) };
  let workers = [native];
  if (!generationOnly) {
    const directory = resolve('dist/server'), client = resolve('dist/client');
    const config = JSON.parse(await readFile(join(directory, 'wrangler.json'), 'utf8'));
    const types = { '.js': 'ESModule', '.mjs': 'ESModule', '.cjs': 'CommonJS', '.wasm': 'CompiledWasm', '.bin': 'Data', '.txt': 'Text', '.html': 'Text', '.sql': 'Text' };
    const entry = resolve(directory, config.main);
    const modules = [entry, ...(await files(directory)).filter(file => file !== entry && types[extname(file)])]
      .map(path => ({ type: types[extname(path)], path }));
    workers = [{ ...native, name: 'app', script: undefined, modules, modulesRoot: directory,
      compatibilityDate: config.compatibility_date, compatibilityFlags: config.compatibility_flags,
      bindings: { ...config.vars, ...bindings },
      durableObjects: Object.fromEntries((config.durable_objects?.bindings ?? []).filter(item => !item.script_name)
        .map(item => [item.name, { className: item.class_name, useSQLite: true }])),
      assets: { directory: client, binding: config.assets?.binding ?? 'ASSETS', routerConfig: { has_user_worker: true, invoke_user_worker_ahead_of_assets: true } },
    }, native];
  }
  const ingress = { name: 'ingress', modules: true, serviceBindings: { APP: generationOnly ? 'native' : 'app' },
    script: `export default {fetch(request,env){const target=new URL(request.headers.get('x-native-origin-url')),headers=new Headers(request.headers);headers.delete('x-native-origin-url');headers.set('host',target.host);return env.APP.fetch(new Request(target,{method:request.method,headers,redirect:'manual',...(!['GET','HEAD'].includes(request.method)?{body:request.body}:{})}))}}` };
  const mf = new Miniflare(convertV4MiniflareOptions({ host: '127.0.0.1', port: 0, cf: false, defaultPersistRoot: scratch, workers: [ingress, ...workers] }));
  try { await mf.ready; } catch (error) { await mf.dispose(); throw error; }
  return { mf, native: await mf.getWorker('native'), db: await mf.getD1Database('DB', generationOnly ? 'native' : 'app') };
}
