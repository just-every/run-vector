import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, symlink, rm, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { packageBuild } from '../pack.mjs';
import { vectorPlan } from '../plan.mjs';
import { main } from '../controller.mjs';
import { prepare } from '../prepare.mjs';
import { hash } from '../../../vendor/base/deploy-kit/validation.mjs';
import { providerFixture } from './cloudflare-edge/index.mjs';
const configuration = { version: 1, workersDev: true, worker: 'rer-seedproof-vector', FIRST_OWNER_EMAIL: 'owner@example.test', FIRST_OWNER_NAME: 'Test owner', WORKSPACE_NAME: 'Test workspace', WORKSPACE_TIMEZONE: 'Australia/Brisbane', DEFAULT_TEAM_NAME: 'Test team', DEFAULT_TEAM_PREFIX: 'TEST', MAIL_FROM: 'auth@example.test' };
const file = (path, bytes) => ({ path, sha256: hash(bytes), base64: Buffer.from(bytes).toString('base64') });
const sql = 'CREATE TABLE notes(id INTEGER PRIMARY KEY, body TEXT);';
const artifact = { version: 1, source: { sha: '1'.repeat(40), tree: '2'.repeat(40) }, run: { id: '103', attempt: '1' }, main: 'index.js', modules: [file('index.js', 'export default {}')], assets: [file('index.html', '<h1>Vector</h1>')], migrations: [{ binding: 'DB', name: '0001_notes.sql', sql, sha256: hash(sql) }] };
async function directory(t) { const root = await mkdtemp(join(await realpath(tmpdir()), 'vector-deploy-')); t.after(() => rm(root, { recursive: true, force: true })); return root; }

test('reviewed Vector plan admits exact resources, minute Cron and production mail; rejects executable/extra inputs', () => {
  const plan = vectorPlan(artifact, configuration, 'https://rer-seedproof-vector.example.workers.dev');
  assert.deepEqual(plan.crons, ['* * * * *']);
  assert.equal(plan.d1[0].name, 'rer-seedproof-vector-db'); assert.equal(plan.r2[0].binding, 'FILES');
  assert.equal(plan.vars.SEED_SAMPLE_DATA, 'false'); assert.equal(plan.vars.MAIL_PROVIDER, 'sendgrid');
  assert.deepEqual(plan.secrets.map(x => x.binding), ['SESSION_SECRET', 'MAIL_API_KEY']);
  for (const change of [{ worker: '../evil' }, { command: 'evil' }, { workersDev: false }, { DEFAULT_TEAM_PREFIX: 'bad' }, { WORKSPACE_TIMEZONE: 'bad' }]) assert.throws(() => vectorPlan(artifact, { ...configuration, ...change }, 'https://rer-seedproof-vector.example.workers.dev'));
  assert.throws(() => vectorPlan(artifact, configuration, 'https://attacker.example'));
});

test('seed controller first setup preserves data and repeated deploy has no writes and byte-identical receipt', async t => {
  const root = await directory(t); const fixture = providerFixture(); t.after(() => fixture.close());
  const artifactPath = join(root, 'artifact.json'); const planPath = join(root, 'plan.json'); const receiptPath = join(root, 'receipt.json');
  const bytes = JSON.stringify(artifact); await writeFile(artifactPath, bytes); await writeFile(planPath, JSON.stringify(configuration));
  const env = { CF_THROWAWAY_ACCOUNT_ID: fixture.accountId, CF_THROWAWAY_API_TOKEN: fixture.token, RER_DEPLOY_ARTIFACT: artifactPath, RER_DEPLOY_PLAN: planPath, RER_DEPLOY_RECEIPT: receiptPath, RER_DEPLOY_ARTIFACT_SHA256: hash(bytes), RER_DEPLOY_SOURCE_SHA: artifact.source.sha, RER_DEPLOY_RUN_ID: '103', RER_DEPLOY_RUN_ATTEMPT: '1', SESSION_SECRET: 'test-only-session-secret-over-thirty-two-bytes', MAIL_API_KEY: 'test-only-mail-key' };
  const first = await main(['setup'], env, { fetch: fixture.fetch }); assert.equal(first.changed, true);
  fixture.state.databases[0].db.exec("INSERT INTO notes(body) VALUES('retained')"); fixture.state.objects.set('owner.txt', Buffer.from('retained'));
  const receipt = await readFile(receiptPath); const writes = fixture.state.writes.length;
  delete env.SESSION_SECRET; delete env.MAIL_API_KEY;
  const repeat = await main(['deploy'], env, { fetch: fixture.fetch }); assert.equal(repeat.changed, false);
  assert.equal(fixture.state.writes.length, writes); assert.deepEqual(await readFile(receiptPath), receipt);
  assert.equal(fixture.state.databases[0].db.prepare('SELECT body FROM notes').get().body, 'retained');
  assert.equal(fixture.state.objects.get('owner.txt').toString(), 'retained');
  await main(['health'], env, { fetch: fixture.fetch }); assert.equal(fixture.state.writes.length, writes);
  assert(!receipt.toString().includes('test-only-mail-key'));
  fixture.state.schedules = []; await assert.rejects(main(['deploy'], env, { fetch: fixture.fetch }), /cron-drift/); assert.equal(fixture.state.writes.length, writes);
});

test('packing keeps lazy runtime chunks and immutable SQL, excludes metadata and rejects links', async t => {
  const root = await directory(t);
  await mkdir(join(root, 'dist/server/.vite'), { recursive: true }); await mkdir(join(root, 'dist/client'), { recursive: true }); await mkdir(join(root, 'migrations/core'), { recursive: true });
  await writeFile(join(root, 'dist/server/wrangler.json'), JSON.stringify({ main: 'index.js', no_bundle: true, rules: [{ type: 'ESModule', globs: ['**/*.js', '**/*.mjs'] }] }));
  await writeFile(join(root, 'dist/server/index.js'), 'export default {}'); await writeFile(join(root, 'dist/server/lazy.mjs'), 'export const value = 1');
  await writeFile(join(root, 'dist/server/.vite/manifest.json'), '{}'); await writeFile(join(root, 'dist/client/app.css'), 'body{}'); await writeFile(join(root, 'migrations/core/0001_notes.sql'), sql);
  const packed = await packageBuild({ root, source: artifact.source, runIdentity: artifact.run });
  assert.deepEqual(packed.modules.map(x => x.path), ['index.js', 'lazy.mjs']); assert.equal(packed.migrations[0].sha256, hash(sql));
  await symlink(join(root, 'dist/server/index.js'), join(root, 'dist/client/leak.js'));
  await assert.rejects(packageBuild({ root, source: artifact.source, runIdentity: artifact.run }), /symlink/);
});

test('prepare rejects credential-bearing environment before any build or provider access', async () => {
  for (const name of ['CLOUDFLARE_RER_STAGE_TOKEN', 'MAIL_API_KEY', 'SESSION_SECRET', 'NODE_OPTIONS', 'NODE_PATH']) await assert.rejects(prepare({ [name]: 'test-only' }), /forbidden/);
  await assert.rejects(main(['deploy'], {}), error => error.message === 'missing-input' && error.inputs.includes('RER_DEPLOY_PLAN'));
});
