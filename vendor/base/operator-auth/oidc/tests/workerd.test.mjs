import test from 'node:test';
import assert from 'node:assert/strict';
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
const output = await build({ entryPoints: [fileURLToPath(new URL('./worker.mjs', import.meta.url))], bundle: true, write: false, format: 'esm', platform: 'browser', target: 'es2022' });
const schema = await readFile(new URL('../../schema/operator-auth.sql', import.meta.url), 'utf8') + await readFile(new URL('../schema/oidc.sql', import.meta.url), 'utf8');

test('bundled portable adapter runs real crypto and atomic persisted D1 in workerd', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'oidc-workerd-')); const key = await keys();
  const init = () => new Miniflare({ ...convertV4MiniflareOptions({ modules: true, cf: false, script: output.outputFiles[0].text, compatibilityDate: '2026-09-01', d1Databases: { DB: 'oidc-db' }, bindings: { TEST_KEY: JSON.stringify(key) } }), resourcePersistencePath: join(directory, 'state') });
  let mf = init(); t.after(async () => { await mf.dispose(); await rm(directory, { recursive: true, force: true }); });
  const db = await mf.getD1Database('DB');
  const statements = schema.replace(/^--.*$/gm, '').match(/CREATE TRIGGER[\s\S]*?END;|CREATE (?:TABLE|INDEX)[\s\S]*?;/g);
  for (const statement of statements) await db.prepare(statement).run();
  await db.exec('CREATE TABLE fixture_grants(code TEXT PRIMARY KEY,payload TEXT NOT NULL);');
  const call = (path, { method = 'GET', input, cookie, headers = {} } = {}) => mf.dispatchFetch('http://localhost/__test_dispatch', { method: 'POST', redirect: 'manual', body: JSON.stringify({ url: `https://app.example${path}`, method, headers: { Host: 'app.example', ...(method === 'POST' ? { Origin: 'https://app.example', 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}), ...headers }, ...(input !== undefined ? { body: JSON.stringify(input) } : {}) }) });
  assert.equal((await call('/auth/bootstrap', { method: 'POST', input: { token: 'only-for-tests-real-core-setup-secret', displayName: 'Owner' } })).status, 303);
  async function flow() {
    const start = await call('/auth/oidc/start', { method: 'POST', input: { returnTo: '/private' } }); assert.equal(start.status, 303, await start.clone().text());
    const location = start.headers.get('location'); const { code } = await (await call('/__grant', { method: 'POST', input: { location } })).json();
    return { path: `/auth/oidc/callback?state=${new URL(location).searchParams.get('state')}&code=${code}`, cookie: start.headers.get('set-cookie').split(';')[0] };
  }
  const f = await flow(); await mf.dispose(); mf = init(); await mf.ready;
  assert.equal((await call(f.path)).status, 400);
  const results = await Promise.all([call(f.path, f), call(f.path, f)]);
  assert.deepEqual(results.map(r => r.status).sort(), [303, 400]);
  const success = results.find(r => r.status === 303);
  const cookies = success.headers.getSetCookie(); const session = cookies.find(c => c.startsWith('__Host-operator_session=')); assert.ok(session);
  assert.deepEqual(await (await call('/private', { cookie: session.split(';')[0] })).json(), { kind: 'oidc', email: 'owner@example.com' });
  assert.equal((await call(f.path, f)).status, 400);
  const wrongHost = await flow(); assert.equal((await call(wrongHost.path, { ...wrongHost, headers: { Host: 'attacker.example' } })).status, 403);
  assert.equal((await call(wrongHost.path, wrongHost)).status, 303);
  const db2 = await mf.getD1Database('DB');
  assert.equal((await db2.prepare('SELECT COUNT(*) AS n FROM oa_operators').first()).n, 1);
  assert.equal((await db2.prepare("SELECT COUNT(*) AS n FROM oa_sessions WHERE kind='oidc'").first()).n, 2);
});
