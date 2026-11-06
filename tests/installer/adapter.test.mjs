import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, cp, mkdir, readFile, rm, writeFile, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { parseContract } from '../../src/base/seed-contract.mjs';

test('contract authoring generates an ordinary additive clause through write and check', async () => {
 const root=await mkdtemp(join(tmpdir(),'vector-contract-'));
 try {
  const files=['CONTRACT.md','ACCEPTANCE.md','docs/CLAIMS.md'];
  const originals=await Promise.all(files.map(file=>readFile(file,'utf8')));
  const baseline=parseContract(originals[0]);
  const id=Array.from({length:999},(_,i)=>'SYNTHETIC-VECTOR-'+String(i+1).padStart(3,'0')).find(id=>!baseline.clauses.some(c=>c.id===id));
  assert.ok(id);
  for(const file of [...files,'scripts/contract-docs.mjs','src/base/seed-contract.mjs']) {
   await mkdir(join(root,file,'..'),{recursive:true});
   await cp(resolve(file),join(root,file));
  }
  const title='Synthetic ordinary authoring',requirement='Retain the source requirement.',acceptance='Generate the source acceptance through the public command.',gap='Synthetic capability remains unimplemented.';
  const definition='- **'+id+' — '+title+'.** '+requirement+' *Acceptance:* '+acceptance+' *Status:* missing — '+gap;
  const row='| '+id+' | '+title+' | published | missing | | '+gap+' |';
  const lines=originals[0].split('\n');
  lines.splice(baseline.clauses.at(-1).row,0,row);
  const source=lines.join('\n').replace('## Issues\n','## Issues\n\n'+definition+'\n');
  assert.ok(source.includes(definition));
  await writeFile(join(root,files[0]),source);
  const snapshot=()=>Promise.all(files.map(file=>readFile(join(root,file),'utf8')));
  const invoke=(...args)=>spawnSync(process.execPath,['scripts/contract-docs.mjs',...args],{cwd:root,encoding:'utf8'});
  const succeeds=(...args)=>{const result=invoke(...args);assert.equal(result.status,0,result.stderr||result.stdout);};
  const stale=await snapshot();
  assert.notEqual(invoke('check',id).status,0);
  assert.deepEqual(await snapshot(),stale);
  succeeds('write',id);
  succeeds('check',id);
  const generated=await snapshot(),parsed=parseContract(generated[0]);
  const data=clauses=>clauses.map(({line,row,...clause})=>clause);
  assert.deepEqual(data(parsed.clauses.filter(c=>c.id!==id)),data(baseline.clauses));
  for(const clause of baseline.clauses)assert.ok(generated[0].split('\n').includes(originals[0].split('\n')[clause.row-1]));
  assert.deepEqual(parsed.counts,{...baseline.counts,missing:baseline.counts.missing+1,total:baseline.counts.total+1});
  const ordinary=parsed.clauses.find(c=>c.id===id);
  assert.equal(ordinary.kind,'published');assert.equal(ordinary.status,'missing');assert.equal(ordinary.gap,gap);
  const entry=generated[1].split('\n').find(line=>line.includes('<!-- contract-docs:'+id+' -->'));
  for(const text of [id,title,'(missing)',requirement,'Acceptance: '+acceptance,'Gap: '+gap])assert.ok(entry?.includes(text),text);
  const claim=generated[2].split('\n').find(line=>line.startsWith('| '+id+' |'));
  for(const text of ['| missing |',requirement,'Gap: '+gap])assert.ok(claim?.includes(text),text);
  // Counts may change; every existing legacy narrative and complete claim stays.
  for(const i of [1,2])for(const line of originals[i].split('\n').filter(line=>line&&!/^\| (Published|Target and push further|All) \|/.test(line)))assert.ok(generated[i].split('\n').includes(line),line);
  const summary=text=>text.slice(text.indexOf('| Clauses |'),text.indexOf('\n\n',text.indexOf('| Clauses |')));
  assert.equal(summary(generated[1]),summary(generated[0]));
  succeeds('write',id);succeeds('check',id);
  assert.deepEqual(await snapshot(),generated);
  succeeds('check');
  const revised=generated[0].replace(acceptance,acceptance+' Keep the revision.');
  await writeFile(join(root,files[0]),revised);
  assert.notEqual(invoke('check').status,0);
  succeeds('write');succeeds('check');
  assert.ok((await readFile(join(root,files[1]),'utf8')).includes(acceptance+' Keep the revision.'));
  const repeated=await snapshot();succeeds('write');succeeds('check');
  assert.deepEqual(await snapshot(),repeated);
  for(const command of ['write','check']) {
   const result=invoke(command,id+'-UNKNOWN');assert.notEqual(result.status,0);assert.match(result.stderr,/No contract clause/);
   assert.deepEqual(await snapshot(),repeated);
  }
  await writeFile(join(root,files[0]),repeated[0].replace(row+'\n',''));
  const invalid=await snapshot();
  for(const command of ['write','check']) {
   const result=invoke(command,id);assert.notEqual(result.status,0);assert.match(result.stderr,/has no Status row/);
   assert.deepEqual(await snapshot(),invalid);
  }
 } finally {await rm(root,{recursive:true,force:true});}
});

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
