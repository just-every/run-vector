import {chromium} from '/workspace/run-vector/node_modules/@playwright/test/index.mjs';
import {createAdminRuntime,bootstrapOwner} from '/workspace/run-vector/tests/e2e/admin-runtime-support.mjs';
import {memberSuspensionJourney} from '/workspace/run-vector/tests/e2e/member-suspension-journey.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
const evidence='/workspace/run-vector/.artifacts/verification/member-suspension-browser';
await mkdir(evidence,{recursive:true});
const runtime=createAdminRuntime(1440,[],{port:15966,inspectorPort:15967});
let browser;
try {
 runtime.initialize();await runtime.start();
 browser=await chromium.launch({headless:true,executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();
 await bootstrapOwner(page,runtime);
 const checks=[];
 await memberSuspensionJourney({page,browser,runtime,evidence,clause:async(id,name,run)=>{await run();checks.push({id,name,passed:true});}});
 await writeFile(evidence+'/receipt.json',JSON.stringify({checks,widths:[1440,390],scope:'Native HTTP lifecycle and rendered retained attribution; assignment dialog and directory interface remain unqualified.'},null,2)+'\n');
 console.log('Member suspension browser PASS at 1440 and 390');
}finally{await browser?.close();await runtime.stop();}
