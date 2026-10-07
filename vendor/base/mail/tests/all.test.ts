// Root verify:modules deliberately discovers this file with modules/*/tests/*.test.ts.
// Run every nested suite, including workerd, without competing for legacy shared
// runtime storage. Discovery is recursive so a new unit cannot silently miss CI.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
const exec = promisify(execFile);
async function discover(directory: URL): Promise<string[]> {
  const found: string[] = [];
  for (const item of await readdir(directory, { withFileTypes: true })) {
    const url = new URL(item.name + (item.isDirectory() ? '/' : ''), directory);
    if (item.isDirectory() && !item.name.startsWith('.')) found.push(...await discover(url));
    else if (item.name.endsWith('.test.mjs')) found.push(fileURLToPath(url));
  }
  return found.sort();
}
test('mail: every nested unit, regression and workerd assembly suite', { timeout: 180000 }, async t => {
  const files = await discover(new URL('./', import.meta.url));
  assert.ok(files.length > 0, 'mail suites must be present');
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT; // The child is a new runner, not this runner's test worker.
  try {
    const result = await exec(process.execPath, ['--test', '--test-concurrency=1', '--test-reporter=spec', ...files], { env, maxBuffer: 8 * 1024 * 1024 });
    assert.match(result.stdout, /tests \d+/, 'child runner must report executed tests');
    t.diagnostic(`${files.length} nested mail suites executed.\n${result.stdout}`);
  } catch (error) {
    const failure = error as Error & { stdout?: string; stderr?: string };
    t.diagnostic(failure.stdout ?? ''); t.diagnostic(failure.stderr ?? ''); throw error;
  }
});
