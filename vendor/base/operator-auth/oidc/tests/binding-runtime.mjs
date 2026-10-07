// Test-only real workerd/D1 harness with deployment-owned provider configuration.
import { createRequire } from 'node:module';
import { readFile, readdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { keys } from './idp.mjs';
const root = process.env.OIDC_TEST_DEPENDENCY_ROOT ?? fileURLToPath(new URL('../../../../', import.meta.url));
const packages = await readdir(join(root, 'node_modules/.pnpm'));
const wrangler = packages.find(n => n.startsWith('wrangler@4.129.1_'));
if (!wrangler) throw new Error('Install the frozen workspace dependencies (Wrangler 4.129.1).');
const require = createRequire(join(root, 'node_modules/.pnpm', wrangler, 'node_modules/wrangler/package.json'));
const { Miniflare, convertV4MiniflareOptions } = require('miniflare');
const { build } = require('esbuild');
const output = await build({ entryPoints: [fileURLToPath(new URL('./binding-worker.mjs', import.meta.url))], bundle: true, write: false, format: 'esm', platform: 'browser', target: 'es2022' });
const schema = await readFile(new URL('../../schema/operator-auth.sql', import.meta.url), 'utf8') + await readFile(new URL('../schema/oidc.sql', import.meta.url), 'utf8');
const key = await keys();
export const providers = [{ issuer: 'https://issuer-a.example' }, { issuer: 'https://issuer-b.example' }];
export const post = (input, cookie) => ({ method: 'POST', input, cookie });
export function sessionCookie(response) { return response.headers.getSetCookie().find(c => c.startsWith('__Host-operator_session='))?.split(';')[0]; }
export async function runtime(t, entries = providers, core = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'oidc-binding-'));
  const init = () => new Miniflare({ ...convertV4MiniflareOptions({ modules: true, cf: false, script: output.outputFiles[0].text, compatibilityDate: '2026-09-01', d1Databases: { DB: 'oidc-binding-db' }, bindings: { TEST_KEY: JSON.stringify(key), TEST_PROVIDERS: JSON.stringify(entries), TEST_CORE: JSON.stringify(core) } }), resourcePersistencePath: join(directory, 'state') });
  let mf = init();
  t.after(async () => { await mf.dispose(); await rm(directory, { recursive: true, force: true }); });
  let db = await mf.getD1Database('DB');
  for (const statement of schema.replace(/^--.*$/gm, '').match(/CREATE TRIGGER[\s\S]*?END;|CREATE (?:TABLE|INDEX)[\s\S]*?;/g)) await db.prepare(statement).run();
  await db.exec('CREATE TABLE fixture_grants(code TEXT PRIMARY KEY,payload TEXT NOT NULL);');
  const call = (path, { method = 'GET', input, cookie, headers = {} } = {}) => mf.dispatchFetch('http://localhost/__test_dispatch', { method: 'POST', redirect: 'manual', body: JSON.stringify({ url: `https://app.example${path}`, method, headers: { Host: 'app.example', ...(method === 'POST' ? { Origin: 'https://app.example', 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}), ...headers }, ...(input !== undefined ? { body: JSON.stringify(input) } : {}) }) });
  const r = { call, get db() { return db; },
    async bootstrap() { const response = await call('/auth/bootstrap', post({ token: 'only-for-tests-binding-setup-secret', displayName: 'Owner' })); if (response.status !== 303) throw new Error(await response.text()); return sessionCookie(response); },
    async flow(claims = {}, provider = 0, input = {}) {
      const start = await call(`/auth/oidc/${provider}/start`, post({ returnTo: '/private', ...input }));
      if (start.status !== 303) throw new Error(await start.text());
      const location = start.headers.get('location');
      const { code } = await (await call('/__grant', post({ location, claims }))).json();
      return { path: `/auth/oidc/${provider}/callback?state=${new URL(location).searchParams.get('state')}&code=${code}`, cookie: start.headers.get('set-cookie').split(';')[0] };
    },
    finish: f => call(f.path, f),
    async login(claims = {}, provider = 0, input = {}) { return r.finish(await r.flow(claims, provider, input)); },
    async counts() { const a = await db.prepare('SELECT COUNT(*) AS n FROM oa_external_identities').first(); const b = await db.prepare("SELECT COUNT(*) AS n FROM oa_sessions WHERE kind='oidc'").first(); return { bindings: a.n, sessions: b.n }; },
    async restart() { await mf.dispose(); mf = init(); db = await mf.getD1Database('DB'); },
  };
  return r;
}
