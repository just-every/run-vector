import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, cp, mkdir, readFile, rm, writeFile, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
test('public command inspection works in an unconfigured clone and refuses effects on invalid invocation', () => {
 for (const args of [['check','--profile','first-party','--json'],['describe','--json'],['setup','--help']]) {
  const result=spawnSync(process.execPath,['node_modules/@runeditrun/rer/bin/rer.mjs',...args],{encoding:'utf8',env:{...process.env,CI:'true'}});
  assert.equal(result.status,0,result.stderr||result.stdout);
 }
 for (const args of [['setup','--host','0.0.0.0'],['reset','--non-interactive'],['import','--input','missing.jsonl','--non-interactive']]) {
  const result=spawnSync(process.execPath,['node_modules/@runeditrun/rer/bin/rer.mjs',...args],{encoding:'utf8',env:{...process.env,CI:'true'}});
  assert.notEqual(result.status,0);
 }
});
test('legacy local data refuses setup and automatic development before private settings are written', async () => {
 const root=await mkdtemp(join(tmpdir(),'vector-upgrade-'));
 try {
  const cloned=spawnSync('git',['clone','--quiet','--shared',process.cwd(),root],{encoding:'utf8'});
  assert.equal(cloned.status,0,cloned.stderr);
  for(const file of ['state.mjs','local.mjs'])await cp(resolve('scripts/installer',file),join(root,'scripts/installer',file));
  const retained=join(root,'.wrangler/vector-dev/retained');
  await mkdir(join(root,'.wrangler/vector-dev'),{recursive:true});
  await writeFile(retained,'retained installation bytes');
  for(const args of [['setup','--owner-email','sarah@vector.test','--non-interactive'],['dev']]) {
   const result=spawnSync(process.execPath,[resolve('node_modules/@runeditrun/rer/global/rer.mjs'),...args],{cwd:root,encoding:'utf8',timeout:60000,env:{...process.env,CI:'true'}});
   assert.equal(result.status,4,result.stderr||result.stdout);
   assert.match(result.stderr+result.stdout,/docs\/LOCAL-RECOVERY\.md/);
   assert.doesNotMatch(result.stderr+result.stdout,/Inspect the private redacted capture log/);
   assert.equal(await readFile(retained,'utf8'),'retained installation bytes');
   await assert.rejects(access(join(root,'.dev.vars')),{code:'ENOENT'});
  }
 } finally {await rm(root,{recursive:true,force:true});}
});
