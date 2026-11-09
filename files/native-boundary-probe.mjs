import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { readdir,writeFile } from 'node:fs/promises';
import {createProbe} from '/tmp/confirmation-probe.mjs';
const root=process.cwd(), req=createRequire(resolve(root,'package.json'));
const {request}=req('@playwright/test');
const {freePort}=await import(pathToFileURL(req.resolve('@runeditrun/rer/adapter-settings')));
const {localAuthArguments,localAuthSecret,readDevelopmentLink}=await import(pathToFileURL(resolve('tests/e2e/outbox-session.mjs')));
const {readLocalD1}=await import(pathToFileURL(resolve('tests/e2e/local-d1-read.mjs')));
const runs=await readdir('.wrangler/vector-e2e/runs');runs.sort();
const state='.wrangler/vector-e2e/runs/'+runs.at(-1),port=await freePort(),base='http://127.0.0.1:'+port;
const probe=createProbe(state,localAuthSecret,base,'isolated-boundary');
const worker=spawn(process.execPath,[resolve('tests/e2e/worker-serve.mjs'),'--config','dist/server/wrangler.json','--local','--test-scheduled','--ip','127.0.0.1','--port',String(port),'--inspector-port','0','--persist-to',state,'--var','APP_ORIGIN:'+base,...localAuthArguments],{stdio:['ignore','pipe','pipe'],detached:true});
// Worker output can contain local synthetic bindings. Keep it private.
worker.stdout.resume();worker.stderr.resume();
const results={revision:process.env.CONFIRM_PROBE_REVISION,mode:'native public-door boundary probe after the full journey stopped earlier',requests:[],passed:false};
let client;
try{
 for(let i=0;i<150;i++){
  if(worker.exitCode!==null)throw Error('owned probe Worker exited');
  try{if((await fetch(base+'/health')).ok)break;}catch{}
  if(i===149)throw Error('owned probe Worker not ready');
  await new Promise(r=>setTimeout(r,200));
 }
 client=await request.newContext({extraHTTPHeaders:{Connection:'close'}});
 async function confirm(link,kind){
  const token=new URL(link).searchParams.get('token');
  const response=await client.post(base+'/auth/confirm',{headers:{Origin:base},data:{token},maxRedirects:0});
  probe.response(base+'/auth/confirm','POST',{token},response.status());
  results.requests.push({kind,status:response.status()});
  return response;
 }
 const email='sarah@vector.test';
 const sent=await client.post(base+'/auth/request',{headers:{Origin:base},data:{email,returnTo:'/app'},maxRedirects:0});
 assert.equal(sent.status(),202,'one native owner sign-in request');
 const owner=await confirm(await readDevelopmentLink(base,client,email,state),'owner magic');
 assert.equal(owner.status(),303,'owner signs in once for the independent probe');
 let rejected=false;
 for(let i=0;i<31;i++){
  const email=`boundary-${Date.now()}-${i}@vector.test`;
  const invited=await client.post(base+'/api/settings/operators/invite',{headers:{Origin:base},data:{email,displayName:`synthetic-boundary-${i}`,role:'owner',teamIds:[]}});
  assert.equal(invited.status(),202,'each independent invitation is admitted without retry');
  const response=await confirm(await readDevelopmentLink(base,client,email,state),'invitation');
  if(response.status()===429){
   assert.equal((await response.json()).error,'rate_limited');
   rejected=true;break;
  }
  assert.equal(response.status(),303,'each confirmation before the native boundary succeeds');
 }
 assert.equal(rejected,true,'unchanged native confirmation limiter refuses the boundary attempt');
 results.operatorBucketPeak=Math.max(0,...readLocalD1(state,"SELECT count FROM access_rate_limits WHERE key LIKE 'operator:%'").map(r=>r.count));
 results.passed=true;
 console.info('PROBE native confirmation boundary: passed; one-pass public invitations reached 429; operator peak '+results.operatorBucketPeak);
}finally{
 await client?.dispose();
 if(worker.exitCode===null){process.kill(-worker.pid,'SIGTERM');await new Promise(r=>worker.once('exit',r));}
 await writeFile(process.env.BOUNDARY_RECEIPT_FILE,JSON.stringify(results,null,2)+'\n');
}
