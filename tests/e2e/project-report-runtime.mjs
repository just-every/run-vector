import { withOperatorClient } from './operator-request.mjs';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {chromium} from '@playwright/test';
import {createAdminRuntime,bootstrapOwner} from './admin-runtime-support.mjs';
import {beforePrivateNavigation} from './collaboration-navigation.mjs';
import {writeRuntimeD1} from './runtime-d1.mjs';

const output=resolve(process.env.VECTOR_PROJECT_REPORT_SHOTS??'.artifacts/verification/project-report');
await mkdir(output,{recursive:true});
const runtime=createAdminRuntime(1440,[],{port:15976,inspectorPort:15977});
let browser,page;
try {
 runtime.initialize();await runtime.start();
 browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']});
 const context=await browser.newContext({viewport:{width:1440,height:1000}});
 page=await context.newPage();page.setDefaultTimeout(20000);await bootstrapOwner(page,runtime);
 async function api(path,method='GET',data) {
  return withOperatorClient(context, async client => {
const response=await client.fetch(runtime.base+'/api'+path,{method,headers:{Origin:runtime.base},...(data===undefined?{}:{data})});
  assert(response.ok(),`${method} ${path}: ${response.status()} ${await response.text()}`);
  return await response.json();
});
 }
 const {operatorId}=await api('/session');
 await api('/settings','PATCH',{timezone:'Australia/Brisbane'});
 const suffix=String(Date.now()),prefix='PR'+suffix.slice(-6).replaceAll(/\d/g,d=>String.fromCharCode(65+Number(d)));
 const administration=await api('/settings/teams','POST',{name:'Project reporting '+suffix,identifierPrefix:prefix});
 const team=administration.teams.find(t=>t.identifierPrefix===prefix);
 const status=category=>team.statuses.find(s=>s.category===category).id;
 const makeProject=async name=>(await api('/settings/projects','POST',{name,leadOperatorId:operatorId})).projects.find(p=>p.name===name);
 const project=await makeProject('Settlement reliability '+suffix),destination=await makeProject('Settlement follow-through '+suffix);
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Australia/Brisbane',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()).map(p=>[p.type,p.value]));
 const today=`${parts.year}-${parts.month}-${parts.day}`;
 const day=offset=>new Date(Date.parse(today+'T12:00:00Z')+offset*86400000).toISOString().slice(0,10);
 const at=offset=>day(offset)+'T00:00:00.000Z';
 await writeRuntimeD1(runtime.base,'UPDATE projects SET created_at=? WHERE id=?',[at(-7),project.id]);
 // Only chronology is a fixture. Every creation, move, reopening and deletion uses the HTTP product door.
 const fixtureAt=async(issue,offset,created=false,membership=false)=>{
  const statements=[
   {sql:`UPDATE issues SET updated_at=?${created?',created_at=?':''} WHERE id=?`,params:created?[at(offset),at(offset),issue.id]:[at(offset),issue.id]},
   {sql:'UPDATE issue_activity SET created_at=?,updated_at=? WHERE id=(SELECT id FROM issue_activity WHERE issue_id=? ORDER BY julianday(created_at) DESC,id DESC LIMIT 1)',params:[at(offset),at(offset),issue.id]},
  ];
  if(membership)statements.push({sql:'UPDATE project_membership_events SET occurred_at=? WHERE identifier=? AND julianday(occurred_at)>julianday(?)',params:[at(offset),issue.identifier,at(-1)]});
  await writeRuntimeD1(runtime.base,statements);
 };
 const create=async(title,offset,category='started')=>{
  const issue=await api('/issues','POST',{title,teamId:team.id,projectId:project.id,statusId:status(category)});
  await fixtureAt(issue,offset,true,true);return issue;
 };
 const patch=async(issue,changes,offset)=>{
  const current=await api('/issues/'+issue.identifier);
  await api('/issues/'+issue.identifier,'PATCH',{expectedVersion:current.version,...changes});
  await fixtureAt(issue,offset,false,Object.hasOwn(changes,'projectId'));
 };
 const first=await create('Reconcile settlement receipts',-6),moved=await create('Investigate provider latency',-6);
 const erased=await create('Remove obsolete receipt work',-6),remaining=await create('Confirm final settlement audit',-6);
 await patch(first,{statusId:status('completed')},-5);
 const added=await create('Repair interrupted callbacks',-4);
 await patch(moved,{projectId:destination.id},-4);
 await patch(first,{statusId:status('started')},-3);
 await patch(first,{statusId:status('completed')},-2);
 await patch(added,{statusId:status('completed')},-1);
 await create('Completed settlement review',0,'completed');
 // Close each fixture workspace day through the same scheduled HTTP door as cron.
 for(let offset=-5;offset<=0;offset++) {
  const tick=await context.request.get(runtime.base+'/cdn-cgi/local/scheduled?cron='+encodeURIComponent('* * * * *')+'&time='+Date.parse(at(offset)));
  assert.equal(tick.status(),200);await tick.body();
 }
 const read=async()=>(await api('/projects/'+project.id)).report;
 const live=await read();
 assert.deepEqual(live.days.map(d=>[d.scope,d.completed]),[[null,null],[4,0],[4,1],[4,1],[4,0],[4,1],[4,2],[5,3]]);
 assert.deepEqual(live.days[3].removed,[moved.identifier]);
 assert.equal(live.projection.status,'projected');assert.equal(live.projection.remaining,2);
 assert.equal(live.projection.completions,3);assert.equal(live.projection.date,day(19));
 async function capture(name,report) {
  for(const width of [1440,390]) {
   await page.setViewportSize({width,height:width===390?844:1000});
   await beforePrivateNavigation(page,runtime.base+'/app/projects/'+project.id);await page.goto(runtime.base+'/app/projects/'+project.id);
   const panel=page.getByRole('region',{name:'Project report',exact:true});
   await panel.getByRole('img',{name:'Project burn-up of issue scope and completion by day',exact:true}).waitFor();
   await panel.getByText('Daily data and scope changes',{exact:true}).click();
   const rows=panel.getByRole('region',{name:'Daily burn-up data',exact:true}).getByRole('row');
   const final=rows.filter({has:page.locator(`time[datetime="${today}"]`)});
   assert.equal(await final.getByRole('cell').nth(0).innerText(),String(report.days.at(-1).scope));
   assert.equal(await final.getByRole('cell').nth(1).innerText(),String(report.days.at(-1).completed));
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   await panel.getByRole('heading',{name:'Project burn-up',exact:true}).evaluate(el=>el.scrollIntoView({block:'start'}));
   await page.screenshot({path:`${output}/${name}-${width}-chart.png`});
   await panel.getByRole('heading',{name:report.source==='snapshot'?'Final report':'Completion projection',exact:true}).evaluate(el=>el.scrollIntoView({block:'start'}));
   await page.screenshot({path:`${output}/${name}-${width}-projection.png`});
   console.log(`[REPORT-002] ${name}-${width}: daily scope, completions, scope markers, projection and history limitations`);
  }
 }
 await capture('live-project-report',live);
 let current=await api('/issues/'+erased.identifier);
 await api('/issues/'+erased.identifier,'DELETE',{expectedVersion:current.version,confirmed:true});
 const deleted=await read();
 assert.equal(deleted.days[0].scope,null);assert(deleted.limitations.length>0);
 assert.deepEqual(deleted.days.slice(0,-1),live.days.slice(0,-1));
 assert.deepEqual([deleted.days.at(-1).scope,deleted.days.at(-1).completed],[4,3]);
 assert(deleted.days.at(-1).removed.includes(erased.identifier));
 assert.equal(deleted.projection.date,day(10));
 await capture('deleted-project-report',deleted);
 await api('/settings/projects/'+project.id,'PATCH',{lifecycle:'completed'});
 const frozen=await read();assert.equal(frozen.source,'snapshot');assert.equal(frozen.finalState,'completed');
 assert.equal(frozen.projection.date,null);
 await patch(remaining,{statusId:status('completed')},0);
 current=await api('/issues/'+first.identifier);
 await api('/issues/'+first.identifier,'DELETE',{expectedVersion:current.version,confirmed:true});
 assert.deepEqual(await read(),frozen);
 await capture('frozen-project-report',frozen);
 for(const [name,change,state] of [['canceled-project-report',{lifecycle:'canceled'},'canceled'],['archived-project-report',{archived:true},'archived']]) {
  await api('/settings/projects/'+project.id,'PATCH',{lifecycle:'active',archived:false});
  await api('/settings/projects/'+project.id,'PATCH',change);
  const terminal=await read();assert.equal(terminal.source,'snapshot');assert.equal(terminal.finalState,state);
  assert.equal(terminal.projection.date,null);
  await capture(name,terminal);
 }

} catch(error) {if(page)await page.screenshot({path:output+'/failure.png'}).catch(()=>{});throw error;}
finally {if(browser)await browser.close();await runtime.stop();}
