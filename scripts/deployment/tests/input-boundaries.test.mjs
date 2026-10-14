import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, realpath, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { bootstrapConfig } from '../../../src/core/features/bootstrap/config.ts';
import { configure } from '../../../vendor/base/operator-auth/config.mjs';
import { validateConfig } from '../../../vendor/base/mail/src/core/validation.mjs';
import { serializeSendGridMessage } from '../../../vendor/base/mail/src/adapters/sendgrid/serialize.mjs';
import { providerFixture } from './cloudflare-edge/index.mjs';
import { hash } from '@runeditrun/rer/internal/modules/deploy-kit/validation.mjs';
import { vectorPlan } from '../plan.mjs';
import { validateSuppliedSecrets } from '../input-validation.mjs';
import { main } from '../controller.mjs';

const configuration = { version: 1, workersDev: true, worker: 'rer-seedproof-vector', FIRST_OWNER_EMAIL: 'owner@example.test', FIRST_OWNER_NAME: 'Owner', WORKSPACE_NAME: 'Workspace', WORKSPACE_TIMEZONE: 'Australia/Brisbane', DEFAULT_TEAM_NAME: 'Team', DEFAULT_TEAM_PREFIX: 'TEST', MAIL_FROM: 'Vector <auth@example.test>' };
const origin = 'https://rer-seedproof-vector.fixture-account.workers.dev';
const moduleBytes = 'throw new Error("candidate code must remain inert");';
const artifact = { version: 1, source: { sha: '1'.repeat(40), tree: '2'.repeat(40) }, run: { id: '103', attempt: '1' }, main: 'index.js', modules: [{ path: 'index.js', sha256: hash(moduleBytes), base64: Buffer.from(moduleBytes).toString('base64') }], assets: [], migrations: [] };
const names = ['FIRST_OWNER_NAME', 'WORKSPACE_NAME', 'DEFAULT_TEAM_NAME'];
const longEmail = `${'a'.repeat(64)}@${'b'.repeat(63)}.${'c'.repeat(63)}.${'d'.repeat(61)}`;
assert.equal(longEmail.length, 254);
const validPublic = [
  ...names.flatMap(key => [1, 200].map(length => ({ [key]: 'x'.repeat(length) }))),
  ...names.map(key => ({ [key]: `  ${'x'.repeat(200)}  ` })),
  ...['UTC', 'Etc/GMT+5', ' Australia/Brisbane '].map(WORKSPACE_TIMEZONE => ({ WORKSPACE_TIMEZONE })),
  ...['AA', 'ABCDEFGHIJ'].map(DEFAULT_TEAM_PREFIX => ({ DEFAULT_TEAM_PREFIX })),
  ...[longEmail, "O'Connor+Proof@Example.TEST"].map(FIRST_OWNER_EMAIL => ({ FIRST_OWNER_EMAIL })),
  ...['auth@example.test', '"Vector Proof" <auth@example.test>', 'Véctor <auth@example.test>', longEmail, `${'N'.repeat(492)} <auth@example.test>`].map(MAIL_FROM => ({ MAIL_FROM })),
];
const invalidBootstrap = [
  ...names.flatMap(key => ['', ' \t ', 'x'.repeat(201), ` ${'x'.repeat(201)} `, null, 123].map(value => ({ [key]: value }))),
  ...['+05:30', '-08:00', ' +05:30 ', 'Not/A_Timezone', 'x'.repeat(101), '', '  '].map(WORKSPACE_TIMEZONE => ({ WORKSPACE_TIMEZONE })),
  ...['A', 'ABCDEFGHIJK', 'lower', ' AA '].map(DEFAULT_TEAM_PREFIX => ({ DEFAULT_TEAM_PREFIX })),
  ...[`${longEmail}e`, '.owner@example.test', 'own..er@example.test', 'owner.@example.test', 'owner@example.t', 'owner@-example.test', 'owner@example.123', ' owner@example.test ', 'owner!@example.test'].map(FIRST_OWNER_EMAIL => ({ FIRST_OWNER_EMAIL })),
];
// Bootstrap accepts these, but the real sign-in mail adapter cannot deliver them.
const invalidMail = [
  { FIRST_OWNER_EMAIL: `${'a'.repeat(65)}@example.test` },
  { FIRST_OWNER_EMAIL: `owner@${'a'.repeat(64)}.test` },
  { FIRST_OWNER_EMAIL: 'owner@example-.test' },
  ...['not-a-mailbox', 'auth@example.test\r\nBcc: other@example.test', 'auth\x00@example.test', 'auth\x7f@example.test', 'Véctor <äuth@example.test>', 'Vector <auth@example.test>, other@example.test', 'Vector <auth@example.test> suffix', 'Bad"Name <auth@example.test>', 'Bad\\Name <auth@example.test>', `${'a'.repeat(65)}@example.test`, `auth@${'a'.repeat(64)}.test`, `${longEmail}e`, '.auth@example.test', 'auth..name@example.test', 'auth@example-.test'].map(MAIL_FROM => ({ MAIL_FROM })),
];
const invalidPublic = [...invalidBootstrap, ...invalidMail];
const mailMessage = config => ({ deliveryId: 'test-only-delivery', from: config.MAIL_FROM, to: [config.FIRST_OWNER_EMAIL], subject: 'Sign in', text: 'Sign in to Vector' });

