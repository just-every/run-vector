import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {beforePrivateNavigation} from './collaboration-navigation.mjs';
const require=createRequire(import.meta.url),axe=await readFile(require.resolve('axe-core/axe.min.js'),'utf8');
export async function projectTemplatesJourney(page,context,runtime,capture){
 const viewport=page.viewportSize(),base=runtime.base,errors=[];const onError=e=>errors.push(e.message),onConsole=m=>{if(/hydrat|did not match|Minified React error #(418|423|425)/i.test(m.text()))errors.push(m.text());};page.on('pageerror',onError);page.on('console',onConsole);
 const api=async(path,method='GET',data)=>{const r=await context.request.fetch(base+'/api'+path,{method,headers:{Origin:base},...(data===undefined?{}:{data})});assert(r.ok(),method+' '+path+' '+r.status());return r.json();};
 const state=await api('/settings/administration'),owner=state.viewer.operatorId??runtime.sql("SELECT id FROM operators WHERE role='owner' AND removed_at IS NULL")[0].id;
 const team=state.teams.find(t=>t.members.some(m=>m.operatorId===owner))??state.teams[0];
 const created=await api('/settings/projects','POST',{name:'synthetic-vector-72',description:'## Launch structure',leadOperatorId:owner,startDate:'2027-03-01'}),project=created.projects.find(p=>p.name==='synthetic-vector-72');
 let detail;for(const [i,date] of ['2027-03-04','2027-03-11'].entries())detail=await api('/settings/projects/'+project.id+'/milestones','POST',{name:'synthetic-vector-'+(73+i),description:'Milestone structure',targetDate:date});
 for(let i=0;i<4;i++)await api('/issues','POST',{teamId:team.id,projectId:project.id,milestoneId:detail.milestones[i<2?0:1].id,title:'synthetic-vector-'+(75+i),description:'**Default work**',priority:'high',dueDate:'2027-03-0'+(i+3)});
 async function check(name){
  await page.evaluate(source=>{if(window.axe)return;const s=document.createElement('script');const nonce=document.querySelector('script[nonce]')?.nonce;if(nonce)s.nonce=nonce;s.textContent=source;document.head.append(s);},axe);
  const violations=await page.evaluate(async()=>(await window.axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}})).violations.filter(v=>['serious','critical'].includes(v.impact)).map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)})));
  assert.deepEqual(violations,[],name+' accessibility');assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await capture(name,page);
 }
 try{
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:width===390?844:1000});await beforePrivateNavigation(page,base+'/app/projects/'+project.id);await page.goto(base+'/app/projects/'+project.id);
  await page.getByText('Manage '+project.name,{exact:true}).click();await page.getByRole('button',{name:'Save as template',exact:true}).click();
  const form=page.getByRole('form',{name:'Save project as template',exact:true});await form.getByLabel('Template name',{exact:true}).fill('synthetic-vector-79-'+width);await form.getByLabel('Update cadence',{exact:true}).fill('Every Friday');
  await form.getByRole('button',{name:'Save project template',exact:true}).click();await form.getByRole('status').filter({hasText:'Template saved:'}).waitFor();await check('project-template-save-'+width);
  const template=(await api('/project-templates')).templates.find(t=>t.name==='synthetic-vector-79-'+width);assert.equal(template.issues.length,4);assert.equal(template.milestones.length,2);
  await beforePrivateNavigation(page,base+'/app/projects');await page.goto(base+'/app/projects');await page.getByRole('button',{name:'New project from template',exact:true}).click();await page.locator('[data-project-templates-ready="true"]').waitFor();
  await page.getByLabel('Choose project template',{exact:true}).selectOption(template.id);await page.getByText('Preview project structure',{exact:true}).click();
  await page.getByRole('button',{name:'Edit project template',exact:true}).click();const edit=page.getByRole('form',{name:'Edit project template',exact:true});await edit.getByLabel('Update cadence',{exact:true}).fill('Every Monday');await check('project-template-editor-'+width);await edit.getByRole('button',{name:'Save template changes',exact:true}).click();await page.getByText(/Update cadence: Every Monday/).waitFor();
  const launch=page.getByRole('form',{name:'Create project from template',exact:true});await launch.getByLabel('New project name',{exact:true}).fill('synthetic-vector-80-'+width);await launch.getByLabel('New project start date',{exact:true}).fill('2027-05-01');await launch.getByLabel('Default issue team',{exact:true}).selectOption(team.id);await launch.getByRole('button',{name:'Create project from template',exact:true}).click();await page.getByRole('link',{name:'Open created project',exact:true}).waitFor();await check('project-template-launch-'+width);
  const id=(await page.getByRole('link',{name:'Open created project',exact:true}).getAttribute('href')).split('/').at(-1),result=await api('/projects/'+id);
  assert.deepEqual(result.milestones.map(m=>m.targetDate),['2027-05-04','2027-05-11']);assert.equal(result.activity.filter(a=>a.kind==='project.template_applied').length,1);
  const issues=runtime.sql(`SELECT due_date,assignee_operator_id FROM issues WHERE project_id='${id}' ORDER BY title`);assert.deepEqual(issues.map(i=>i.due_date),['2027-05-03','2027-05-04','2027-05-05','2027-05-06']);assert(issues.every(i=>i.assignee_operator_id===null));
  await page.getByRole('button',{name:'Delete project template',exact:true}).click();await page.getByRole('button',{name:'Delete template and keep projects',exact:true}).click();await page.getByRole('group',{name:'Confirm template deletion',exact:true}).waitFor({state:'hidden'});assert.equal((await api('/projects/'+id)).name,'synthetic-vector-80-'+width);
  console.log('PROJ-012 '+width+': save structure, edit cadence, launch two milestones/four issues with offsets, delete keeps projects, axe and overflow PASS');
 }
 assert.deepEqual(errors,[],'no template hydration mismatch or page errors');
 }finally{page.off('pageerror',onError);page.off('console',onConsole);if(viewport)await page.setViewportSize(viewport);}
}
