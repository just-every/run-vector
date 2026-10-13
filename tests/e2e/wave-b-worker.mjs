import {spawn,execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import {mkdir,writeFile,rm} from 'node:fs/promises';
import {readOwnedGroup} from '@runeditrun/rer/internal/onboarding/local/process-table.mjs';

export async function waveBWorker(origin,config,evidence) {
  const state=resolve('.wrangler','wave-b-'+process.pid),file=resolve(state,'wrangler.json');
  await mkdir(state,{recursive:true});
  const base=JSON.parse(execFileSync(process.execPath,['-e',"process.stdout.write(require('fs').readFileSync('dist/server/wrangler.json','utf8'))"],{encoding:'utf8'}));
  // Synthetic credentials stay in this private fixture file, never process argv.
  await writeFile(file,JSON.stringify({...base,main:resolve('dist/server',base.main),assets:{...base.assets,directory:resolve('dist/client')},d1_databases:base.d1_databases.map(db=>({...db,migrations_dir:resolve('migrations/core')})),vars:{...base.vars,...config,APP_ORIGIN:origin}}),{mode:0o600});
  const wrangler=resolve('node_modules/wrangler/bin/wrangler.js'),environment={...process.env,WRANGLER_SEND_METRICS:'false',WRANGLER_LOG_PATH:resolve(evidence,'private-wrangler-logs')};
  execFileSync(process.execPath,[wrangler,'d1','migrations','apply','vector-local','--local','--config',file,'--persist-to',state],{env:environment,stdio:'ignore'});
  const worker=spawn(process.execPath,[wrangler,'dev','--config',file,'--local','--ip','127.0.0.1','--port',new URL(origin).port,'--inspector-port','0','--persist-to',state],{env:environment,detached:true,stdio:'ignore'});
  const closed=new Promise(resolve=>worker.once('close',resolve));
  async function drain() {
    for(let attempt=0;attempt<100;attempt++) {
      if(!(await readOwnedGroup(worker.pid)).length)return true;
      await new Promise(resolve=>setTimeout(resolve,50));
    }
    return !(await readOwnedGroup(worker.pid)).length;
  }
  async function stop() {
    const signal=kind=>{try{process.kill(-worker.pid,kind);}catch(error){if(error.code!=='ESRCH')throw error;}};
    signal('SIGTERM');
    if(!await drain())signal('SIGKILL');
    if(!await drain())throw Error('Owned Wave B process group remains');
    await closed;
    await rm(state,{recursive:true,force:true});
  }
  try {
    for(let attempt=0;attempt<150;attempt++) {
      if(worker.exitCode!==null)throw Error('Wave B Worker exited');
      try{if((await fetch(origin+'/health')).ok)return {state,stop};}catch{}
      await new Promise(resolve=>setTimeout(resolve,200));
    }
    throw Error('Wave B readiness failed');
  } catch(error){await stop();throw error;}
}
