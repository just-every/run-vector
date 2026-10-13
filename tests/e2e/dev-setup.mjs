import { loadInstallerSeed } from '../../scripts/base-onboarding/setup-manifest.mjs';
import {writePrivateFile} from '../../scripts/base-onboarding/private-files.mjs';
import {join} from 'node:path';
import {createState} from '../../scripts/base-onboarding/state.mjs';
import {createSeed} from '../../scripts/installer/seed.mjs';
import {freePort} from '../../scripts/base-onboarding/adapter-settings.mjs';
import {commandEnvironment} from '../../scripts/installer-env.mjs';
process.env.RER_SERVER_JOURNEY = '1';
const root=process.cwd(),store=await createState(root,await loadInstallerSeed(process.cwd(),createSeed())),controller=new AbortController();store.setCommandSignal(controller.signal);
const abort=()=>controller.abort();process.once('SIGINT',abort);process.once('SIGTERM',abort);
try {
 await store.run('Hydration fixture schema','pnpm',['exec','wrangler','d1','migrations','apply','vector-local','--local','--config','wrangler.jsonc','--persist-to','.wrangler/state'],{cwd:root,env:commandEnvironment()});
 const port=await freePort(),origin='http://127.0.0.1:'+port;
 const child=store.spawn('Hydration sample fixture','pnpm',['exec','wrangler','dev','--config','dist/server/wrangler.json','--local','--ip','127.0.0.1','--port',String(port),'--inspector-port','0','--persist-to','.wrangler/state','--var','APP_ORIGIN:'+origin,'--var','SEED_SAMPLE_DATA:true'],{cwd:root,env:commandEnvironment()});
 await store.waitForReady('Hydration fixture health',child,async signal=>{try{return {ready:(await fetch(origin+'/health',{signal})).ok}}catch{return {ready:false}}},{signal:controller.signal});
 await store.stop(child);
 // Real test-only sample rows preserve the existing hydration journey assertions.
 // The shared setup still runs with explicit answers and preserves existing data.
 await writePrivateFile(join(root,'.seed','dev-answers.json'),JSON.stringify({FIRST_OWNER_EMAIL:'sarah@vector.test',FIRST_OWNER_NAME:'Sarah',WORKSPACE_NAME:'Vector',WORKSPACE_TIMEZONE:'UTC',DEFAULT_TEAM_NAME:'Flow',DEFAULT_TEAM_PREFIX:'FLW'}));
 await store.run('Actual shared local setup',process.execPath,['scripts/rer.mjs','setup','--answers','.seed/dev-answers.json','--port',String(await freePort()),'--non-interactive'],{cwd:root,env:commandEnvironment({RER_SERVER_JOURNEY:'1'})});
 console.log('Development fixture and real shared setup completed.');
} finally {controller.abort();await store.closeCommands();process.removeListener('SIGINT',abort);process.removeListener('SIGTERM',abort);}
