import {mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {chromium} from '@playwright/test';
import {createAdminRuntime,bootstrapOwner} from './admin-runtime-support.mjs';
import {cycleReportJourney} from './cycle-report-journey.mjs';
const output=resolve(process.env.VECTOR_REPORT_SHOTS??'.artifacts/verification/cycle-report');
await mkdir(output,{recursive:true});
const runtime=createAdminRuntime(1440,[],{port:15974,inspectorPort:15975});let browser,page;
try {
 runtime.initialize();await runtime.start();browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']});
 const context=await browser.newContext({viewport:{width:1440,height:1000}});page=await context.newPage();page.setDefaultTimeout(20000);await bootstrapOwner(page,runtime);
 await cycleReportJourney(page,context,runtime.base,async(clause,name,page)=>{
  const panel=page.getByRole('region',{name:'Cycle report',exact:true});
  await panel.getByRole('heading',{name:'Cycle burn-up',exact:true}).evaluate(el=>el.scrollIntoView({block:'start'}));await page.screenshot({path:`${output}/${name}-chart.png`});
  await panel.getByRole('heading',{name:/^(Final report|Current scope report)$/,exact:true}).evaluate(el=>el.scrollIntoView({block:'start'}));await page.screenshot({path:`${output}/${name}-outcomes.png`});
  await panel.getByRole('region',{name:'Cycle report by assignee',exact:true}).evaluate(el=>el.scrollIntoView({block:'start'}));await page.screenshot({path:`${output}/${name}-assignees.png`});
  console.log(`[${clause}] ${name}: inspect daily scope, completion, additions/removals and assignees`);
 });
} catch(error){if(page)await page.screenshot({path:output+'/failure.png'}).catch(()=>{});throw error;}
finally{if(browser)await browser.close();await runtime.stop();}
