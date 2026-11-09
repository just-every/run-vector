import assert from 'node:assert/strict';
import {writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
const root=process.cwd();
const {chromium}=await import(resolve(root,'node_modules/@playwright/test/index.mjs'));
const {createAdminRuntime,bootstrapOwner}=await import(resolve(root,'tests/e2e/admin-runtime-support.mjs'));
const {memberSuspensionJourney}=await import(resolve(root,'tests/e2e/member-suspension-journey.mjs'));
const evidence=resolve('../packet/browser');
await mkdir(evidence,{recursive:true});
const rows=[];
let browser,runtime;
try {
 runtime=createAdminRuntime(1440,[],{port:15974,inspectorPort:0});
 runtime.initialize();await runtime.start();
 browser=await chromium.launch({headless:true,executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-mock-keychain','--password-store=basic']});
 const context=await browser.newContext({viewport:{width:1440,height:1000}});
 const page=await context.newPage();
 await bootstrapOwner(page,runtime);
 const clause=async(id,name,fn)=>{await fn();rows.push({id,name,passed:true});};
 await memberSuspensionJourney({page,browser,runtime,clause,evidence});
 assert.deepEqual(runtime.workerExceptions(),[]);
 await writeFile(resolve(evidence,'receipt.json'),JSON.stringify({passed:true,widths:[1440,390],checks:rows},null,2)+'\n');
 console.log('PROBE ROLE-011: native Settings invitation, suspension HTTP, retained issue names and reactivation with fresh sign-in -> PASS; browser captures at 1440 and 390.');
} finally {if(browser)await browser.close();if(runtime)await runtime.stop();}
