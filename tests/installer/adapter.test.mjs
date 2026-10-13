import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { isolatedStore } from '../../scripts/installer-env.mjs';
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
test('child commands cannot inherit unrelated credentials', () => {
 const planted='test-only-unrelated-value';process.env.UNRELATED_PROVIDER_SECRET=planted;
 try {
  const calls=[];const store={run(...args){assert.equal(this,store);calls.push(args)},spawn(...args){assert.equal(this,store);calls.push(args)}};
  const safe=isolatedStore(store);
  safe.run('build','pnpm',['run','build:source'],{env:{...process.env,SESSION_SECRET:'test-only-session',CLOUDFLARE_API_TOKEN:'test-only-provider'}});
  safe.spawn('start','pnpm',['exec','vite'],{env:{...process.env,RER_DEV_ORIGIN:'http://127.0.0.1:48123',CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV:'true'}});
  assert(calls.every(call=>!Object.values(call[3].env).includes(planted)));
  assert.equal(calls[0][3].env.CLOUDFLARE_API_TOKEN,undefined);assert.equal(calls[0][3].env.SESSION_SECRET,undefined);
  assert.equal(calls[1][3].env.RER_DEV_ORIGIN,'http://127.0.0.1:48123');
 } finally {delete process.env.UNRELATED_PROVIDER_SECRET;}
});
