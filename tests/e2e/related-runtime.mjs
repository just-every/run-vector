import {mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {chromium} from '@playwright/test';
import {createAdminRuntime,bootstrapOwner} from './admin-runtime-support.mjs';
import {relatedJourney} from './core-related-journey.mjs';
const evidence=resolve(process.env.VECTOR_RELATED_EVIDENCE??'.artifacts/verification/related');
await mkdir(evidence,{recursive:true});
const runtime=createAdminRuntime(1440,[],{port:15964,inspectorPort:15965});
let browser,page;
try {
  runtime.initialize();await runtime.start();
  browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']});
  const context=await browser.newContext({viewport:{width:1440,height:1000}});page=await context.newPage();
  page.setDefaultTimeout(15000);
  await bootstrapOwner(page,runtime);
  const state=await (await context.request.get(runtime.base+'/api/settings/administration')).json();
  await relatedJourney(page,context,runtime.base,state.teams[0].id,evidence,(id,detail)=>console.log(id+' '+detail));
} catch(error) {if(page)await page.screenshot({path:evidence+'/REL-007-failure.png'}).catch(()=>{});throw error;} finally {if(browser)await browser.close();await runtime.stop();}
