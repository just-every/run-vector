import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const run = (program, args, options = {}) => new Promise((resolve, reject) => {
  const child = spawn(program, args, { stdio: 'inherit', ...options });
  child.on('error', reject); child.on('exit', code => resolve(code ?? 1));
});
const copies = JSON.parse(await readFile('base-copies.json', 'utf8'));
const pin = copies.copies.find(copy => copy.path === 'vendor/base/agent-door').revision;
const scratch = await mkdtemp(join(tmpdir(), 'vector-base-verifier-'));
try {
  if (await run('git', ['clone', '--filter=blob:none', '--no-checkout', '--single-branch', '--branch', 'cloud/gr-base-hooks-merge-1', '--depth', '1',
    'https://github.com/runeditrun/base.git', scratch])) throw new Error('Cannot acquire the declared Base verifier');
  if (await run('git', ['-C', scratch, 'fetch', '--depth', '1', 'origin', pin])) throw new Error('Cannot fetch the exact declared Base pin');
  if (await run('git', ['-C', scratch, 'checkout', '--detach', pin])) throw new Error('Cannot select the exact declared Base pin');
  console.log(`Normal conformance command: node ${scratch}/bin/rer.mjs verify`);
  const normal = await run(process.execPath, [join(scratch, 'bin/rer.mjs'), 'verify']);
  console.log(`Normal rer verify exit=${normal}; Base=${pin}.`);
  // A missing contract citation stops normal verification before the runtime.
  // Its failure stays intact; the separate real installation still runs.
  const build = await run(process.execPath, ['node_modules/@runeditrun/rer/bin/rer.mjs', 'build']);
  const runtime = build === 0 ? await run(process.execPath, ['tests/agent-door/runtime.mjs']) : build;
  const browser = build === 0 && process.argv.includes('--screens') ? await run(process.execPath, ['tests/agent-door/runtime.mjs', '--screens']) : 0;
  console.log(`Specialist installation journey exit=${runtime}; normal CLI exit=${normal}.`);
  process.exitCode = normal || runtime || browser;
} finally { await rm(scratch, { recursive: true, force: true }); }
