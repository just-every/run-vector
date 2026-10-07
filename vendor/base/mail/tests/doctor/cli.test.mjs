import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { doctorOptions } from '../../doctor.mjs';

const cli = fileURLToPath(new URL('../../doctor.mjs', import.meta.url));
function run(args) { return spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8', env: { PATH: process.env.PATH } }); }

test('real CLI sample JSON and human plans work without assembled adapters or secrets', () => {
  const args = ['--domain', 'mail.example.com', '--provider', 'resend', '--plan'];
  const json = run([...args, '--json']); assert.equal(json.status, 0, json.stderr);
  const result = JSON.parse(json.stdout); assert.equal(result.items.length, 6);
  assert.ok(result.items.every(item => item.status === 'not_checked'));
  const human = run(args); assert.equal(human.status, 0, human.stderr);
  for (const label of ['MX', 'SPF', 'DKIM', 'DMARC', 'SEND', 'RECEIVE']) assert.match(human.stdout, new RegExp(`${label}:`));
});

test('CLI live requires explicit configuration and rejects mutually exclusive/unknown flags', () => {
  for (const args of [ ['--live'], ['--live', '--plan'], ['--provider'], ['--api-key', 'private-key'] ]) {
    const result = run(args); assert.equal(result.status, 2); assert.doesNotMatch(result.stderr, /private-key/);
  }
});

test('CLI config permits public setup only; live secrets are read from named environment keys', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'mail-doctor-'));
  try {
    const path = join(dir, 'config.json');
    const config = { domain: 'mail.example.com', provider: 'resend', send: { from: 'sender@mail.example.com', to: 'inbox@receive.example.com' }, receive: { provider: 'resend' } };
    await writeFile(path, JSON.stringify(config));
    const parsed = await doctorOptions(['--live', '--config', path], { MAIL_DOCTOR_SEND_API_KEY: 'test-send', MAIL_DOCTOR_RECEIVE_API_KEY: 'test-receive' });
    assert.equal(parsed.options.send.config.apiKey, 'test-send');
    assert.equal(parsed.options.receive.apiKey, 'test-receive');
    assert.equal(run(['--live', '--config', path]).status, 2);
    await writeFile(path, JSON.stringify({ ...config, apiKey: 'must-never-print' }));
    const refused = run(['--live', '--config', path]); assert.equal(refused.status, 2);
    assert.doesNotMatch(refused.stderr, /must-never-print/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('protected proof entry rejects local execution before sending', () => {
  const entry = fileURLToPath(new URL('../../live-proof/run.mjs', import.meta.url));
  const result = spawnSync(process.execPath, [entry], { encoding: 'utf8', env: { PATH: process.env.PATH } });
  assert.equal(result.status, 2); assert.match(result.stderr, /protected Actions metadata/);
});
