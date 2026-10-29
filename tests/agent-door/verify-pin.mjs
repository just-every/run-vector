import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';

const run = (program, args) => new Promise((resolve, reject) => {
  const child = spawn(program, args, { stdio: 'inherit' });
  child.on('error', reject); child.on('exit', code => resolve(code ?? 1));
});
const cli = JSON.parse(await readFile('node_modules/@runeditrun/rer/package.json', 'utf8'));
console.log(`Normal conformance command: pnpm exec rer verify; installed CLI ${cli.version}.`);
const normal = await run('pnpm', ['exec', 'rer', 'verify']);
console.log(`Normal rer verify exit=${normal}.`);
// Preserve the normal failure while separately exercising the production build
// through the released runtime's unmodified exported assertions.
const runtime = await run(process.execPath, ['tests/agent-door/runtime.mjs']);
const browser = process.argv.includes('--screens') ? await run(process.execPath, ['tests/agent-door/runtime.mjs', '--screens']) : 0;
console.log(`Specialist installation journey exit=${runtime}; normal CLI exit=${normal}.`);
process.exitCode = normal || runtime || browser;
