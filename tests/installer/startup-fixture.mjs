import { readFile, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const quote = value => "'" + value.replaceAll("'", "'\\''") + "'";

// A fixture in this disposable clone delays the first real production runtime.
// pnpm may replace its package directory, so the pnpm shim places the fixture
// after a successful install, before setup imports or starts that runtime.
export async function prepareStartupFixture({ root, work, timing, slow, pnpm, shim }) {
 const runtime = join(root, 'node_modules/@runeditrun/rer/onboarding/production-runtime.mjs');
 const fixture = join(work, 'production-runtime-fixture.mjs');
 const inject = join(work, 'place-startup-fixture.mjs');
 const mode = (await stat(runtime)).mode;
 await writeFile(fixture, `import {writeFileSync,existsSync} from 'node:fs';
const first=!existsSync(${JSON.stringify(timing)});
if(first)writeFileSync(${JSON.stringify(timing)},String(Date.now()),{flag:'wx'});
await new Promise(resolve=>setTimeout(resolve,first&&${slow}?130000:1000));
` + await readFile(runtime, 'utf8'), { flag: 'wx', mode });
 // Replace the directory entry; never write through a pnpm store hardlink.
 await writeFile(inject, `import {copyFile,rename} from 'node:fs/promises';
const target=${JSON.stringify(runtime)};
await copyFile(${JSON.stringify(fixture)},target+'.native-proof');
await rename(target+'.native-proof',target);
`, { flag: 'wx' });
 await writeFile(shim, `#!/bin/sh
${quote(pnpm)} "$@"
status=$?
if [ "$status" -eq 0 ] && [ "$1" = "install" ]; then
 node ${quote(inject)}
 exit $?
fi
exit "$status"
`, { mode: 0o755 });
}
