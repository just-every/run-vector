import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { verificationDirectory } from '../../verification-paths.mjs';

test('fresh diagnostic files stay ignored and cannot overwrite historical tracked evidence', async t => {
  await mkdir(verificationDirectory, { recursive: true });
  const directory = await mkdtemp(resolve(verificationDirectory, 'output-policy-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const file = resolve(directory, 'check-results.json');
  await writeFile(file, JSON.stringify({ synthetic: true }));
  assert.equal(execFileSync('git', ['check-ignore', '--no-index', file], { encoding: 'utf8' }).trim(), file);
  assert.equal(execFileSync('git', ['ls-files', '--', file], { encoding: 'utf8' }), '');

  // A real isolated Git index models an owner retaining prior reports. New output
  // must stay ignored and preserve the old tracked bytes even for the same name.
  const git = (...args) => execFileSync('git', args, { cwd: directory, encoding: 'utf8' }).trim();
  git('init', '--quiet');
  await writeFile(resolve(directory, '.gitignore'), await readFile('.gitignore'));
  await mkdir(resolve(directory, 'retained-reports'));
  const historical = resolve(directory, 'retained-reports/check-results.json');
  const retained = JSON.stringify({ passed: true, generation: 'previous' }) + '\n';
  await writeFile(historical, retained);
  git('add', '.gitignore', 'retained-reports/check-results.json');
  assert.ok(git('ls-files', 'retained-reports').includes('check-results.json'));
  await mkdir(resolve(directory, verificationDirectory), { recursive: true });
  const fresh = resolve(directory, verificationDirectory, 'check-results.json');
  await writeFile(fresh, JSON.stringify({ passed: false, generation: 'current' }));
  assert.equal(git('check-ignore', '--no-index', fresh), fresh);
  assert.equal(git('ls-files', '--', fresh), '');
  assert.equal(await readFile(historical, 'utf8'), retained);
  assert.equal(git('diff', '--', 'retained-reports/check-results.json'), '');
});
