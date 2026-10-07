import { createRequire } from 'node:module';
import { readFile, readdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const packages = await readdir(join(root, 'node_modules/.pnpm'));
const wrangler = packages.find((name) => name.startsWith('wrangler@4.129.1_'));
if (!wrangler) throw new Error('Install the frozen workspace dependencies before running browser auth tests.');
const require = createRequire(join(root, 'node_modules/.pnpm', wrangler, 'node_modules/wrangler/package.json'));
const { Miniflare, convertV4MiniflareOptions } = require('miniflare');
const { build } = require('esbuild');
const browserRequire = createRequire(join(root, 'default-seed/package.json'));
export const { chromium } = browserRequire('@playwright/test');
const output = await build({
  entryPoints: [fileURLToPath(new URL('./confirmation-browser-worker.mjs', import.meta.url))],
  bundle: true, write: false, format: 'esm', platform: 'browser', target: 'es2022',
});
const schema = await readFile(new URL('../schema/operator-auth.sql', import.meta.url), 'utf8');

export async function browserRuntime() {
  const directory = await mkdtemp(join(tmpdir(), 'operator-auth-browser-'));
  const config = {
    origin: 'http://127.0.0.1', local: true, OWNER_EMAIL: 'owner@example.com',
    SESSION_SECRET: 'browser-test-only-session-secret-at-least-32-characters',
    SETUP_TOKEN: 'browser-test-only-setup-token-at-least-32-characters',
    MAIL_FROM: 'auth@example.com', ipLimit: 1000, emailLimit: 1000,
  };
  const options = (port = 0) => ({
    ...convertV4MiniflareOptions({
      host: '127.0.0.1', port, modules: true, script: output.outputFiles[0].text,
      compatibilityDate: '2026-09-01', d1Databases: { DB: 'browser-auth' },
      bindings: { TEST_CONFIG: JSON.stringify(config) },
    }),
    resourcePersistencePath: join(directory, 'state'),
  });
  const mf = new Miniflare(options());
  try {
    const address = await mf.ready;
    config.origin = address.origin;
    // Bind config to the actual ephemeral listener before any test requests.
    // Neither the fixture nor production derives authority from a request.
    await mf.setOptions(options(Number(address.port)));
    await mf.ready;
    const db = await mf.getD1Database('DB');
    const statements = schema.replace(/^--.*$/gm, '').match(/CREATE TRIGGER[\s\S]*?END;|CREATE (?:TABLE|INDEX)[\s\S]*?;/g);
    for (const statement of statements) await db.prepare(statement).run();
    await db.exec('CREATE TABLE browser_mail (id INTEGER PRIMARY KEY AUTOINCREMENT, message TEXT NOT NULL);');
    const post = (path, input, headers = {}) => fetch(new URL(path, config.origin), {
      method: 'POST', redirect: 'manual',
      headers: { Origin: config.origin, 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(input),
    });
    const setup = await post('/auth/bootstrap', { token: config.SETUP_TOKEN, displayName: 'Owner' });
    if (setup.status !== 303) throw new Error(`Browser fixture bootstrap failed: ${setup.status}`);
    return {
      origin: config.origin, db, post,
      async issue({ invite = false, returnTo = '/app?source=confirmation#ready' } = {}) {
        const response = invite
          ? await post('/auth/invite', { email: 'invitee@example.com', displayName: 'Invitee', returnTo }, { Cookie: setup.headers.get('set-cookie').split(';')[0] })
          : await post('/auth/magic-link', { email: config.OWNER_EMAIL, returnTo });
        if (response.status !== 202) throw new Error(`Browser fixture link issuance failed: ${response.status}`);
        const row = await db.prepare('SELECT message FROM browser_mail ORDER BY id DESC LIMIT 1').first();
        return new URL(JSON.parse(row.message).text.match(/https?:\/\/\S+/)[0]);
      },
      async close() { await mf.dispose(); await rm(directory, { recursive: true, force: true }); },
    };
  } catch (error) {
    await mf.dispose();
    await rm(directory, { recursive: true, force: true });
    throw error;
  }
}
