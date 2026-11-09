import assert from 'node:assert/strict';
import {execFileSync,spawn} from 'node:child_process';
import {resolve} from 'node:path';
import {writeFile,mkdir} from 'node:fs/promises';
import {localAuthArguments,readDevelopmentLink,localAuthSecret} from '/workspace/run-vector/tests/e2e/outbox-session.mjs';
import {hashToken} from '/workspace/run-vector/vendor/base/operator-auth/crypto.mjs';
import {readLocalD1} from '/workspace/run-vector/tests/e2e/local-d1-read.mjs';
import {resetInvitationConfirmationBudget,invitationConfirmationLedger} from '/workspace/run-vector/tests/e2e/core-confirmation-budget.mjs';
const port=15973,base=`http://127.0.0.1:${port}`,state=process.argv[3]??('.wrangler/confirmation-probe-'+Date.now());
execFileSync('pnpm',['exec','wrangler','d1',...(process.argv[3]?['execute','vector-local','--command','DELETE FROM oa_limits']:['migrations','apply','vector-local']),'--local','--config','wrangler.jsonc','--persist-to',state],{stdio:'pipe',maxBuffer:16*1024*1024});
let workerLog='';
const worker=spawn(process.execPath,[resolve('tests/e2e/worker-serve.mjs'),'--config','dist/server/wrangler.json','--local','--ip','127.0.0.1','--port',String(port),'--persist-to',state,'--var','APP_ORIGIN:'+base,...localAuthArguments],{stdio:['ignore','pipe','pipe'],detached:true});
worker.stdout.on('data',b=>workerLog+=b);worker.stderr.on('data',b=>workerLog+=b);
const request=(path,data,cookie)=>fetch(base+path,{method:data?'POST':'GET',redirect:'manual',headers:{Origin:base,Connection:'close',...(data?{'Content-Type':'application/json'}:{}),...(cookie?{Cookie:cookie}:{})},...(data?{body:JSON.stringify(data)}:{})});
const key=await hashToken(localAuthSecret,'rate','confirmation:ip:loopback');
const count=()=>readLocalD1(state,`SELECT count FROM oa_limits WHERE key='${key}'`)[0]?.count??0;
const confirm=async email=>{const link=new URL(await readDevelopmentLink(base,null,email,state));const r=await request('/auth/confirm',{token:link.searchParams.get('token')});await r.arrayBuffer();return r;};
const rows=[];
try{
 let ready=false;
 for(let i=0;i<150;i++){try{if((await request('/health')).ok){ready=true;break}}catch{}await new Promise(r=>setTimeout(r,200));}
 assert.ok(ready,'probe Worker ready: '+workerLog);
 assert.equal((await request('/auth/request',{email:'sarah@vector.test'})).status,202);
 const owner=await confirm('sarah@vector.test');assert.equal(owner.status,303);
 const cookie=owner.headers.get('set-cookie').split(';')[0];
 assert.equal((await request('/api/session',null,cookie)).status,200);
 rows.push({count:count(),status:owner.status});
 for(let n=2;n<=31;n++){
  const email=`confirmation-probe-${n}@vector.test`;
  const invitation=await request('/api/settings/operators/invite',{email,displayName:`Confirmation probe ${n}`,role:'owner'},cookie);
  assert.equal(invitation.status,202,`invitation ${n}`);
  const r=await confirm(email);rows.push({count:count(),status:r.status});
  assert.equal(r.status,n<=30?303:429,`confirmation ${n}`);
 }
 resetInvitationConfirmationBudget(state);
 // The 31st token was not consumed by the rejected attempt. A fresh journey
 // budget admits its first POST without changing the native cap or the token.
 const after=await confirm('confirmation-probe-31@vector.test');assert.equal(after.status,303);
 const result={head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),before:rows,after:{count:count(),status:after.status},scope:'Native emitted Worker, local-outbox loopback confirmation IP; explicit reset performed only by the test D1 seam.'};
 await writeFile(process.argv[2],JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify(result));
}finally{
 process.kill(-worker.pid,'SIGTERM');
 await new Promise(r=>worker.once('exit',r));
}
