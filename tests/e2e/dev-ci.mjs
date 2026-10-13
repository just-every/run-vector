import { loadInstallerSeed } from '@runeditrun/rer/setup-manifest';
import {createState} from '@runeditrun/rer/state';
import {createSeed} from '../../scripts/installer/seed.mjs';
import {commandEnvironment} from '../../scripts/installer-env.mjs';
import {readSettings} from '@runeditrun/rer/adapter-settings';
import {settings} from '../../scripts/installer/definition.mjs';
import {publicDevelopment} from './public-development.mjs';
process.env.RER_SERVER_JOURNEY = '1';
const root=process.cwd(),store=await createState(root,await loadInstallerSeed(process.cwd(),createSeed())),controller=new AbortController();store.setCommandSignal(controller.signal);let development;
try {
 await store.run('Real setup','pnpm',['run','test:dev:setup'],{cwd:root,env:commandEnvironment()});
 const {values}=await readSettings(root,settings);store.addSecrets([values.SESSION_SECRET]);
 development=publicDevelopment(store,root,commandEnvironment({RER_SERVER_JOURNEY:'1'}),values.APP_ORIGIN);
 await development.start('Real development','pnpm',['dev']);
 await store.run('Existing hydration journey','pnpm',['test:dev'],{cwd:root,env:commandEnvironment()});
}finally{try{await development?.stop('Stop real development');}finally{controller.abort();await store.closeCommands();}}
