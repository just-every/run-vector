import {mkdtempSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
// The built Worker uses the existing provider network edge, never a product mock.
process.env.VECTOR_CHANNEL_EDGE??=join(mkdtempSync(join(tmpdir(),'vector-initiative-edge-')),'calls.jsonl');
import { withOperatorClient } from './operator-request.mjs';
import assert from 'node:assert/strict';
import {roleScreens} from './role-ui-support.mjs';
import {navigate,settleReads,trackRequests} from './collaboration-navigation.mjs';
import {confirmLink,readDevelopmentLink} from './outbox-session.mjs';
import {openAuthenticatedPage} from './ui-runtime-auth.mjs';
export async function initiativesJourney({page:shared,runtime,evidence}){
 const page=await shared.context().newPage();trackRequests(page);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(/hydration|did not match|Minified React error #(418|423|425)/i.test(m.text()))errors.push(m.text());});
 const inspect=roleScreens(evidence),base=runtime.base;
 const call=async(path,method='GET',data,status=200)=>{return withOperatorClient(page.context(), async client => {
const r=await client.fetch(base+'/api'+path,{method,headers:{Origin:base},data});assert.equal(r.status(),status,await r.text());return await r.json();
});};
 try{
 const settings=await call('/settings/administration'),team=settings.teams.find(t=>!t.archivedAt),owner=settings.viewer.id;
 await call('/settings/notifications','PATCH',{mutedKinds:[]});
 let memberFixture;
 // Viewports share one real Member; restore its role through the public Owner door.
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:1000});
  const capture=async(name)=>{await inspect(page,page.locator('main:visible').first(),name+'-'+width);await page.setViewportSize({width,height:1000});};
  const otherName='synthetic-vector-1790-'+width,state=await call('/settings/teams','POST',{name:otherName,identifierPrefix:'INIT'+(width===390?'M':'D')});
  const other=state.teams.find(t=>t.name===otherName),projects=[];
  for(let i=0;i<3;i++){const name='synthetic-vector-1791-'+width+'-'+i,created=await call('/settings/projects','POST',{name,leadOperatorId:owner});const project=created.projects.find(p=>p.name===name);projects.push(project);await call('/issues','POST',{teamId:i===0?team.id:other.id,projectId:project.id,title:'synthetic-vector-1792-'+width+'-'+i},201);}
  const create=async(name,parentId)=>{
   await navigate(page,base+'/app/initiatives');await page.getByRole('heading',{name:'Initiatives',exact:true}).waitFor();
   const form=page.getByRole('form',{name:'Create initiative',exact:true});
   await form.getByLabel('Initiative name',{exact:true}).fill(name);
   await form.getByLabel('Parent initiative',{exact:true}).selectOption(parentId??'');
   await form.getByLabel('Target date',{exact:true}).fill('2027-04-01');await form.getByLabel('Description',{exact:true}).fill('synthetic-vector-1793 across teams');
   await capture(parentId?'initiative-create-child':'initiative-create-root');
   const created=page.waitForResponse(r=>r.request().method()==='POST'&&new URL(r.url()).pathname==='/api/initiatives');await form.getByRole('button',{name:'Create initiative',exact:true}).click();assert.equal((await created).status(),201);const node=await(await created).json();
   await page.getByRole('heading',{name,exact:true,level:1}).waitFor();return node;
  };
  const root=await create('synthetic-vector-1794-'+width),child=await create('synthetic-vector-1795-'+width,root.id);
  await page.getByText('Choose projects',{exact:true}).click();
  for(const project of projects)await page.getByRole('checkbox',{name:project.name,exact:true}).check();
  await capture('initiative-project-editor');
  const linked=page.waitForResponse(r=>r.request().method()==='PUT'&&new URL(r.url()).pathname==='/api/initiatives/'+child.id+'/projects');
  await page.getByRole('button',{name:'Save initiative projects',exact:true}).click();assert.equal((await linked).status(),200);
  const third=await call('/initiatives','POST',{name:'synthetic-vector-1796-'+width,parentId:child.id,ownerOperatorId:owner},201);
  await call('/initiatives','POST',{name:'synthetic-vector-1797-'+width,parentId:third.id,ownerOperatorId:owner},400);
  await call('/initiatives/'+root.id,'PATCH',{expectedVersion:root.version,parentId:third.id},400);
  await navigate(page,base+'/app/initiatives/'+root.id);
  const hierarchy=page.getByRole('region',{name:'Nested initiative projects',exact:true});
  await hierarchy.getByRole('region',{name:'Initiative '+third.name,exact:true}).waitFor();
  for(const project of projects)await hierarchy.getByRole('link',{name:project.name,exact:true}).waitFor();
  await hierarchy.getByText(team.name,{exact:false}).first().waitFor();await hierarchy.getByText(other.name,{exact:false}).first().waitFor();
  const subscribed=page.waitForResponse(r=>r.request().method()==='POST'&&new URL(r.url()).pathname==='/api/subscriptions');
  await page.getByRole('button',{name:'Subscribe to initiative',exact:true}).click();assert.equal((await subscribed).status(),201);await page.getByRole('button',{name:'Unsubscribe from initiative',exact:true}).waitFor();
  if(width===1440){await page.locator('header').getByText('Planned · Owner:',{exact:false}).waitFor();await capture('initiative-planned');}
  await capture('initiative-three-level-hierarchy');
  await navigate(page,base+'/app/settings#integrations');
  const panel=page.locator('.channel-settings');await panel.getByRole('heading',{name:'Slack and Discord channels',exact:true}).waitFor();
  await call('/settings/integrations/slack','POST',{botToken:'synthetic-vector-1820'});
  await page.reload();await panel.getByText('Slack connected to Delivery workspace',{exact:true}).waitFor();
  const binding=panel.getByRole('form',{name:'Bind notification channel',exact:true});
  // The offered events and their defaults follow the chosen object.
  const object=binding.getByRole('combobox').first(),chosen=()=>binding.locator('input[name="events"]').evaluateAll(inputs=>({values:inputs.map(input=>input.value).sort(),checked:inputs.filter(input=>input.checked).map(input=>input.value).sort()}));
  await object.selectOption('initiative:'+root.id);await binding.locator('input[name="events"][value="initiative.updated"]').waitFor();
  assert.deepEqual(await chosen(),{values:['initiative.created','initiative.projects_changed','initiative.updated'],checked:['initiative.updated']});
  for(const issueObject of ['team:'+team.id,'project:'+projects[0].id]){
   await object.selectOption(issueObject);await binding.locator('input[name="events"][value="triage.created"]').waitFor();const offered=await chosen();
   assert.ok(offered.values.length>0&&offered.values.every(value=>!value.startsWith('initiative.')),issueObject+' offers no initiative event');assert.deepEqual(offered.checked,['issue.created','issue.status_changed','triage.created']);
  }
  await object.selectOption('initiative:'+root.id);await binding.locator('input[name="events"][value="initiative.updated"]').waitFor();
  await binding.getByLabel('Channel service').selectOption('slack');
  await binding.getByLabel('Channel display name',{exact:true}).fill('initiative-direction-'+width);
  await binding.getByLabel('Slack channel ID').fill('CINITIATIVE'+width);
  await inspect(page,binding,'initiative-channel-choice-'+width);await page.setViewportSize({width,height:1000});
  const bound=page.waitForResponse(r=>r.request().method()==='POST'&&new URL(r.url()).pathname==='/api/settings/integrations/channels');
  await binding.getByRole('button',{name:'Save channel binding',exact:true}).click();assert.equal((await bound).status(),201);const destination=(await(await bound).json()).id;
  await panel.getByRole('button',{name:'Remove binding for '+root.name,exact:true}).waitFor();
  await inspect(page,binding,'initiative-channel-bound-'+width);await page.setViewportSize({width,height:1000});
  const config=await call('/settings/integrations/channels');assert.deepEqual(config.bindings.find(b=>b.id===destination).events,['initiative.updated']);
  await navigate(page,base+'/app/initiatives/'+root.id);
  const header=page.locator('main header');await header.locator('a[href="/app/settings#integrations"]').waitFor();await header.getByText('initiative-direction-'+width,{exact:false}).waitFor();
  await page.getByText('Edit initiative',{exact:true}).click();
  const edit=page.getByRole('form',{name:'Edit initiative',exact:true});await edit.getByLabel('Initiative status',{exact:true}).selectOption('active');
  const saved=page.waitForResponse(r=>r.request().method()==='PATCH'&&new URL(r.url()).pathname==='/api/initiatives/'+root.id);
  await edit.getByRole('button',{name:'Save initiative',exact:true}).click();assert.equal((await saved).status(),200);await page.locator('header').getByText('Active · Owner:',{exact:false}).waitFor();await capture('initiative-active');
  const cron=await runtime.req('/cdn-cgi/local/scheduled?cron='+encodeURIComponent('* * * * *'));assert.equal(cron.status,200);await cron.arrayBuffer();
  const replay=await runtime.req('/cdn-cgi/local/scheduled?cron='+encodeURIComponent('* * * * *'));assert.equal(replay.status,200);await replay.arrayBuffer();
  const posts=readFileSync(process.env.VECTOR_CHANNEL_EDGE,'utf8').trim().split('\n').filter(Boolean).map(JSON.parse).filter(c=>c.method==='chat.postMessage'&&c.body.channel==='CINITIATIVE'+width);
  assert.equal(posts.length,1,'one bound initiative update through the durable dispatcher');assert.ok(posts[0].body.text.includes(root.name));assert.ok(posts[0].body.text.includes(base+'/app/initiatives/'+root.id));assert.ok(!posts[0].body.text.includes('synthetic-vector-1793'));
  await call('/settings/integrations/channels/'+destination,'DELETE');
  if(!memberFixture){
   const email='synthetic-vector-1798@example.test';
   await call('/settings/operators/invite','POST',{displayName:'synthetic-vector-1798',email,role:'member'},202);
   const signed=await confirmLink(await readDevelopmentLink(base,null,email,runtime.state));assert.equal(signed.status,303);
   const headers={Cookie:signed.headers.get('set-cookie').split(';')[0],Origin:base,'Content-Type':'application/json'};
   const session=await(await runtime.req('/api/session',{headers})).json();
   memberFixture={headers,session};
  }else await call('/settings/operators/'+memberFixture.session.operatorId+'/role','PATCH',{role:'member',teamIds:[]});
  const {headers,session}=memberFixture;
  // INIT-001 scoped capability: an Owner approves an existing channel in Settings; the Member binds it on the initiative page.
  await call('/settings/integrations/channels/allowed','POST',{channelId:'CSCOPED'+width,channelName:'scoped-'+width},201);
  await navigate(page,base+'/app/settings#integrations');await panel.getByRole('heading',{name:'Slack and Discord channels',exact:true}).waitFor();
  const approval=panel.getByRole('form',{name:'Approve initiative channel',exact:true});
  await approval.getByLabel('Initiative to approve for',{exact:true}).selectOption(root.id);
  await approval.getByLabel('Existing channel',{exact:true}).selectOption('slack:CSCOPED'+width);
  await inspect(page,approval,'initiative-approval-choice-'+width);await page.setViewportSize({width,height:1000});
  const approved=page.waitForResponse(r=>r.request().method()==='POST'&&new URL(r.url()).pathname==='/api/settings/integrations/channels/initiative-approvals');
  await approval.getByRole('button',{name:'Approve channel for initiative',exact:true}).click();assert.equal((await approved).status(),201);
  await panel.getByRole('button',{name:'Withdraw approval for '+root.name+' #delivery',exact:true}).waitFor();
  await inspect(page,approval,'initiative-approval-saved-'+width);await page.setViewportSize({width,height:1000});
  // The Member's own confirmed session, in a browser of its own.
  const memberPage=await openAuthenticatedPage(page.context().browser(),headers.Cookie,base);
  try{
   trackRequests(memberPage);memberPage.on('pageerror',e=>errors.push(e.message));await memberPage.setViewportSize({width,height:1000});
   await navigate(memberPage,base+'/app/initiatives/'+root.id);await memberPage.getByRole('heading',{name:root.name,exact:true,level:1}).waitFor();
   await memberPage.getByText('Channel notifications',{exact:true}).click();
   const scoped=memberPage.getByRole('form',{name:'Initiative channel',exact:true});
   await scoped.getByLabel('Approved channel',{exact:true}).selectOption('slack:CSCOPED'+width);
   await scoped.getByRole('checkbox',{name:'Initiative update',exact:true}).check();
   await inspect(memberPage,scoped,'initiative-member-channel-choice-'+width);await memberPage.setViewportSize({width,height:1000});
   const bound=memberPage.waitForResponse(r=>r.request().method()==='PUT'&&new URL(r.url()).pathname==='/api/initiatives/'+root.id+'/channel-binding');
   await scoped.getByRole('button',{name:'Save initiative channel',exact:true}).click();assert.equal((await bound).status(),200);
   await scoped.getByRole('button',{name:'Withdraw initiative channel',exact:true}).waitFor();
   await inspect(memberPage,scoped,'initiative-member-channel-saved-'+width);await memberPage.setViewportSize({width,height:1000});
   await memberPage.getByText('Edit initiative',{exact:true}).click();
   const memberEdit=memberPage.getByRole('form',{name:'Edit initiative',exact:true});await memberEdit.getByLabel('Initiative status',{exact:true}).selectOption('completed');
   const edited=memberPage.waitForResponse(r=>r.request().method()==='PATCH'&&new URL(r.url()).pathname==='/api/initiatives/'+root.id);
   await memberEdit.getByRole('button',{name:'Save initiative',exact:true}).click();assert.equal((await edited).status(),200);
   await memberPage.locator('header').getByText('Completed · Owner:',{exact:false}).waitFor();await settleReads(memberPage);
  }finally{await memberPage.context().close();}
  for(const tick of [1,2]){const scheduled=await runtime.req('/cdn-cgi/local/scheduled?cron='+encodeURIComponent('* * * * *'));assert.equal(scheduled.status,200,'dispatch '+tick);await scheduled.arrayBuffer();}
  const scopedPosts=readFileSync(process.env.VECTOR_CHANNEL_EDGE,'utf8').trim().split('\n').filter(Boolean).map(JSON.parse).filter(c=>c.method==='chat.postMessage'&&c.body.channel==='CSCOPED'+width);
  assert.equal(scopedPosts.length,1,'one post through the Member’s scoped binding; replay adds none');
  assert.equal(scopedPosts[0].body.text,root.name+'\nsynthetic-vector-1798: Initiative updated · Status: active → completed\n'+base+'/app/initiatives/'+root.id);
  const tokenResponse=await runtime.req('/api/settings/integrations/tokens',{method:'POST',headers,body:JSON.stringify({name:'synthetic-vector-1799',scopes:['initiatives:read','initiatives:write']})});assert.equal(tokenResponse.status,201);const {token}=await tokenResponse.json();
  const added=await runtime.req('/api/issues',{method:'POST',headers,body:JSON.stringify({teamId:other.id,projectId:projects[1].id,title:'synthetic-vector-1800-'+width})});assert.equal(added.status,201);const issue=await added.json();
  const notices=(await call('/notifications?limit=50')).items.filter(n=>n.identifier===issue.identifier);assert.equal(notices.length,1);assert.equal((await call('/notifications?limit=50')).items.filter(n=>n.identifier===issue.identifier).length,1);
  await call('/settings/operators/'+session.operatorId+'/role','PATCH',{role:'guest',teamIds:[team.id]});
  const denied=await runtime.req('/api/initiatives',{method:'POST',headers,body:JSON.stringify({name:'Guest initiative',ownerOperatorId:session.operatorId})});assert.equal(denied.status,403);await denied.body.cancel();
  const deniedApi=await runtime.req('/api/v1/initiatives',{method:'POST',headers:{Origin:base,Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({name:'Guest initiative',ownerOperatorId:session.operatorId})});assert.equal(deniedApi.status,403);await deniedApi.body.cancel();
  const deniedPage=await runtime.req('/app/initiatives/'+root.id,{headers});assert.equal(deniedPage.status,403);await deniedPage.body.cancel();
  await settleReads(page);
 }
 assert.deepEqual(errors,[],'initiative screens have no hydration or browser errors');
 }finally{await settleReads(page);await page.close();}
}
