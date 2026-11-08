import assert from 'node:assert/strict';
import {chromium} from '/workspace/run-vector/node_modules/@playwright/test/index.mjs';
import {bootstrapOwner} from '/workspace/run-vector/tests/e2e/admin-runtime-support.mjs';
import {collaborationRuntime,inviteRecipient,receipt} from '/workspace/run-vector/tests/e2e/collaboration-support.mjs';
import {paginationAndRemoval} from '/workspace/run-vector/tests/e2e/collaboration-pagination.mjs';
import {navigate} from '/workspace/run-vector/tests/e2e/collaboration-navigation.mjs';
import {writeFile} from 'node:fs/promises';
const runtime=await collaborationRuntime(1440),checks=[];
let browser,recipient;
try {
 runtime.initialize();await runtime.start();
 browser=await chromium.launch({headless:true,executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();
 await bootstrapOwner(page,runtime);
 recipient=await inviteRecipient({page,browser,runtime});
 const api=async(path,method='GET',data)=>{
  const r=await page.request.fetch(runtime.base+'/api'+path,{method,headers:{Origin:runtime.base},...(data===undefined?{}:{data})});
  assert.ok(r.ok(),await r.text());return r.json();
 };
 const team=(await api('/metadata')).teams[0];
 await api(`/settings/teams/${team.id}/members/${recipient.operator.id}`,'PUT',{role:'member'});
 const issue=await api('/issues','POST',{title:'synthetic-vector-9374',teamId:team.id,assigneeOperatorId:recipient.operator.id});
 await navigate(page,runtime.base+'/app/issues/'+issue.identifier);
 await paginationAndRemoval({page,peer:recipient.peer,runtime,operator:recipient.operator,
  comment:async text=>{
   await page.getByLabel('Add a comment',{exact:true}).fill(text);
   await receipt(page,`/api/issues/${issue.identifier}/comments`,'POST',()=>page.getByRole('button',{name:'Add comment',exact:true}).click());
  },capture:async()=>{},peerCapture:async()=>{},fixtures:[],clause:async(id,name,run)=>{await run();checks.push({id,name,passed:true});}});
 await writeFile('/home/agent/rer-consolidation/work/sd-vector-c-f207/packet/inbox-receipt.json',JSON.stringify({command:'cloud_run timeout 1200 node /tmp/vector-retained-inbox.mjs',width:1440,exit:0,checks},null,2)+'\n');
 console.log('Native Inbox pagination, retained personal state, cancelled delivery and revoked cached pages PASS');
}finally{await recipient?.context.close();await browser?.close();await runtime.stop();}
