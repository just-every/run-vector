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
