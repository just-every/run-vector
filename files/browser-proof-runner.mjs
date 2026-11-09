import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from '/workspace/run-vector/node_modules/@playwright/test/index.mjs';
import {createAdminRuntime,bootstrapOwner} from '/workspace/run-vector/tests/e2e/admin-runtime-support.mjs';
import {memberSuspensionJourney} from '/workspace/run-vector/tests/e2e/member-suspension-journey.mjs';
const evidence=process.env.HOME+'/rer-consolidation/work/sd-vector-c-f207-fix3/packet/browser';
await mkdir(evidence,{recursive:true});
const runtime=createAdminRuntime(1440,[],{port:15974,inspectorPort:15975});
let browser,context;
const checks=[],head='db865aaeaf9a5e327f8128664325d30d408310ed';
const clause=async(id,name,run)=>{await run();checks.push({id,name,passed:true});};
let failure;
try {
 runtime.initialize();await runtime.start();
 browser=await chromium.launch({headless:true,executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 context=await browser.newContext({viewport:{width:1440,height:1000}});
 const page=await context.newPage();
 await bootstrapOwner(page,runtime);
 await memberSuspensionJourney({page,browser,runtime,clause,evidence});
 console.log('PASS: candidate native suspension/reactivation, retained rendered attribution, fresh sign-in, private view and history; 1440/390 screenshots, overflow and serious/critical axe checks.');
} catch(error) {
 failure=String(error.message).replace(/https?:\/\/[^\s]+/g,url=>url.split('?')[0].split('#')[0]);
 console.error(failure.split('\n').slice(0,5).join('\n'));process.exitCode=1;
} finally {
 await context?.close();await browser?.close();await runtime.stop();
 await writeFile(evidence+'/browser-receipt.json',JSON.stringify({head,checks,viewports:[1440,390],failure:failure??null},null,2)+'\n');
}
