import { DatabaseSync } from 'node:sqlite';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createOperatorAuth } from '../../index.mjs';
import { createOidcClient, createOidcHandler } from '../index.mjs';
import { idp } from './idp.mjs';
const schema = await readFile(new URL('../../schema/operator-auth.sql', import.meta.url), 'utf8');
const oidcSchema = await readFile(new URL('../schema/oidc.sql', import.meta.url), 'utf8');
export const config = { origin: 'https://app.example', issuer: 'https://idp.example', redirectUri: 'https://app.example/auth/oidc/callback', clientId: 'client', clientSecret: 'fixture-secret', transactionSecret: 'only-for-tests-independent-correlation-secret' };
export function database(sqlite) {
  function statement(sql, values = []) {
    return { bind: (...bound) => statement(sql, bound),
      async first() { return sqlite.prepare(sql).get(...values) ?? null; },
      async all() { return { results: sqlite.prepare(sql).all(...values), meta: { changes: 0 } }; },
      async run() { const results = sqlite.prepare(sql).all(...values); return { results, meta: { changes: sqlite.prepare('SELECT changes() AS n').get().n } }; },
    };
  }
  return { prepare: statement, async batch(statements) { sqlite.exec('BEGIN IMMEDIATE'); try { const results = []; for (const s of statements) results.push(await s.run()); sqlite.exec('COMMIT'); return results; } catch (e) { sqlite.exec('ROLLBACK'); throw e; } } };
}
export async function runtime(key, options = {}, overrides = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'oidc-test-')); const file = join(dir, 'auth.sqlite');
  let sqlite = new DatabaseSync(file); sqlite.exec(schema + oidcSchema);
  const provider = idp(key, options); const cfg = { ...config, algorithms: [key.public.alg], ...overrides };
  let db, auth, client, handler;
  function init() {
    db = database(sqlite);
    auth = createOperatorAuth({ db, config: { origin: cfg.origin, OWNER_EMAIL: 'owner@example.com', SESSION_SECRET: 'only-for-tests-real-core-session-secret', SETUP_TOKEN: 'only-for-tests-real-core-setup-secret', externalIssuers: [cfg.issuer] }, clientIp: () => '192.0.2.1' });
    client = createOidcClient({ db, auth, config: cfg, clientIp: () => '192.0.2.1', fetch: provider.fetch }); handler = createOidcHandler(client);
  }
  init();
  const request = (path, { method = 'GET', cookie, body, headers = {} } = {}) => new Request(new URL(path, cfg.origin), { method, headers: { Host: new URL(cfg.origin).host, ...(method === 'POST' ? { Origin: cfg.origin, 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}), ...headers }, ...(body === undefined ? {} : { body: typeof body === 'string' ? body : JSON.stringify(body) }) });
  const api = {
    provider, cfg, request, get sqlite() { return sqlite; }, get auth() { return auth; }, get client() { return client; }, get db() { return db; },
    call: (path, init) => handler(request(path, init)),
    async bootstrap() { return auth.bootstrap(request('/auth/bootstrap', { method: 'POST' }), { token: 'only-for-tests-real-core-setup-secret', displayName: 'Owner' }); },
    async begin(returnTo = '/app') { return handler(request('/auth/oidc/start', { method: 'POST', body: { returnTo } })); },
    async flow(returnTo) { const start = await api.begin(returnTo); if (start.status !== 303) throw new Error(`Start failed: ${await start.text()}`); const location = new URL(start.headers.get('location')); const code = provider.grant(location); const state = location.searchParams.get('state'); const cookie = start.headers.get('set-cookie').split(';')[0]; return { start, location, code, state, cookie, path: `/auth/oidc/callback?code=${code}&state=${state}` }; },
    async finish(flow, overrides = {}) { return handler(request(flow.path, { cookie: flow.cookie, ...overrides })); },
    restart() { sqlite.close(); sqlite = new DatabaseSync(file); init(); },
    async close() { sqlite.close(); await rm(dir, { recursive: true, force: true }); },
  };
  return api;
}
