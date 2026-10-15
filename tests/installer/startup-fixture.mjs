import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

// Delay the real local development entry in this disposable checkout. This
// follows the adapter start hook, independently of how rer provisions pnpm.
export async function prepareStartupFixture({ root, work, timing, slow }) {
 const fixture=join(work,'development-startup-fixture.mjs');
 await writeFile(fixture, `import {writeFileSync,existsSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
const first=!existsSync(${JSON.stringify(timing)});
if(first)writeFileSync(${JSON.stringify(timing)},String(Date.now()),{flag:'wx'});
await new Promise(resolve=>setTimeout(resolve,first&&${slow}?130000:1000));
const entry=process.argv[2];process.argv.splice(1,1);await import(pathToFileURL(entry).href);
`,{flag:'wx'});
 const adapter=join(root,'scripts/installer/local.mjs');
 const source=await readFile(adapter,'utf8');
 await writeFile(adapter,source.replace('start: developmentTarget,',`start: context => { const [command,args,options]=developmentTarget(context); return [command,[${JSON.stringify(fixture)},...args],options]; },`));
}
