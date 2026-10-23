import assert from 'node:assert/strict';
import {realpath} from 'node:fs/promises';
import {liveServers} from '@runeditrun/rer/internal/global/registry.mjs';
import {readOwnedGroup} from '@runeditrun/rer/internal/onboarding/local/process-table.mjs';
import {developmentGroups,assertDevelopmentGone} from './owned-dev-processes.mjs';
import {waitForPortRelease} from '../../scripts/installer/teardown.mjs';
import {readCheckoutKey} from './dev-gate.mjs';

// Keep this public launch in the foreground so its owned child PID is also
// the stop door. Health and the registry still prove the serving runtime.
export function publicDevelopment(store,root,environment,origin) {
 let child,requested=false,groups=[];
 const launchers=[];
 return {
  async start(label,command='pnpm',args=['run','dev']) {
   assert(!requested,'Stop development before starting it again');
   requested=true;
   store.addSecrets([await readCheckoutKey(root)]);
   child=store.spawn(label,command,[...args,'--foreground'],{cwd:root,env:environment});launchers.push(child);
   await store.waitForReady(label,child,async signal=>{
    try {const response=await fetch(origin+'/health',{signal});await response.body?.cancel();return {ready:response.ok};}
    catch {return {ready:false};}
   });
   assert.equal(child.exitCode,null,`${label} remains owned and serving`);
   assert.equal(child.signalCode,null,`${label} has not received a signal`);
   const response=await fetch(origin+'/health',{signal:AbortSignal.timeout(5000)});
   await response.body?.cancel();assert(response.ok,`${label} serves real health after readiness`);
   const checkout=await realpath(root);
   const record=(await liveServers(environment)).find(server=>server.checkout===checkout);
   assert(record,`${label} has its own registered serving process`);
   groups=await developmentGroups(record.owner.pid);
  },
  async stop(label) {
   if(!requested)return;
   if(child)await store.stop(child);
   await waitForPortRelease(origin);
   await assertDevelopmentGone(groups);
   for(const launcher of launchers)assert.equal((await readOwnedGroup(launcher.pid)).length,0,'public development launcher drained');
   requested=false;child=undefined;groups=[];
  },
 };
}
