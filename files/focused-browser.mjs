import {resolve} from 'node:path';
import {mkdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const root='/workspace/run-vector';
const load=path=>import(pathToFileURL(resolve(root,path)));
const {chromium}=await load('node_modules/@playwright/test/index.mjs');
const {createAdminRuntime,bootstrapOwner}=await load('tests/e2e/admin-runtime-support.mjs');
const {projectMembershipJourney}=await load('tests/e2e/core-project-membership-journey.mjs');
const output=resolve(process.env.VECTOR_PROJECT_PROOF_OUTPUT??root+'/.artifacts/verification/project-recovery');await mkdir(output,{recursive:true});
const runtime=createAdminRuntime(1440,[],{port:15986,inspectorPort:15987});
let browser;
try {
 runtime.initialize();await runtime.start();
 browser=await chromium.launch({headless:true,executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-mock-keychain','--password-store=basic']});
 const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();page.setDefaultTimeout(20000);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',message=>{if(message.type()==='error'&&/hydrat/i.test(message.text()))errors.push(message.text());});
 await bootstrapOwner(page,runtime);
 await projectMembershipJourney(page,context,runtime.base,async(id,name,current)=>{await current.screenshot({path:output+'/'+name+'.png',fullPage:true});console.log('BROWSER '+id+' '+name);},runtime.state,{recoveryOnly:true});
 if(errors.length)throw Error(JSON.stringify(errors));
 console.log('BROWSER PASS: native recovery, keyboard controls, accessibility, both widths and no page errors');
} finally {
 if(browser)await browser.close();await runtime.stop();
}
