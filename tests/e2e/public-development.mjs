import assert from 'node:assert/strict';
import {once} from 'node:events';
import {realpath} from 'node:fs/promises';
import {liveServers} from '@runeditrun/rer/internal/global/registry.mjs';
import {readOwnedGroup} from '@runeditrun/rer/internal/onboarding/local/process-table.mjs';
import {developmentGroups,assertDevelopmentGone} from './owned-dev-processes.mjs';
import {waitForPortRelease} from '../../scripts/installer/teardown.mjs';

// The public launcher backgrounds development when stdout is piped. Its
// successful command completion is readiness; the exited launcher is not the
// serving process. Keep the checkout available for its public stop command.
export function publicDevelopment(store,root,environment,origin) {
 let child,requested=false,groups=[];
 const launchers=[];
 return {
  async start(label,command='pnpm',args=['run','dev']) {
   assert(!requested,'Stop development before starting it again');
   requested=true;
   child=store.spawn(label,command,args,{cwd:root,env:environment});launchers.push(child);
   const [code,signal]=await once(child,'close');
   assert.equal(signal,null,`${label} completed without a signal`);
   assert.equal(code,0,`${label} completed successfully`);
   const response=await fetch(origin+'/health',{signal:AbortSignal.timeout(5000)});
   await response.body?.cancel();assert(response.ok,`${label} serves real health after readiness`);
   const checkout=await realpath(root);
   const record=(await liveServers(environment)).find(server=>server.checkout===checkout);
   assert(record,`${label} has its own registered serving process`);
   groups=await developmentGroups(record.owner.pid);
  },
  async stop(label) {
   if(!requested)return;
   await store.run(label,'pnpm',['run','dev','--','--stop'],{cwd:root,env:environment});
   if(child)await store.stop(child);
   await waitForPortRelease(origin);
   await assertDevelopmentGone(groups);
   for(const launcher of launchers)assert.equal((await readOwnedGroup(launcher.pid)).length,0,'public development launcher drained');
   requested=false;child=undefined;groups=[];
  },
 };
}
