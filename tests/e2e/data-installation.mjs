import assert from 'node:assert/strict';
import {cp,readFile,symlink} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import {parseEnv} from 'node:util';
import {prepareSampleInstallation} from './data-sample-installation.mjs';
import {createState} from '../../scripts/base-onboarding/state.mjs';
import {loadInstallerSeed} from '../../scripts/base-onboarding/setup-manifest.mjs';
import {createSeed} from '../../scripts/installer/seed.mjs';
import {commandEnvironment} from '../../scripts/installer-env.mjs';
import {freePort} from '../../scripts/base-onboarding/adapter-settings.mjs';
import {confirmLink,readDevelopmentLink} from './outbox-session.mjs';
import {readCheckoutKey} from './dev-gate.mjs';
import {readLocalD1} from './local-d1-read.mjs';
import {writeLocalD1} from './local-d1-write.mjs';
export async function dataInstallation(work,name){
 const root=join(work,name),source=process.cwd();execFileSync('git',['clone','--quiet','--no-hardlinks',source,root],{stdio:'ignore'});
 await symlink(resolve('node_modules'),join(root,'node_modules'),'dir');
 // Sample-data bootstrap uses the built Worker before the public dev journey.
 await cp(resolve('dist'),join(root,'dist'),{recursive:true});
 const store=await createState(root,await loadInstallerSeed(root,createSeed())),controller=new AbortController();store.setCommandSignal(controller.signal);
 const environment=commandEnvironment({RER_SERVER_JOURNEY:'1',CI:'true',RER_LOCAL_OPERATION:undefined});let child,settings,origin,cron;
 const run=(label,args)=>store.run(label,'pnpm',['run',...args],{cwd:root,env:environment});
 const installDependencies=()=>store.run('Install cloned application dependencies','pnpm',['install','--frozen-lockfile'],{cwd:root,env:environment});
 const configure=async(sample=false)=>{
  if(sample)await prepareSampleInstallation(root,store,environment,controller.signal);
  const port=await freePort();await run('Configure fresh local installation',['setup','--','--owner-email','sarah@vector.test','--port',String(port),'--non-interactive']);
  const path=join(root,'.dev.vars'),bytes=await readFile(path,'utf8');
  settings=parseEnv(bytes);origin=settings.APP_ORIGIN;store.addSecrets([settings.SESSION_SECRET,settings.SETUP_TOKEN]);
 };
 const state=join(root,'.wrangler/state');
 // Finish the actual HTTP exchange before a dependent mutation. Keep normal
 // HTTP connection handling; an unread status-only response is not completion.
 const req=async(path,method='GET',body,cookie='',extra={})=>{
  const response=await fetch(origin+path,{method,redirect:'manual',headers:{Origin:origin,Cookie:cookie,'Content-Type':'application/json',...extra},...(body===undefined?{}:{body:JSON.stringify(body)})});
  const bytes=await response.arrayBuffer();
  return new Response([204,205,304].includes(response.status)?null:bytes,{status:response.status,statusText:response.statusText,headers:response.headers});
 };
 const start=async()=>{
  child=store.spawn('Native archive development',process.execPath,[join(root,'scripts/rer.mjs'),'dev'],{cwd:root,env:environment});
  cron={completed:0,failure:null};
  for(const stream of [child.stdout,child.stderr]){
   let pending='';
   stream.on('data',chunk=>{
    const lines=(pending+chunk).split('\n');pending=lines.pop();
    for(const line of lines){
     const result=line.match(/RER_SCHEDULED \S+ "[^"]+" (ok \d+ms|failed \([^\n]*\)|skipped \([^\n]*\))/);
     if(result?.[1].startsWith('ok '))cron.completed++;
     else if(result)cron.failure=result[1];
    }
   });
  }
  await store.waitForReady('Native installation health',child,async signal=>{try{return {ready:(await fetch(origin+'/health',{signal})).ok}}catch{return {ready:false}}},{signal:controller.signal});
 };
 const stop=async()=>{if(child){await store.stop(child);child=undefined;}};
 const scheduledRun=async()=>{
  // Observe a fresh completed run of Base's private, automatic dev scheduler.
  // The existing app keeps sole ownership of D1/R2; no public trigger is used.
  assert(child,'Development must be running to observe scheduled work');
  const seen=cron.completed;
  await store.waitForReady('Automatic restored installation Cron',child,()=>({ready:cron.completed>seen||cron.failure!==null}),{signal:controller.signal,timeoutMs:120000,softAfterMs:65000});
  assert.equal(cron.failure,null,'The automatic Worker scheduled handler succeeded');
 };
 const sql=query=>readLocalD1(state,query),fixture=script=>writeLocalD1(state,script);
 const signIn=async(email='sarah@vector.test')=>{
  assert.equal((await req('/auth/request','POST',{email})).status,202);
  const link=await readDevelopmentLink(origin,req,email,await readCheckoutKey(root));store.addSecrets([new URL(link).searchParams.get('token')]);
  const response=await confirmLink(link);assert.equal(response.status,303);const cookie=response.headers.get('set-cookie').split(';')[0];
  const review=await req('/api/setup','GET',undefined,cookie);assert.equal(review.status,200);const setup=await review.json();
  if(setup.owner&&!setup.completed)assert.equal((await req('/api/setup/complete','POST',{confirmed:true},cookie)).status,200);
  return cookie;
 };
 return {root,state,run,installDependencies,configure,start,stop,scheduledRun,req,sql,fixture,signIn,get origin(){return origin;},async close(){controller.abort();await stop();await store.closeCommands();}};
}
