import { loadInstallerSeed } from '@runeditrun/rer/setup-manifest';
import {createState} from '@runeditrun/rer/state';
import {createSeed} from '../../scripts/installer/seed.mjs';
import {commandEnvironment} from '../../scripts/installer-env.mjs';
import {readSettings} from '@runeditrun/rer/adapter-settings';
import {settings} from '../../scripts/installer/definition.mjs';
import {readOwnedGroup} from '@runeditrun/rer/internal/onboarding/local/process-table.mjs';
import assert from 'node:assert/strict';
import {developmentGroups,assertDevelopmentGone} from './owned-dev-processes.mjs';
import {waitForPortRelease} from '../../scripts/installer/teardown.mjs';
process.env.RER_SERVER_JOURNEY = '1';
const root=process.cwd(),store=await createState(root,await loadInstallerSeed(process.cwd(),createSeed())),controller=new AbortController();store.setCommandSignal(controller.signal);let child,origin,groups=[];
try {
 await store.run('Real setup','pnpm',['run','test:dev:setup'],{cwd:root,env:commandEnvironment()});
 const {values}=await readSettings(root,settings);store.addSecrets([values.SESSION_SECRET]);origin=values.APP_ORIGIN;
 child=store.spawn('Real development','pnpm',['dev'],{cwd:root,env:commandEnvironment({RER_SERVER_JOURNEY:'1'})});
 await store.waitForReady('Development health',child,async signal=>{try{return {ready:(await fetch(values.APP_ORIGIN+'/health',{signal})).ok}}catch{return {ready:false}}},{signal:controller.signal});
 groups=await developmentGroups(child.pid);
 await store.run('Existing hydration journey','pnpm',['test:dev'],{cwd:root,env:commandEnvironment()});
}finally{controller.abort();await store.closeCommands();if(child)assert.equal((await readOwnedGroup(child.pid)).length,0);if(origin)await waitForPortRelease(origin);await assertDevelopmentGone(groups);}
