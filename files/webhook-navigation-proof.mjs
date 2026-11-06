import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
const req=createRequire(process.cwd()+'/package.json'),{chromium}=req('@playwright/test');
const load=path=>import(pathToFileURL(resolve(path)));
const {createUiRuntime}=await load('tests/e2e/ui-runtime-support.mjs');
const {signIn,openAuthenticatedPage}=await load('tests/e2e/ui-runtime-auth.mjs');
const {exerciseWebhookComments}=await load('tests/e2e/integrations/webhook-comments.mjs');
process.env.VECTOR_CHANNEL_EDGE=resolve('.artifacts/verification/webhook-navigation-edge-'+process.pid+'.jsonl');
const runtime=createUiRuntime(),evidence=resolve('.artifacts/verification/webhook-navigation-proof');let browser;
const head=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const held=process.argv.includes('--hold-response');
let canceled=0;
try {
 await mkdir(evidence,{recursive:true});runtime.initialize();runtime.start();await runtime.ready();
 const {cookie}=await signIn(runtime);
 const admin=await(await runtime.req('/api/settings/administration',{headers:{Cookie:cookie}})).json();
 const team=admin.teams.find(t=>!t.archivedAt);
 browser=await chromium.launch({headless:true,executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 const page=await openAuthenticatedPage(browser,cookie,runtime.base);page.setDefaultTimeout(20000);
 if(held)await page.route('**/api/issues/*/comments',async route=>{
   if(route.request().method()!=='POST')return route.continue();
   const response=await route.fetch();
   // The real mutation is committed; delay only its browser acknowledgement.
   await new Promise(resolve=>setTimeout(resolve,5000));
   try{await route.fulfill({response});}catch(error){canceled++;console.log('Held mutation acknowledgement canceled by document navigation.');}
 });
 await exerciseWebhookComments({page,runtime,cookie,team,evidence});
 console.log(JSON.stringify({head,passed:true,heldMutationResponseMs:held?5000:0,canceled}));
}catch(error){
 console.log(JSON.stringify({head,passed:false,heldMutationResponseMs:held?5000:0,canceled,failure:error.message}));
 throw error;
}finally{await browser?.close();await runtime.stop();}
