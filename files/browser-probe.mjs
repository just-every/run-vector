import {chromium} from '@playwright/test';
import {createAdminRuntime,bootstrapOwner} from '../../tests/e2e/admin-runtime-support.mjs';
import {dashboardsJourney} from '../../tests/e2e/dashboards-journey.mjs';
import {streamControlsJourney} from '../../tests/e2e/core-stream-controls-journey.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
const mode=process.argv[2],output=process.cwd()+'/.artifacts/fleet/'+mode;
await mkdir(output,{recursive:true});
const runtime=createAdminRuntime(1440,[],{port:15974,inspectorPort:15975});let browser,page;
try {
 runtime.initialize();await runtime.start();browser=await chromium.launch({headless:true,executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 const context=await browser.newContext({viewport:{width:1440,height:1000}});page=await context.newPage();page.setDefaultTimeout(20000);await bootstrapOwner(page,runtime);
 if(mode==='dashboards')await dashboardsJourney(page,context,runtime,output);
 else await streamControlsJourney(page,context,runtime.base,(...v)=>console.log(...v),async name=>page.screenshot({path:output+'/'+name+'.png'}),[1440]);
 console.log('PROBE '+mode+' PASS');
} catch(error) {
 console.log('PROBE '+mode+' FAIL',error.stack);
 if(page){
  await page.screenshot({path:output+'/failure.png',fullPage:true}).catch(()=>{});
  await writeFile(output+'/diagnostic.json',JSON.stringify({url:page.url().split('#')[0],body:await page.locator('body').innerText(),selects:await page.locator('select').evaluateAll(rows=>rows.map(s=>({label:s.getAttribute('aria-label'),value:s.value,disabled:s.disabled})))},null,2));
 }
 process.exitCode=1;
} finally {if(browser)await browser.close();await runtime.stop();}
