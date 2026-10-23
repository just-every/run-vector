import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {beforePrivateNavigation} from './collaboration-navigation.mjs';
const require=createRequire(import.meta.url),axe=await readFile(require.resolve('axe-core/axe.min.js'),'utf8');
export async function calendarMonthJourney(page,context,runtime,output){
 const base=runtime.base,errors=[];const onError=e=>errors.push(e.message),onConsole=m=>{if(/hydrat|did not match|Minified React error #(418|423|425)/i.test(m.text()))errors.push(m.text());};page.on('pageerror',onError);page.on('console',onConsole);
 const api=async(path,method='GET',data)=>{const r=await context.request.fetch(base+'/api'+path,{method,headers:{Origin:base},...(data===undefined?{}:{data})});assert(r.ok(),method+' '+path+' '+r.status());return r.json();};
 const state=await api('/settings/teams','POST',{name:'synthetic-vector-81',identifierPrefix:'SYNMON'}),team=state.teams.find(t=>t.identifierPrefix==='SYNMON');
 const owner=runtime.sql("SELECT id FROM operators WHERE role='owner' AND removed_at IS NULL")[0].id;
 const projects=await api('/settings/projects','POST',{name:'synthetic-vector-82',leadOperatorId:owner}),project=projects.projects.find(p=>p.name==='synthetic-vector-82');
 await api('/settings/projects/'+project.id+'/milestones','POST',{name:'synthetic-vector-83',targetDate:'2026-11-06'});
 await api('/settings/cycles','POST',{name:'synthetic-vector-84',teamId:team.id,startsLocal:'2026-11-01T00:00',endsLocal:'2026-11-08T00:00'});
 const created=await api('/issues','POST',{teamId:team.id,projectId:project.id,title:'synthetic-vector-85',dueDate:'2026-11-04'}),identifier=created.identifier;
 const panel=page.getByRole('region',{name:'Month calendar',exact:true});
 const ready=()=>page.locator('[data-month-calendar-ready="true"]').waitFor();
 const day=async value=>{await panel.locator(`[data-calendar-day="${value}"]>button`).click();await panel.getByRole('region',{name:'Selected day events',exact:true}).waitFor();};
 const event=()=>panel.locator(`[data-calendar-event="${identifier}"]`);
 async function proof(theme,width,name){
  await page.evaluate(source=>{if(window.axe)return;const s=document.createElement('script');const nonce=document.querySelector('script[nonce]')?.nonce;if(nonce)s.nonce=nonce;s.textContent=source;document.head.append(s);},axe);
  const violations=await page.evaluate(async()=>(await window.axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}})).violations.filter(v=>['serious','critical'].includes(v.impact)).map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)})));
  assert.deepEqual(violations,[],theme+' '+width+' calendar accessibility');assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await panel.scrollIntoViewIfNeeded();await page.screenshot({path:output+'/month-'+name+'-'+theme+'-'+width+'.png',fullPage:true});
 }
 try{
 for(const theme of ['light','dark'])for(const width of [1440,390]){
  const before=await api('/issues/'+identifier);if(before.dueDate!=='2026-11-04')await api('/issues/'+identifier,'PATCH',{expectedVersion:before.version,dueDate:'2026-11-04'});
  await api('/settings/appearance','PATCH',{theme});await page.setViewportSize({width,height:width===390?844:1000});await beforePrivateNavigation(page,base+'/app/calendar');await page.goto(base+'/app/calendar');await ready();
  await panel.getByLabel('Calendar month',{exact:true}).fill('2026-11');await ready();await day('2026-11-04');await event().waitFor();
  const activityBefore=(await api('/issues/'+identifier)).activity.length;
  const saved=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/issues/'+identifier&&r.request().method()==='PATCH');
  await event().dragTo(panel.locator('[data-calendar-day="2026-11-06"]'),{sourcePosition:{x:12,y:12},targetPosition:{x:18,y:18}});assert.equal((await saved).status(),200);await ready();
  const moved=await api('/issues/'+identifier);assert.equal(moved.dueDate,'2026-11-06');assert.equal(moved.activity.length,activityBefore+1);assert(moved.activity.some(a=>a.previousValue?.dueDate==='2026-11-04'&&a.nextValue?.dueDate==='2026-11-06'));
  await page.getByRole('button',{name:'Dismiss Undo notice',exact:true}).click();await day('2026-11-06');assert((await panel.getByRole('region',{name:'Selected day events',exact:true}).textContent()).includes('synthetic-vector-83'));assert((await panel.getByRole('region',{name:'Selected day events',exact:true}).textContent()).includes('synthetic-vector-84'));await proof(theme,width,'drag');
  await event().getByRole('button',{name:'Change due date for '+identifier,exact:true}).focus();await page.keyboard.press('Enter');
  const form=panel.getByRole('form',{name:'Change due date for '+identifier,exact:true});await form.getByLabel('New due date',{exact:true}).fill('2026-11-07');await form.getByRole('button',{name:'Save due date',exact:true}).click();await ready();
  const keyboard=await api('/issues/'+identifier);assert.equal(keyboard.dueDate,'2026-11-07');assert.equal(keyboard.activity.length,moved.activity.length+1);
  await Promise.all([page.waitForResponse(r=>new URL(r.url()).pathname==='/api/calendar/events'&&r.status()===200),page.getByRole('region',{name:'Issue Undo',exact:true}).getByRole('button',{name:'Undo',exact:true}).click()]);await ready();assert.equal((await api('/issues/'+identifier)).dueDate,'2026-11-06');await page.getByRole('button',{name:'Dismiss Undo notice',exact:true}).click();
  await day('2026-11-06');await event().getByRole('button',{name:'Change due date for '+identifier,exact:true}).click();await form.getByLabel('New due date',{exact:true}).fill('2026-11-08');
  const current=await api('/issues/'+identifier);await api('/issues/'+identifier,'PATCH',{expectedVersion:current.version,priority:current.priority==='high'?'low':'high'});const raced=await api('/issues/'+identifier);
  await form.getByRole('button',{name:'Save due date',exact:true}).click();await panel.getByRole('alert').filter({hasText:'Your date change was not saved'}).waitFor();await ready();const after=await api('/issues/'+identifier);assert.equal(after.dueDate,'2026-11-06');assert.equal(after.version,raced.version);assert.equal(after.activity.length,raced.activity.length);await proof(theme,width,'stale');
  console.log('VIEW-007 '+theme+' '+width+': shared due/cycle/milestone reader, drag, keyboard, Undo, stale rejection, activity, axe and overflow PASS');
 }
 assert.deepEqual(errors,[],'no calendar hydration mismatch or page errors');
 }finally{page.off('pageerror',onError);page.off('console',onConsole);}
}