test('reviewed public boundaries admit actual bootstrap and SendGrid validators without changing input values', () => {
  for (const change of validPublic) {
    const input = { ...configuration, ...change };
    const vars = vectorPlan(artifact, input, origin).vars;
    assert.doesNotThrow(() => bootstrapConfig(vars));
    assert.doesNotThrow(() => serializeSendGridMessage(mailMessage(vars)));
    for (const [key, value] of Object.entries(change)) assert.equal(vars[key], value);
  }
  const parsed = bootstrapConfig(vectorPlan(artifact, { ...configuration, FIRST_OWNER_NAME: ' Owner ', FIRST_OWNER_EMAIL: 'OWNER@Example.TEST' }, origin).vars);
  assert.equal(parsed.name, 'Owner');
  assert.equal(parsed.email, 'owner@example.test');
});

test('controller rejects every exercised bootstrap and mail boundary rejected by the actual runtime validators', () => {
  for (const change of invalidBootstrap) {
    const input = { ...configuration, ...change };
    assert.throws(() => bootstrapConfig(input));
    assert.throws(() => vectorPlan(artifact, input, origin));
  }
  for (const change of invalidMail) {
    const input = { ...configuration, ...change };
    assert.doesNotThrow(() => bootstrapConfig(input));
    assert.throws(() => serializeSendGridMessage(mailMessage(input)));
    assert.throws(() => vectorPlan(artifact, input, origin));
  }
});

const validSecrets = [
  { SESSION_SECRET: 's'.repeat(32), MAIL_API_KEY: 'k' },
  { SESSION_SECRET: 's'.repeat(1024), MAIL_API_KEY: 'k'.repeat(4096) },
];
const invalidSecrets = [
  ...['', 's'.repeat(31), 's'.repeat(1025), 123, null].map(SESSION_SECRET => ({ SESSION_SECRET })),
  ...['', 'k'.repeat(4097), 'with space', 'leading\t', 'key\n', 'key\x00', 'key\x7f', 123, null].map(MAIL_API_KEY => ({ MAIL_API_KEY })),
];
test('supplied secrets match actual auth/mail limits and may be omitted for inheritance', () => {
  assert.doesNotThrow(() => validateSuppliedSecrets({}));
  for (const input of validSecrets) {
    assert.doesNotThrow(() => configure({ origin, OWNER_EMAIL: configuration.FIRST_OWNER_EMAIL, SESSION_SECRET: input.SESSION_SECRET }));
    assert.doesNotThrow(() => validateConfig({ provider: 'sendgrid', mode: 'production', apiKey: input.MAIL_API_KEY }));
    assert.doesNotThrow(() => validateSuppliedSecrets(input));
  }
  for (const input of invalidSecrets) {
    if ('SESSION_SECRET' in input) assert.throws(() => configure({ origin, OWNER_EMAIL: configuration.FIRST_OWNER_EMAIL, ...input }));
    else assert.throws(() => validateConfig({ provider: 'sendgrid', mode: 'production', apiKey: input.MAIL_API_KEY }));
    assert.throws(() => validateSuppliedSecrets(input), /^Error: invalid-secret-(SESSION_SECRET|MAIL_API_KEY)$/);
  }
});

