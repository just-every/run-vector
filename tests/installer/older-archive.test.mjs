import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtemp,rm,symlink,readFile,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {getPlatformProxy} from 'wrangler';
import {compareRetainedArchive} from './retained-archive.mjs';

test('[BASE-DATA-001 DATA-001] a backup from the listed version restores through rer import, with either migration ledger',async()=>{
 const source=process.cwd(),work=await mkdtemp(join(tmpdir(),'vector-retained-'));
 const fixture=resolve('tests/fixtures/archives/listed-version'),archive=join(work,'listed-version.rer');
 const run=(root,command,args)=>execFileSync(command,args,{cwd:root,encoding:'utf8',timeout:120000,maxBuffer:32*1024*1024,env:{...process.env,CI:'true'},stdio:'pipe'});
 try {
  // Keep the historical manifest readable in source; restore its original wire bytes.
  await writeFile(archive,Buffer.concat([Buffer.from(JSON.stringify(JSON.parse(await readFile(fixture+'.manifest.json','utf8')))+'\n'),await readFile(fixture+'.records.ndjson')]),{mode:0o600});
  for(const platform of [false,true]) {
   const root=join(work,platform?'platform':'native');
   run(source,'git',['clone','--quiet','--no-hardlinks',source,root]);
   await symlink(resolve('node_modules'),join(root,'node_modules'),'dir');
   run(root,'pnpm',['exec','wrangler','d1','migrations','apply','vector-local','--local','--persist-to','.wrangler/state','--config','wrangler.jsonc']);
   const options={configPath:join(root,'wrangler.jsonc'),persist:{path:join(root,'.wrangler/state/v3')},remoteBindings:false};
   if(platform) {
    const proxy=await getPlatformProxy(options);
    try {await proxy.env.DB.exec('CREATE TABLE rer_migrations (name TEXT PRIMARY KEY, sha256 TEXT NOT NULL, applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)');}
    finally {await proxy.dispose();}
   }
   run(root,process.execPath,[join(root,'node_modules/@runeditrun/rer/bin/rer.mjs'),'import','--input',archive,'--yes']);
   const proxy=await getPlatformProxy(options);
   try {
    await compareRetainedArchive(archive,proxy.env);
    if(platform)assert(await proxy.env.DB.prepare("SELECT name FROM sqlite_master WHERE name='rer_migrations'").first());
   } finally {await proxy.dispose();}
  }
 } finally {await rm(work,{recursive:true,force:true});}
});
