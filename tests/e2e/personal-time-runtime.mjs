import {prepareTimeSurfaces,inspectTimeSurfaces} from './personal-time-surfaces.mjs';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {chromium} from '@playwright/test';
import {createAdminRuntime,bootstrapOwner} from './admin-runtime-support.mjs';
const output=resolve(process.env.VECTOR_TIME_SHOTS??'.artifacts/verification/personal-time');
await mkdir(output,{recursive:true});
const runtime=createAdminRuntime(1440,[],{port:15972,inspectorPort:15973});
let browser,page;
try {
 runtime.initialize();await runtime.start();browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']});
 const context=await browser.newContext({viewport:{width:1440,height:1000},timezoneId:'Australia/Brisbane',extraHTTPHeaders:{Connection:'close'}});page=await context.newPage();page.setDefaultTimeout(20000);await bootstrapOwner(page,runtime);
 const api=context.request,headers={Origin:runtime.base};
 const settings=await api.patch(runtime.base+'/api/settings',{headers,data:{timezone:'America/New_York'}});assert.equal(settings.status(),200);
 const state=await(await api.get(runtime.base+'/api/settings/administration')).json(),team=state.teams[0];
 const issueResponse=await api.post(runtime.base+'/api/issues',{headers,data:{title:'Reconcile October subscription invoices',teamId:team.id,description:'Check invoice totals and document the exceptions before the next billing cycle.',priority:'high',dueDate:'2026-10-30'}});assert.equal(issueResponse.status(),201);const issue=await issueResponse.json();
 const records=await prepareTimeSurfaces(context,runtime,issue,team);
 const retainedInstant=new Date(Date.now()+2*86400000).toISOString();
 assert.equal((await api.post(runtime.base+'/api/issues/'+issue.identifier+'/reminders',{headers,data:{remindAt:retainedInstant}})).status(),200);
 const persistedInstants=async()=>{
  const administration=await(await api.get(runtime.base+'/api/settings/administration')).json();
  const cycle=administration.cycles.find(c=>c.id===records.cycle.id);
  const reminders=await(await api.get(runtime.base+'/api/issues/'+issue.identifier+'/reminders')).json();
  return {cycle:[cycle.startsAt,cycle.endsAt],reminder:reminders.reminders.find(r=>r.remindAt===retainedInstant)?.remindAt};
 };
 const originalInstants=await persistedInstants();
 const future=new Date(Date.now()+3*86400000);future.setUTCHours(18,30,0,0);const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'America/Los_Angeles',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(future).map(p=>[p.type,p.value]));const local=`${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
 for(const width of [1440,390]) {
  await page.setViewportSize({width,height:width===390?844:1000});await page.goto(runtime.base+'/app/settings#personal-time');
  const form=page.getByRole('form',{name:'Your time preferences'});
  await form.getByLabel('Personal timezone',{exact:true}).selectOption('Australia/Brisbane');
  await page.waitForFunction(async()=>{const response=await fetch('/api/settings/personal-time');return response.ok&&(await response.json()).timezone==='Australia/Brisbane';},null,{polling:200});
  assert.equal((await(await api.get(runtime.base+'/api/settings/personal-time')).json()).effectiveTimezone,'Australia/Brisbane');
  assert.deepEqual(await persistedInstants(),originalInstants,'changing the display zone preserves reminder and cycle instants');
  const end=width===1440?'16:30':'16:45';
  const saved=page.waitForResponse(r=>r.url().endsWith('/settings/personal-time')&&r.request().method()==='PATCH'&&r.request().postDataJSON()?.workingHoursEnd===end);
  await form.getByLabel('Personal timezone',{exact:true}).selectOption('America/Los_Angeles');await form.getByLabel('Working day starts').fill('08:30');await form.getByLabel('Working day ends').fill(end);
  assert.equal((await saved).status(),200);
  await form.getByRole('status').waitFor();
  // The existing Settings journey now saves without a button and reads back on reload.
  await page.reload();await form.getByLabel('Personal timezone',{exact:true}).waitFor();
  assert.equal(await form.getByLabel('Personal timezone',{exact:true}).inputValue(),'America/Los_Angeles');
  assert.equal(await form.getByLabel('Working day ends').inputValue(),end);
  await context.setOffline(true);
  await form.getByLabel('Working day starts').fill('08:45');
  await form.getByRole('alert').waitFor();
  assert.equal(await form.getByLabel('Working day starts').inputValue(),'08:45');
  assert.ok(await form.getByLabel('Working day starts').isEnabled());
  assert.ok(await form.getByLabel('Working day starts').evaluate(field=>field===document.activeElement));
  await context.setOffline(false);
  const retried=page.waitForResponse(r=>r.url().endsWith('/settings/personal-time')&&r.request().method()==='PATCH'&&r.request().postDataJSON()?.workingHoursStart==='08:45');
  await form.getByRole('button',{name:'Retry',exact:true}).click();assert.equal((await retried).status(),200);
  assert.equal((await(await api.get(runtime.base+'/api/settings/personal-time')).json()).workingHoursStart,'08:45');
  // Leave within the debounce window: the draft survives, and the departure flush commits it.
  await form.getByLabel('Working day starts').fill('08:30');
  await page.goto(runtime.base+'/app/issues');
  await page.goto(runtime.base+'/app/settings#personal-time');
  await page.waitForFunction(()=>document.querySelector('input[name="workingHoursStart"]')?.value==='08:30');
  assert.equal(await form.getByLabel('Working day starts').inputValue(),'08:30');
  await page.getByRole('heading',{name:'Your time and working hours'}).scrollIntoViewIfNeeded();
  await page.screenshot({path:`${output}/settings-${width}.png`});await form.getByLabel('Working day ends').scrollIntoViewIfNeeded();await page.screenshot({path:`${output}/working-hours-${width}.png`});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.goto(runtime.base+'/app/issues/'+issue.identifier);await page.getByRole('heading',{name:issue.title,exact:true}).waitFor();await page.getByRole('button',{name:'Remind me',exact:true}).click();
  await page.getByLabel('Remind me at (Los Angeles time)').fill(local);const created=page.waitForResponse(r=>r.url().endsWith('/reminders')&&r.request().method()==='POST');await page.getByRole('button',{name:'Set personal reminder',exact:true}).click();assert.equal((await created).status(),200);
  const reminders=await(await api.get(runtime.base+'/api/issues/'+issue.identifier+'/reminders')).json();assert.ok(reminders.reminders.some(r=>r.remindAt===future.toISOString()),'personal zone controls the instant although browser is Brisbane');
  await page.getByText(/Next personal reminder:/).waitFor();await page.locator('.personal-reminders').scrollIntoViewIfNeeded();await page.screenshot({path:`${output}/reminder-${width}.png`});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  // Reload reads the saved clock during SSR; browser timezone must not change it.
  await page.reload();await page.getByText(/Next personal reminder:/).waitFor();assert.ok((await page.locator('.personal-reminders').innerText()).includes('America/Los_Angeles'));
  await inspectTimeSurfaces(page,context,runtime,issue,records,width,output,local);
  console.log(`[NOTIFY-010] ${width}: save personal zone and working hours, schedule in viewer zone, reload`);
 }
} catch(error){if(page)await page.screenshot({path:output+'/failure.png'}).catch(()=>{});throw error;}
finally{if(browser)await browser.close();await runtime.stop();}
