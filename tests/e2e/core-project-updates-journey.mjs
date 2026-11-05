import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {withOperatorClient} from './operator-request.mjs';
import {readDevelopmentLink} from './outbox-session.mjs';
import {beforePrivateNavigation,settleReads} from './collaboration-navigation.mjs';
const require=createRequire(import.meta.url);

/** Native lead authoring and a genuinely subscribed follower's exact Inbox door. */
export async function projectUpdatesJourney(page,context,base,capture=async()=>{},state,restart) {
 const call=async(current,path,method='GET',data)=>withOperatorClient(current,async client=>{
  const response=await client.fetch(base+'/api'+path,{method,headers:{Origin:base},...(data===undefined?{}:{data})});
  assert(response.ok(),`${method} ${path}: ${response.status()} ${await response.text()}`);return response.json();
 });
 const api=(...args)=>call(context,...args),suffix=String(Date.now());
 const sessions=[],browserErrors=[];
 const invite=async(index,name)=>{
  const email=['synthetic-vector-'+index+'-'+suffix,'vector.test'].join('@');
  await api('/settings/operators/invite','POST',{email,displayName:name,role:'member'});
  const link=await readDevelopmentLink(base,context.request,email,state);
  const current=await context.browser().newContext({storageState:await context.storageState(),viewport:{width:1440,height:1000},extraHTTPHeaders:{Connection:'close'}});
  sessions.push(current);const currentPage=await current.newPage();currentPage.setDefaultTimeout(20000);
  currentPage.on('pageerror',error=>browserErrors.push(error.message));
  currentPage.on('console',message=>{if(message.type()==='error')browserErrors.push(message.text());});
  await currentPage.goto(link);await currentPage.getByRole('button',{name:'Confirm',exact:true}).click();await currentPage.waitForURL(base+'/app');
  const person=await call(current,'/session');assert.equal(person.role,'member');
  return {context:current,page:currentPage,id:person.operatorId};
 };
 const go=async(currentPage,path)=>{await beforePrivateNavigation(currentPage,base+path);await currentPage.goto(base+path);};
 try {
  const lead=await invite(9810,'Project update lead'),follower=await invite(9811,'Project update follower');
  const name='synthetic-vector-project-updates-'+suffix;
  const project=(await api('/settings/projects','POST',{name,leadOperatorId:lead.id})).projects.find(item=>item.name===name);
  await api('/settings/projects/'+project.id,'PATCH',{lifecycle:'active'});
  const team=(await api('/settings/administration')).teams.find(item=>!item.archivedAt&&!item.isPrivate);
  await api('/issues','POST',{teamId:team.id,projectId:project.id,title:'synthetic-vector-update-scope'});
  const before=await api('/projects/'+project.id);
  await go(follower.page,'/app/projects/'+project.id);
  await follower.page.getByRole('button',{name:'Subscribe to project',exact:true}).click();
  await follower.page.getByRole('button',{name:'Unsubscribe from project',exact:true}).waitFor();
  assert.equal(await follower.page.getByRole('form',{name:'Post project update',exact:true}).count(),0);
  await go(lead.page,'/app/projects/'+project.id);
  const form=lead.page.getByRole('form',{name:'Post project update',exact:true});
  await form.getByRole('button',{name:'Bold text',exact:true}).focus();
  await lead.page.getByRole('tooltip',{name:'Bold text',exact:true}).waitFor();
  await lead.page.keyboard.press('Escape');
  await form.getByLabel('Stated status',{exact:true}).selectOption('at-risk');
  const body='## Settlement review\n\nThe **receipt** needs attention.\n\n- Confirm the retry\n- Retain the evidence';
  await form.getByRole('textbox',{name:'Update body',exact:true}).fill(body);
  const posting=lead.page.waitForResponse(response=>new URL(response.url()).pathname==='/api/projects/'+project.id+'/updates'&&response.request().method()==='POST');
  await form.getByRole('button',{name:'Post update',exact:true}).focus();await lead.page.keyboard.press('Enter');
  const response=await posting;assert.equal(response.status(),201);const saved=await response.json();
  assert.equal(saved.body,body);assert.equal(saved.status,'at-risk');assert.equal(saved.authorId,lead.id);
  assert.ok(Number.isFinite(Date.parse(saved.createdAt)));
  await lead.page.getByRole('article',{name:'Project update At risk',exact:true}).waitFor();
  await beforePrivateNavigation(lead.page,lead.page.url());await lead.page.reload();
  const card=lead.page.locator('#update-'+saved.id);
  await card.getByRole('heading',{name:'Settlement review',exact:true}).waitFor();
  assert.equal(await card.getByText('receipt',{exact:true}).evaluate(element=>element.tagName),'STRONG');
  assert.deepEqual(await card.locator('li').allTextContents(),['Confirm the retry','Retain the evidence']);
  assert.equal(await card.locator('time').getAttribute('datetime'),saved.createdAt);
  assert.ok((await card.innerText()).includes('Project update lead'));
  assert.ok((await card.innerText()).includes('Computed health:'));
  const after=await api('/projects/'+project.id);assert.equal(after.health,before.health);assert.deepEqual(after.progress,before.progress);
  assert.deepEqual(after.updates,[saved]);
  const actorInbox=await call(lead.context,'/notifications?limit=50');assert.equal(actorInbox.items.filter(item=>item.projectUpdateId===saved.id).length,0);
  if(restart) {
   // End private polling before stopping this journey's own Worker process.
   for(const currentPage of [page,lead.page,follower.page]) {
    await beforePrivateNavigation(currentPage,currentPage.url());await currentPage.goto('about:blank');
   }
   await restart();
   const replay=await call(lead.context,'/projects/'+project.id+'/updates','POST',{id:saved.id,status:saved.status,body});
   assert.deepEqual(replay,saved);
   await go(lead.page,'/app/projects/'+project.id);await card.getByRole('heading',{name:'Settlement review',exact:true}).waitFor();
  }
  await go(follower.page,'/app/inbox');
  const row=follower.page.getByRole('button').filter({has:follower.page.locator('.inbox-title',{hasText:name})});
  await row.waitFor();assert.equal(await row.count(),1);assert.ok((await row.innerText()).includes('Project update lead posted an update'));
  const notices=await call(follower.context,'/notifications?limit=50');
  const matching=notices.items.filter(item=>item.projectUpdateId===saved.id);assert.equal(matching.length,1);
  assert.equal(matching[0].projectId,project.id);assert.equal(matching[0].title,name);
  const axeSource=await readFile(require.resolve('axe-core/axe.min.js'),'utf8');
  const audit=async(currentPage)=>{
   await settleReads(currentPage);
   await currentPage.evaluate(source=>{const script=document.createElement('script');script.nonce=document.querySelector('script[nonce]')?.nonce??'';script.textContent=source;document.head.append(script);},axeSource);
   const violations=await currentPage.evaluate(async()=> (await window.axe.run()).violations.filter(item=>['serious','critical'].includes(item.impact)).map(item=>({id:item.id,targets:item.nodes.map(node=>node.target)})));
   assert.deepEqual(violations,[]);assert.ok(await currentPage.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  };
  await audit(lead.page);await audit(follower.page);
  // Behaviour asserts at desktop width; the candidate's changed states are also
  // inspected once on a phone without registering a duplicate journey.
  for(const width of [1440,390]) {
   await lead.page.setViewportSize({width,height:1000});await follower.page.setViewportSize({width,height:1000});
   await card.scrollIntoViewIfNeeded();await capture('PROJ-010','project-update-'+width,lead.page);
   await row.scrollIntoViewIfNeeded();await capture('PROJ-010','project-update-inbox-'+width,follower.page);
  }
  await lead.page.setViewportSize({width:1440,height:1000});await follower.page.setViewportSize({width:1440,height:1000});
  await row.focus();await follower.page.keyboard.press('Enter');
  await follower.page.waitForURL(base+'/app/projects/'+project.id+'#update-'+saved.id);
  await follower.page.locator('#update-'+saved.id).getByRole('heading',{name:'Settlement review',exact:true}).waitFor();
  assert.equal(await follower.page.getByRole('form',{name:'Post project update',exact:true}).count(),0);
  const readBack=await call(follower.context,'/notifications?limit=50');assert.ok(readBack.items.find(item=>item.id===matching[0].id).readAt);
  assert.deepEqual(browserErrors,[],'update and Inbox pages have no browser or hydration errors');
  console.log('PROBE PROJ-010 post: rendered lead form, At risk and Markdown -> dated attributed update survives document reload; computed health unchanged');
  console.log('PROBE PROJ-010 follower: rendered Subscribe and Inbox -> exactly one follower row, actor excluded, keyboard opens genuine project and stable update anchor');
 } finally {for(const current of sessions)await current.close();}
}
