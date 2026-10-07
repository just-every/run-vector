import { createRequire } from 'node:module';
import { readFile, readdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../../../', import.meta.url));
const packages = await readdir(join(root, 'node_modules/.pnpm'));
const wrangler = packages.find((name) => name.startsWith('wrangler@4.129.1_'));
if (!wrangler) throw new Error('Install the frozen workspace dependencies before running operator-auth conformance.');
const require = createRequire(join(root, 'node_modules/.pnpm', wrangler, 'node_modules/wrangler/package.json'));
const { Miniflare, convertV4MiniflareOptions } = require('miniflare');
const { build } = require('esbuild');
const worker = new URL('./worker.mjs', import.meta.url);
const output = await build({ entryPoints: [fileURLToPath(worker)], bundle: true, write: false, format: 'esm', platform: 'browser', target: 'es2022' });
const schema = await readFile(new URL('../../schema/operator-auth.sql', import.meta.url), 'utf8');

export async function openConformanceRuntime({ config, mailStatus, noMail }) {
  const directory = await mkdtemp(join(tmpdir(), 'operator-auth-conformance-'));
  const testOptions = { mailStatus, noMail };
  const init = () => new Miniflare({ ...convertV4MiniflareOptions({
    modules: true,
    script: output.outputFiles[0].text,
    compatibilityDate: '2026-09-01',
    d1Databases: { DB: 'operator-auth-conformance' },
    bindings: { TEST_CONFIG: JSON.stringify(config), TEST_OPTIONS: JSON.stringify(testOptions) },
  }), resourcePersistencePath: resolve(directory, 'state') });

  let mf = init();
  try {
    const db = await mf.getD1Database('DB');
    const statements = schema.replace(/^--.*$/gm, '').match(/CREATE TRIGGER[\s\S]*?END;|CREATE (?:TABLE|INDEX)[\s\S]*?;/g);
    if (!statements) throw new Error('The operator-auth migration did not contain executable D1 statements.');
    for (const statement of statements) await db.prepare(statement).run();
    await db.exec('CREATE TABLE conformance_mail (id INTEGER PRIMARY KEY AUTOINCREMENT, message TEXT NOT NULL);');

    const call = async (path, { method = 'GET', input, cookie, headers = {}, ip = '192.0.2.1' } = {}) => {
      const url = new URL(path, config.origin);
      const requestHeaders = {
        Host: url.host,
        ...(method === 'POST' ? { Origin: config.origin, 'Content-Type': 'application/json' } : {}),
        'X-Test-IP': ip,
        ...(cookie ? { Cookie: cookie } : {}),
        ...headers,
      };
      return mf.dispatchFetch('http://localhost/__conformance_dispatch', {
        method: 'POST',
        redirect: 'manual',
        body: JSON.stringify({
          url: url.href,
          method,
          headers: requestHeaders,
          ...(input !== undefined ? { body: JSON.stringify(input) } : {}),
        }),
      });
    };

    return {
      call,
      privateRequest(cookie, options = {}) { return call('/__conformance/private', { ...options, cookie }); },
      async mails() {
        const result = await db.prepare('SELECT message FROM conformance_mail ORDER BY id').all();
        return result.results.map((row) => JSON.parse(row.message));
      },
      async admitVerifiedIdentity(identity, returnTo) {
        const response = await call('/__conformance/oidc-admit', { method: 'POST', input: { identity, returnTo } });
        if (!response.ok) throw new Error(`Verified OIDC admission returned ${response.status}.`);
        const body = await response.json();
        const setCookie = response.headers.get('set-cookie');
        if (!setCookie) throw new Error('Verified OIDC admission returned no session cookie.');
        return { ...body, cookie: setCookie };
      },
      async close() {
        await mf.dispose();
        await rm(directory, { recursive: true, force: true });
      },
    };
  } catch (error) {
    await mf.dispose();
    await rm(directory, { recursive: true, force: true });
    throw error;
  }
}
