import {join,resolve} from 'node:path';
import {freePort} from '../../scripts/base-onboarding/adapter-settings.mjs';
/** Synthetic rows enter the real native Worker before ordinary setup records
 * the installation owner, as in the existing development fixture journey. */
export async function prepareSampleInstallation(root,store,environment,signal){
 await store.run('Archive fixture migrations','pnpm',['exec','wrangler','d1','migrations','apply','vector-local','--local','--config','wrangler.jsonc','--persist-to','.wrangler/state'],{cwd:root,env:environment});
 const port=await freePort(),origin='http://127.0.0.1:'+port;
 const child=store.spawn('Archive sample fixture',process.execPath,[resolve('node_modules/wrangler/bin/wrangler.js'),'dev','--config','dist/server/wrangler.json','--local','--ip','127.0.0.1','--port',String(port),'--inspector-port','0','--persist-to',join(root,'.wrangler/state'),'--var','APP_ORIGIN:'+origin,'--var','SEED_SAMPLE_DATA:true'],{cwd:root,env:environment});
 try {await store.waitForReady('Archive sample health',child,async readySignal=>{try{return {ready:(await fetch(origin+'/health',{signal:readySignal})).ok}}catch{return {ready:false}}},{signal});}
 finally {await store.stop(child);}
}
