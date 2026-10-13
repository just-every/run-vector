import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile,stat} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {prepareSettings} from '../../scripts/base-onboarding/adapter-settings.mjs';
import {settings} from '../../scripts/installer/definition.mjs';
import {recordDevelopmentOrigin,developmentOrigin} from '../../scripts/development-origin.mjs';
test('development test reads the saved nonstandard origin through private kit custody without touching watched settings',async t=>{
 const root=await mkdtemp(join(tmpdir(),'vector-origin-'));t.after(()=>rm(root,{recursive:true,force:true}));
 const context={root,manifest:JSON.parse(await readFile('rer-setup.json','utf8')),input:{FIRST_OWNER_EMAIL:'owner@example.test',FIRST_OWNER_NAME:'Owner',WORKSPACE_NAME:'Work',WORKSPACE_TIMEZONE:'UTC',DEFAULT_TEAM_NAME:'Team',DEFAULT_TEAM_PREFIX:'VEC'},store:{step:async()=>{},addSecrets:()=>{}}};
 await prepareSettings(context,{secrets:settings,origin:()=> 'http://127.0.0.1:49123'});
 await recordDevelopmentOrigin(root,context.vars.APP_ORIGIN);
 const before=await stat(join(root,'.dev.vars'));
 assert.equal(await developmentOrigin(root),'http://127.0.0.1:49123');
 const after=await stat(join(root,'.dev.vars'));
 assert.equal(after.ctimeMs,before.ctimeMs);assert.equal(after.mtimeMs,before.mtimeMs);assert.equal(after.mode&0o777,0o600);
 assert.equal((await stat(join(root,'.seed/development.json'))).mode&0o777,0o600);
 assert.deepEqual(JSON.parse(await readFile(join(root,'.seed/development.json'),'utf8')),{APP_ORIGIN:context.vars.APP_ORIGIN});
});


test('missing installation refuses development without creating configuration',async t=>{
 const root=await mkdtemp(join(tmpdir(),'vector-origin-missing-'));t.after(()=>rm(root,{recursive:true,force:true}));
 await assert.rejects(stat(join(root,'.dev.vars')),{code:'ENOENT'});
 await assert.rejects(stat(join(root,'.seed/development.json')),{code:'ENOENT'});
 await assert.rejects(developmentOrigin(root),error=>{assert.equal(error.message.includes('private-origin-canary'),false);return true;});
 await assert.rejects(stat(join(root,'.dev.vars')),{code:'ENOENT'});
 await assert.rejects(stat(join(root,'.seed/development.json')),{code:'ENOENT'});
});
test('invalid saved origins give canned recovery guidance without reflecting receipt values',async t=>{
 for(const [name,origin] of [
  ['missing',undefined],['null',null],['number',42],['empty',''],
  ['malformed','private-origin-canary'],['remote','http://private-origin-canary.example:49123'],
  ['https','https://127.0.0.1:49123'],['default port','http://127.0.0.1'],
  ['path','http://127.0.0.1:49123/private-origin-canary'],
  ['credentials','http://owner:private-origin-canary@127.0.0.1:49123'],
 ])await t.test(name,async t=>{
  const root=await mkdtemp(join(tmpdir(),'vector-origin-invalid-'));t.after(()=>rm(root,{recursive:true,force:true}));
  await recordDevelopmentOrigin(root,origin);
  await assert.rejects(developmentOrigin(root),error=>{assert.equal(error.message.includes('private-origin-canary'),false);return true;});
 });
});
test('valid saved origin leaves settings inode, private mode and exact bytes intact',async t=>{
 const root=await mkdtemp(join(tmpdir(),'vector-origin-custody-'));t.after(()=>rm(root,{recursive:true,force:true}));
 const context={root,manifest:JSON.parse(await readFile('rer-setup.json','utf8')),input:{FIRST_OWNER_EMAIL:'owner@example.test',FIRST_OWNER_NAME:'Owner',WORKSPACE_NAME:'Work',WORKSPACE_TIMEZONE:'UTC',DEFAULT_TEAM_NAME:'Team',DEFAULT_TEAM_PREFIX:'VEC'},store:{step:async()=>{},addSecrets:()=>{}}};
 await prepareSettings(context,{secrets:settings,origin:()=> 'http://127.0.0.1:49123'});
 await recordDevelopmentOrigin(root,context.vars.APP_ORIGIN);
 const path=join(root,'.dev.vars'),before=await stat(path),bytes=await readFile(path);
 assert.equal(await developmentOrigin(root),'http://127.0.0.1:49123');
 const after=await stat(path);
 assert.equal(after.ino,before.ino);assert.equal(after.mode,before.mode);assert.equal(after.mode&0o777,0o600);
 assert.equal(after.ctimeMs,before.ctimeMs);assert.equal(after.mtimeMs,before.mtimeMs);
 assert.deepEqual(await readFile(path),bytes);
});