async function controllerInputs(t) {
  const root = await mkdtemp(join(await realpath(tmpdir()), 'vector-input-boundaries-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const fixture = providerFixture(); t.after(() => fixture.close());
  const bytes = JSON.stringify(artifact);
  const env = { CF_THROWAWAY_ACCOUNT_ID: fixture.accountId, CF_THROWAWAY_API_TOKEN: fixture.token, RER_DEPLOY_ARTIFACT: join(root, 'artifact.json'), RER_DEPLOY_PLAN: join(root, 'plan.json'), RER_DEPLOY_RECEIPT: join(root, 'receipt.json'), RER_DEPLOY_ARTIFACT_SHA256: hash(bytes), RER_DEPLOY_SOURCE_SHA: artifact.source.sha, RER_DEPLOY_RUN_ID: artifact.run.id, RER_DEPLOY_RUN_ATTEMPT: artifact.run.attempt, ...validSecrets[0] };
  await writeFile(env.RER_DEPLOY_ARTIFACT, bytes);
  await writeFile(env.RER_DEPLOY_PLAN, JSON.stringify(configuration));
  return { env, fixture };
}

test('invalid reviewed JSON and secrets fail setup/deploy before any provider writes or receipt', async t => {
  const { env, fixture } = await controllerInputs(t);
  for (const command of ['setup', 'deploy']) {
    for (const change of invalidPublic) {
      await writeFile(env.RER_DEPLOY_PLAN, JSON.stringify({ ...configuration, ...change }));
      await assert.rejects(main([command], env, { fetch: fixture.fetch }));
      assert.equal(fixture.state.writes.length, 0);
      await assert.rejects(access(env.RER_DEPLOY_RECEIPT), { code: 'ENOENT' });
    }
    await writeFile(env.RER_DEPLOY_PLAN, JSON.stringify(configuration));
    for (const change of invalidSecrets) {
      const calls = fixture.state.calls.length;
      await assert.rejects(main([command], { ...env, ...change }, { fetch: fixture.fetch }), /^Error: invalid-secret-(SESSION_SECRET|MAIL_API_KEY)$/);
      assert.equal(fixture.state.calls.length, calls);
      assert.equal(fixture.state.writes.length, 0);
      await assert.rejects(access(env.RER_DEPLOY_RECEIPT), { code: 'ENOENT' });
    }
  }
  assert(fixture.state.calls.every(call => call.method === 'GET' && call.path === '/workers/subdomain'));
});

test('valid boundary deployment keeps candidate inert and reuses opaque secrets with byte-identical receipt', async t => {
  for (const secrets of validSecrets) {
    const { env, fixture } = await controllerInputs(t);
    Object.assign(env, secrets);
    await writeFile(env.RER_DEPLOY_PLAN, JSON.stringify({ ...configuration, FIRST_OWNER_NAME: 'N'.repeat(200), WORKSPACE_NAME: 'W'.repeat(200), DEFAULT_TEAM_NAME: 'T'.repeat(200), FIRST_OWNER_EMAIL: longEmail, WORKSPACE_TIMEZONE: 'Etc/GMT+5' }));
    assert.equal((await main(['setup'], env, { fetch: fixture.fetch })).changed, true);
    const receipt = await readFile(env.RER_DEPLOY_RECEIPT);
    const writes = fixture.state.writes.length;
    delete env.SESSION_SECRET; delete env.MAIL_API_KEY;
    assert.equal((await main(['deploy'], env, { fetch: fixture.fetch })).changed, false);
    assert.equal(fixture.state.writes.length, writes);
    assert.deepEqual(await readFile(env.RER_DEPLOY_RECEIPT), receipt);
  }
});
