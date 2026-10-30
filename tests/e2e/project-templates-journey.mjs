import { withOperatorClient } from './operator-request.mjs';
import assert from 'node:assert/strict';
import {fromMarkdown} from 'mdast-util-from-markdown';
import {gfm} from 'micromark-extension-gfm';
import {gfmFromMarkdown} from 'mdast-util-gfm';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {verificationDirectory} from '../../scripts/verification-paths.mjs';
import {createUiRuntime} from './ui-runtime-support.mjs';
import {signIn,openAuthenticatedPage} from './ui-runtime-auth.mjs';
import {createRequire} from 'node:module';
import {beforePrivateNavigation} from './collaboration-navigation.mjs';
const require=createRequire(import.meta.url),axe=await readFile(require.resolve('axe-core/axe.min.js'),'utf8');
export async function projectTemplatesJourney(page,context,runtime,capture){
 const viewport=page.viewportSize(),base=runtime.base,errors=[];const onError=e=>errors.push(e.message),onConsole=m=>{if(/hydrat|did not match|Minified React error #(418|423|425)/i.test(m.text()))errors.push(m.text());};page.on('pageerror',onError);page.on('console',onConsole);
 const api=async(path,method='GET',data)=>{return withOperatorClient(context, async client => {
const r=await client.fetch(base+'/api'+path,{method,headers:{Origin:base},...(data===undefined?{}:{data})});assert(r.ok(),method+' '+path+' '+r.status());return await r.json();
});};
 const state=await api('/settings/administration'),owner=state.viewer.operatorId??runtime.sql("SELECT id FROM operators WHERE role='owner' AND removed_at IS NULL")[0].id;
 const options=await api('/options'),library=await api('/project-templates');
 const memberships=state.teams.filter(t=>t.members.some(m=>m.operatorId===owner));
 assert.deepEqual(library.teams.map(t=>t.id).sort(),memberships.map(t=>t.id).sort(),'saving scope remains membership-only');
 assert.equal(options.operator.role,'owner','journey uses the native Owner');
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
  const formatted=width===1440?await templateFormattingJourney(page,api,template.id,check):null;
  await page.getByRole('button',{name:'Edit project template',exact:true}).click();const edit=page.getByRole('form',{name:'Edit project template',exact:true});await edit.getByLabel('Update cadence',{exact:true}).fill('Every Monday');await check('project-template-editor-'+width);await edit.getByRole('button',{name:'Save template changes',exact:true}).click();await page.getByText(/Update cadence: Every Monday/).waitFor();
  const launch=page.getByRole('form',{name:'Create project from template',exact:true});await launch.getByLabel('New project name',{exact:true}).fill('synthetic-vector-80-'+width);await launch.getByLabel('New project start date',{exact:true}).fill('2027-05-01');assert.deepEqual(await launch.getByLabel('Default issue team',{exact:true}).locator('option').evaluateAll(nodes=>nodes.filter(n=>n.value).map(n=>n.value).sort()),options.teams.map(t=>t.id).sort(),'launch offers the native issue teams even without memberships');await launch.getByLabel('Default issue team',{exact:true}).selectOption(team.id);await launch.getByRole('button',{name:'Create project from template',exact:true}).click();await page.getByRole('link',{name:'Open created project',exact:true}).waitFor();await check('project-template-launch-'+width);
  const id=(await page.getByRole('link',{name:'Open created project',exact:true}).getAttribute('href')).split('/').at(-1),result=await api('/projects/'+id);
  assert.deepEqual(result.milestones.map(m=>m.targetDate),['2027-05-04','2027-05-11']);assert.equal(result.activity.filter(a=>a.kind==='project.template_applied').length,1);
  const issues=runtime.sql(`SELECT due_date,assignee_operator_id FROM issues WHERE project_id='${id}' ORDER BY title`);assert.deepEqual(issues.map(i=>i.due_date),['2027-05-03','2027-05-04','2027-05-05','2027-05-06']);assert(issues.every(i=>i.assignee_operator_id===null));
  await page.getByRole('button',{name:'Delete project template',exact:true}).click();await page.getByRole('button',{name:'Delete template and keep projects',exact:true}).click();await page.getByRole('group',{name:'Confirm template deletion',exact:true}).waitFor({state:'hidden'});const retained=await api('/projects/'+id);assert.equal(retained.name,'synthetic-vector-80-'+width);assert.deepEqual(retained.milestones.map(m=>m.targetDate),['2027-05-04','2027-05-11']);assert.deepEqual(runtime.sql(`SELECT due_date,assignee_operator_id FROM issues WHERE project_id='${id}' ORDER BY title`),issues);
  await beforePrivateNavigation(page,base+'/app/projects/'+id);await page.goto(base+'/app/projects/'+id);await page.getByRole('heading',{name:'synthetic-vector-80-'+width,exact:true}).waitFor();await check('project-template-retained-'+width);
  if(formatted){
   assert.deepEqual([retained.description,retained.milestones[0].description],formatted.slice(0,2),'application and deletion preserve descriptions');
   await assertFormatting(page.locator('.project-detail__header .safe-markdown').first(),'Template plan');
   await assertFormatting(page.locator('.project-milestones .safe-markdown').first(),'Milestone plan');
   await formattingScreens(page,check,'project-template-markdown-project');
   const issue=runtime.sql(`SELECT identifier,description FROM issues WHERE project_id='${id}' AND title='synthetic-vector-75'`)[0];assert.equal(issue.description,formatted[2]);
   await beforePrivateNavigation(page,base+'/app/issues/'+issue.identifier);await page.goto(base+'/app/issues/'+issue.identifier);
   await assertFormatting(page.locator('.description-source .safe-markdown').first(),'Issue plan');
   await formattingScreens(page,check,'project-template-markdown-issue');
   console.log('PROBE ISSUE-026 application: create project from saved template, delete template -> rendered project, milestone and issue GFM with highlighting, relative dates retained, project survives');
  }
  console.log('PROJ-012 '+width+': save structure, edit cadence, launch two milestones/four issues with offsets, delete keeps projects, axe and overflow PASS');
 }
 assert.deepEqual(errors,[],'no template hydration mismatch or page errors');
 }finally{page.off('pageerror',onError);page.off('console',onConsole);if(viewport)await page.setViewportSize(viewport);}
}

