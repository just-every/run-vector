import {dashboardAccessCells} from './report-access-cells.mjs';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {beforePrivateNavigation} from './collaboration-navigation.mjs';
const require=createRequire(import.meta.url),axe=await readFile(require.resolve('axe-core/axe.min.js'),'utf8');
export async function dashboardsJourney(page,context,runtime,output) {
 const base=runtime.base,errors=[];
 const consoleError=m=>{if(/hydrat|did not match|Minified React error #(418|423|425)/i.test(m.text()))errors.push(m.text());};
 const pageError=e=>errors.push(e.message);page.on('console',consoleError);page.on('pageerror',pageError);
 const api=async(path,method='GET',data,who=context)=>{const r=await who.request.fetch(base+'/api'+path,{method,headers:{Origin:base},...(data===undefined?{}:{data})});assert(r.ok(),method+' '+path+' '+r.status());return r.json();};
 const state=await api('/settings/teams','POST',{name:'synthetic-vector-40',identifierPrefix:'SYNDS'}),team=state.teams.find(t=>t.identifierPrefix==='SYNDS'),status=team.statuses.find(s=>s.category==='completed').id;
 const owned=[];for(const date of ['2026-11-01','2026-11-03'])owned.push(await api('/issues','POST',{teamId:team.id,title:'synthetic-vector-41',statusId:status,dueDate:date}));
 await api('/settings/operators/invite','POST',{email:'synthetic-vector-42@example.test',displayName:'synthetic-vector-42',role:'member'});
 const mail=runtime.sql("SELECT json_extract(message,'$.text') text FROM rer_mail_development_outbox WHERE json_extract(message,'$.to[0]')='synthetic-vector-42@example.test' ORDER BY created_at DESC,sequence DESC LIMIT 1")[0].text;
 const token=new URL(mail.match(/https?:\/\/[^\s]+/)[0]).searchParams.get('token');
 const member=await context.browser().newContext({viewport:{width:1440,height:1000}});let memberPage;
 try {
  assert.equal((await member.request.post(base+'/auth/confirm',{headers:{Origin:base},data:{token},maxRedirects:0})).status(),303);
  const mine=await api('/issues','POST',{teamId:team.id,title:'synthetic-vector-43',statusId:status,dueDate:'2026-11-01'},member);
  await beforePrivateNavigation(page,base+'/app/insights');await page.goto(base+'/app/insights');await page.locator('[data-insights-ready="true"]').waitFor();
  await page.getByText('Filter issues',{exact:true}).click();
  for(const [label,value] of [['Team',team.id],['Scope','created'],['Status category','completed'],['Chart','throughput']]) {
   await Promise.all([page.waitForResponse(r=>new URL(r.url()).pathname==='/api/insights'&&r.status()===200),page.getByRole('combobox',{name:label,exact:true}).selectOption(value)]);await page.locator('[data-insights-ready="true"]').waitFor();
  }
  await page.getByRole('button',{name:'Dashboards',exact:true}).click();await page.locator('[data-dashboards-ready="true"]').waitFor();
  await page.getByRole('button',{name:'New dashboard',exact:true}).click();
  const form=page.getByRole('form',{name:'Edit dashboard',exact:true});await form.getByRole('textbox',{name:'Dashboard name',exact:true}).fill('synthetic-vector-44');
  await form.getByRole('button',{name:'Add count',exact:true}).click();await form.getByRole('button',{name:'Add issue list',exact:true}).click();
  for(const [index,name] of ['Delivery chart','Delivery count','Delivery issues'].entries())await form.locator('.dashboard-widget-editor').nth(index).getByRole('textbox',{name:'Widget name',exact:true}).fill(name);
  await form.locator('.dashboard-widget-editor').nth(2).getByRole('button',{name:'Move up',exact:true}).click();await form.locator('.dashboard-widget-editor').nth(1).getByRole('button',{name:'Move down',exact:true}).click();
  await form.getByRole('button',{name:'Save dashboard',exact:true}).click();await page.locator('[data-dashboard-ready="true"]').waitFor();
  const id=await page.getByRole('combobox',{name:'Open dashboard',exact:true}).inputValue();
  assert.equal((await member.request.get(base+'/api/dashboards/'+id)).status(),404);
  await page.getByRole('button',{name:'Edit dashboard',exact:true}).click();await form.getByRole('checkbox',{name:'Share inside the workspace',exact:true}).check();await form.getByRole('button',{name:'Save dashboard',exact:true}).click();await page.locator('[data-dashboard-ready="true"]').waitFor();
  const shared=await api('/dashboards/'+id,'GET',undefined,member);assert.deepEqual(shared.results.map(r=>r.count),[1,1,1]);assert.deepEqual(shared.results[2].issues.map(i=>i.identifier),[mine.identifier]);
  memberPage=await member.newPage();memberPage.setDefaultTimeout(20000);memberPage.on('console',consoleError);memberPage.on('pageerror',pageError);
  async function open(target,who,theme,width) {
   await api('/settings/appearance','PATCH',{theme},who);await target.setViewportSize({width,height:width===390?844:1000});
   await beforePrivateNavigation(target,base+'/app/insights');await target.goto(base+'/app/insights');await target.locator('[data-insights-ready="true"]').waitFor();
   await target.getByRole('button',{name:'Dashboards',exact:true}).click();await target.locator('[data-dashboards-ready="true"]').waitFor();
   await target.getByRole('combobox',{name:'Open dashboard',exact:true}).selectOption(id);await target.locator('[data-dashboard-ready="true"]').waitFor();
  }
  async function capture(target,theme,width,who) {
   await target.evaluate(source=>{if(window.axe)return;const s=document.createElement('script');const nonce=document.querySelector('script[nonce]')?.nonce;if(nonce)s.nonce=nonce;s.textContent=source;document.head.append(s);},axe);
   const violations=await target.evaluate(async()=>(await window.axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}})).violations.filter(v=>['serious','critical'].includes(v.impact)).map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)})));
   assert.deepEqual(violations,[],`${who} ${theme} ${width} dashboard accessibility`);assert.equal(await target.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   await target.getByRole('heading',{name:'Insights',exact:true}).scrollIntoViewIfNeeded();await target.screenshot({path:`${output}/dashboard-${who}-${theme}-${width}.png`,fullPage:true});
  }
  for(const theme of ['light','dark'])for(const width of [1440,390]) {
   await open(page,context,theme,width);
   assert.equal(await page.getByRole('region',{name:'Delivery count',exact:true}).locator('strong').textContent(),'2');
   await page.getByRole('button',{name:'Edit dashboard',exact:true}).click();
   await form.waitFor();
   for(const summary of await form.locator('.dashboard-widget-editor summary').all())await summary.click();
   await capture(page,theme,width,'editor');
   await form.locator('.dashboard-widget-editor').nth(2).getByRole('button',{name:'Move up',exact:true}).click();
   await form.locator('.dashboard-widget-editor').nth(1).getByRole('button',{name:'Move down',exact:true}).click();
   await form.getByRole('checkbox',{name:'Share inside the workspace',exact:true}).uncheck();
   await form.getByRole('button',{name:'Save dashboard',exact:true}).click();await page.locator('[data-dashboard-ready="true"]').waitFor();
   assert.equal((await member.request.get(base+'/api/dashboards/'+id)).status(),404);
   await page.getByRole('button',{name:'Edit dashboard',exact:true}).click();
   await form.getByRole('checkbox',{name:'Share inside the workspace',exact:true}).check();
   await form.getByRole('button',{name:'Save dashboard',exact:true}).click();await page.locator('[data-dashboard-ready="true"]').waitFor();

   await page.getByRole('region',{name:'Delivery chart',exact:true}).locator('.insights-bar').first().click();await page.getByRole('heading',{name:'Counted issues (2)',exact:true}).waitFor();
   await page.getByRole('combobox',{name:'Dashboard team',exact:true}).selectOption(team.id);await page.locator('[data-dashboard-ready="true"]').waitFor();
   await page.getByLabel('Due from',{exact:true}).fill('2026-11-02');await page.getByLabel('Due through',{exact:true}).fill('2026-11-05');
   await page.getByRole('region',{name:'Delivery count',exact:true}).getByText('1',{exact:true}).waitFor();await page.locator('[data-dashboard-ready="true"]').waitFor();
   const filtered=await api('/dashboards/'+id+'?team='+team.id+'&from=2026-11-02&to=2026-11-05');assert.deepEqual(filtered.results.map(r=>r.count),[1,1,1]);
   await capture(page,theme,width,'owner');
   await open(memberPage,member,theme,width);
   assert.equal(await memberPage.getByRole('region',{name:'Delivery count',exact:true}).locator('strong').textContent(),'1');
   assert.deepEqual((await memberPage.getByRole('region',{name:'Delivery issues',exact:true}).locator('li a').allTextContents()).map(t=>t.split(' · ')[0]),[mine.identifier]);
   assert.equal(await memberPage.getByRole('button',{name:'Edit dashboard',exact:true}).count(),0);
   for(const issue of owned)assert.equal((await memberPage.getByRole('region',{name:'Delivery issues',exact:true}).textContent()).includes(issue.identifier),false);
   await capture(memberPage,theme,width,'member');
   console.log(`REPORT-003 ${theme} ${width}: compose three widgets, share, viewer-scoped results, filters, drill-down, axe and overflow PASS`);
  }
  await dashboardAccessCells({page,member,memberPage,runtime,output,team,id,mine});
  assert.deepEqual(errors,[],'no dashboard hydration mismatch or page errors');
 }finally{await member.close();page.off('console',consoleError);page.off('pageerror',pageError);}
 await api('/settings/appearance','PATCH',{theme:'system'});
}