// Keep the historical native sample installation distinct from configured-owner
// setup: its first Owner has public issue access without any team memberships.
export async function nativeProjectTemplatesJourney(browser){
 const runtime=createUiRuntime(),output=resolve(verificationDirectory,'native-template-browser');let page;
 await mkdir(output,{recursive:true});
 try{
  runtime.initialize();runtime.start();await runtime.ready();const {cookie}=await signIn(runtime);
  assert.equal(runtime.sql('SELECT count(*) count FROM team_members')[0].count,0,'native sample is not silently joined to a team');
  page=await openAuthenticatedPage(browser,cookie,runtime.base);page.setDefaultTimeout(20000);
  await projectTemplatesJourney(page,page.context(),runtime,(name,current)=>current.screenshot({path:resolve(output,name+'.png'),fullPage:true}));
  assert.equal(runtime.sql('SELECT count(*) count FROM team_members')[0].count,0,'template launch never backfills membership');
 }finally{await page?.context().close();await runtime.stop();}
}

// Exercise formatting at desktop width; capture the same changed screens on a
// phone without registering another permanent test or duplicating assertions.
async function templateFormattingJourney(page,api,id,check){
 await page.getByRole('button',{name:'Edit project template',exact:true}).click();
 const edit=page.getByRole('form',{name:'Edit project template',exact:true});
 const bodies=[];
 for(const [label,title] of [['Template description','Template plan'],['Milestone description','Milestone plan'],['Issue Markdown description','Issue plan']]){
  const field=edit.getByLabel(label,{exact:true}).first();
  assert.equal(await field.getAttribute('maxlength'),'100000');
  await field.fill('/h2');await field.press('Enter');await field.pressSequentially(title);
  async function insert(query){
   await field.press('ControlOrMeta+End');await field.press('Enter');await field.press('Enter');
   await field.pressSequentially('/'+query);await field.press('Enter');
  }
  await insert('quote');await field.pressSequentially('Retain the launch plan');
  await insert('divider');await insert('table');await insert('code');
  await edit.getByRole('option',{name:'typescript',exact:true}).click();
  await field.pressSequentially('const ready: boolean = true;');
  await field.press('ControlOrMeta+End');await field.press('Enter');await field.press('Enter');
  await field.evaluate(element=>{
   const data=new DataTransfer();
   data.setData('text/html','<h2>Pasted plan</h2><ul><li>Plan item</li></ul><p><a href="https://example.test/guide">Guide</a></p><script>window.syntheticTemplateScript=true</script>');
   data.setData('text/plain','Pasted plan Plan item Guide');
   element.dispatchEvent(new ClipboardEvent('paste',{bubbles:true,cancelable:true,clipboardData:data}));
  });
  const body=await field.inputValue();bodies.push(body);
  assert(!body.includes('script')&&!body.includes('syntheticTemplateScript'),'rich paste drops script and its content');
  const nodes=fromMarkdown(body,{extensions:[gfm()],mdastExtensions:[gfmFromMarkdown()]}).children;
  assert.deepEqual(nodes.map(node=>node.type),['heading','blockquote','thematicBreak','table','code','heading','list','paragraph']);
  assert.equal(nodes[0].children[0].value,title);assert.equal(nodes[4].lang,'typescript');assert.equal(nodes[4].value,'const ready: boolean = true;');
  assert.equal(nodes[3].children.length,2);assert(nodes[3].children.every(row=>row.children.length===2));
  assert.equal(nodes[6].children[0].children[0].children[0].value,'Plan item');assert.equal(nodes[7].children[0].url,'https://example.test/guide');
  const bold=field.locator('..').getByRole('button',{name:'Bold text',exact:true});
  await bold.focus();await page.getByRole('tooltip',{name:'Bold text',exact:true}).waitFor();await field.focus();
 }
 await formattingScreens(page,check,'project-template-markdown-editor');
 await edit.getByRole('button',{name:'Save template changes',exact:true}).click();
 await page.getByRole('button',{name:'Edit project template',exact:true}).waitFor();
 await page.reload();await page.getByRole('button',{name:'New project from template',exact:true}).click();
 await page.locator('[data-project-templates-ready="true"]').waitFor();await page.getByLabel('Choose project template',{exact:true}).selectOption(id);
 const stored=await api('/project-templates/'+id);
 assert.deepEqual([stored.description,stored.milestones[0].description,stored.issues[0].description],bodies,'all three drafts persist as GFM');
 await page.getByRole('button',{name:'Edit project template',exact:true}).click();
 const reopened=page.getByRole('form',{name:'Edit project template',exact:true});
 for(const [index,label] of ['Template description','Milestone description','Issue Markdown description'].entries())assert.equal(await reopened.getByLabel(label,{exact:true}).first().inputValue(),bodies[index],'reopened controlled draft');
 await reopened.getByRole('button',{name:'Cancel template edit',exact:true}).click();
 await page.getByText('Preview project structure',{exact:true}).click();
 const previews=page.locator('.template-preview .safe-markdown');
 await assertFormatting(previews.nth(0),'Template plan');await assertFormatting(previews.nth(1),'Milestone plan');await assertFormatting(previews.nth(3),'Issue plan');
 assert.equal(await page.evaluate(()=>window.syntheticTemplateScript),undefined);
 await formattingScreens(page,check,'project-template-markdown-preview');
 console.log('PROBE ISSUE-026 authoring: template slash controls, rich HTML paste, save and reopen -> three stored GFM drafts, safe previews and tooltips');
 return bodies;
}
async function assertFormatting(root,title){
 await root.getByRole('heading',{name:title,exact:true}).waitFor();
 assert.equal((await root.locator('blockquote').textContent()).trim(),'Retain the launch plan');
 assert.equal(await root.locator('hr').count(),1);assert.equal(await root.getByRole('table').count(),1);
 assert.equal(await root.locator('th').count(),2);assert.equal(await root.locator('td').count(),2);
 assert.equal((await root.locator('code.language-typescript').textContent()).trim(),'const ready: boolean = true;');
 assert(await root.locator('code.language-typescript .hljs-keyword').count()>0,'TypeScript syntax highlighting');
 await root.getByRole('heading',{name:'Pasted plan',exact:true}).waitFor();assert.equal((await root.locator('li').textContent()).trim(),'Plan item');
 assert.equal(await root.getByRole('link',{name:'Guide',exact:true}).getAttribute('href'),'https://example.test/guide');
 assert.equal(await root.locator('script').count(),0);assert(!(await root.textContent()).includes('syntheticTemplateScript'));
}
async function formattingScreens(page,check,name){
 const viewport=page.viewportSize();
 try{await check(name+'-1440');await page.setViewportSize({width:390,height:844});await check(name+'-390');}
 finally{await page.setViewportSize(viewport);}
}
