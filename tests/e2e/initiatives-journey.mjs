import {appendFileSync,mkdtempSync,readFileSync} from 'node:fs';
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
function recordChannelEvidence(row){
 if(process.env.VECTOR_REASON_EVIDENCE)appendFileSync(process.env.VECTOR_REASON_EVIDENCE,JSON.stringify(row)+'\n');
}
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
   const email='synthetic-vector-1798'+String.fromCharCode(64)+'example.test';
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
  await scopedChannelReasons({page,runtime,call,root,width,headers,session,projects});
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

/** Read the actual server state before comparing each role's rendered reasons. */
async function scopedChannelReasons({page,runtime,call,root,width,headers,session,projects}){
 const door='/initiatives/'+root.id+'/channel-binding',base=runtime.base;
 const member=async(path,method='GET',body)=>{const response=await runtime.req('/api'+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});assert.equal(response.status,200);return response.json();};
 const reader=await openAuthenticatedPage(page.context().browser(),headers.Cookie,base);let observer,admin,adminRead;
 const identities=new Set(['CSCOPED'+width,'TSYNTHETICB','TSYNTHETIC33001']);
 const configuration=()=>call('/settings/integrations/channels');
 const posts=()=>readFileSync(process.env.VECTOR_CHANNEL_EDGE,'utf8').trim().split('\n').filter(Boolean).map(JSON.parse).filter(c=>(c.method==='chat.postMessage'&&c.body.text.includes(root.name))||(c.method==='discord'&&c.body.content.includes(root.name)));
 const dispatch=async()=>{for(const tick of [1,2]){const response=await runtime.req('/cdn-cgi/local/scheduled?cron='+encodeURIComponent('* * * * *'));assert.equal(response.status,200,'scoped dispatch '+tick);await response.arrayBuffer();}};
 const openPanel=async(target)=>{await navigate(target,base+'/app/initiatives/'+root.id);await target.getByText('Channel notifications',{exact:true}).click();const form=target.getByRole('form',{name:'Initiative channel',exact:true});await form.waitFor();await settleReads(target);return form;};
 const openSettings=async(target=page)=>{await navigate(target,base+'/app/settings#integrations');const settings=target.locator('.channel-settings');await settings.getByRole('heading',{name:'Slack and Discord channels',exact:true}).waitFor();await settleReads(target);return settings;};
 const concealed=async(region)=>{
  const shown=await region.evaluate(element=>element.textContent+' '+[...element.querySelectorAll('[title],[aria-label],[data-tooltip]')].map(node=>[node.getAttribute('title'),node.getAttribute('aria-label'),node.getAttribute('data-tooltip')].join(' ')).join(' '));
  for(const id of identities)assert.equal(shown.includes(id),false,'technical channel identity is not displayed');
 };
 const reasonText=async(region,code)=>code==='live'?'':(await region.locator('[data-not-posting="'+code+'"]').innerText()).trim();
 const holdUpdate=async(code)=>{const current=await call('/initiatives/'+root.id);const before=posts().length;await call('/initiatives/'+root.id,'PATCH',{expectedVersion:current.version,description:'synthetic-vector-held-'+code+'-'+width});await dispatch();assert.equal(posts().length,before,'an unusable channel sends no update');recordChannelEvidence({kind:'channel-held',scenarioWidth:width,state:code,postsBefore:before,postsAfter:posts().length});};
 const render=async(code,{viewer=reader,read=member,sourceAvailable}={})=>{
  const memberState=await read(door),ownerState=await call(door),adminState=await adminRead(door),config=await configuration();
  const binding=config.bindings.find(b=>b.id===ownerState.binding.id),approval=config.approvals.find(a=>a.initiativeId===root.id&&a.provider===binding.provider&&a.channelId===binding.channelId);
  assert.ok(binding);identities.add(binding.id);if(approval)identities.add(approval.id);
  for(const state of [memberState,ownerState,adminState]){assert.equal(state.binding.live,code==='live');assert.equal(state.binding.notPosting?.code??'live',code);}
  assert.equal(memberState.canManage,false);assert.equal(ownerState.canManage,true);assert.equal(adminState.canManage,true);
  assert.deepEqual(memberState.binding.notPosting,ownerState.binding.notPosting);assert.deepEqual(adminState.binding.notPosting,ownerState.binding.notPosting);
  assert.deepEqual(binding.notPosting,ownerState.binding.notPosting);
  if(approval)assert.equal(approval.notPosting?.code??'live',code);
  if(sourceAvailable!==undefined){assert.equal(binding.notPosting.sourceAvailable,sourceAvailable);assert.equal(approval.usable,false);}
  const server={live:Number(ownerState.binding.live),code,approvalPresent:Number(Boolean(approval)),approvalUsable:approval?Number(approval.usable):'',sourceAvailable:binding.notPosting?.sourceAvailable===undefined?'':Number(binding.notPosting.sourceAvailable),currentWorkspace:binding.notPosting?.currentWorkspace??'',binderName:binding.notPosting?.binderName??'',destinations:memberState.destinations.length,provider:binding.provider,channel:binding.channelName};
  const surfaces=new Map();
  for(const [role,target] of [['member',viewer],['owner',page],['admin',admin]]){
   const form=await openPanel(target),rows=[];
   await form.locator('[data-channel-state="'+code+'"]').waitFor();
   if(code==='approved_again')assert.equal(await form.getByLabel('Approved channel',{exact:true}).inputValue(),binding.provider+':'+binding.channelId);
   for(const viewport of [1440,390,320]){
    await target.setViewportSize({width:viewport,height:1000});await form.scrollIntoViewIfNeeded();
    assert.ok(await target.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'initiative channel fits viewport');await concealed(form);
    const text=await reasonText(form,code),header=role!=='member'?target.locator('main header'):null;
    if(header){await header.locator('[data-channel-state="'+code+'"]').waitFor();await concealed(header);if(code!=='live')assert.equal(await reasonText(header,code),text);}
    rows.push({kind:'channel-reason',scenarioWidth:width,width:viewport,role,...server,panel:await form.locator('[data-channel-state]').innerText(),reason:text,header:header?await header.locator('[data-channel-state]').innerText():''});
   }
   surfaces.set(role,rows);
  }
  for(const [manager,target] of [['owner',page],['admin',admin]]){
   const settings=await openSettings(target),bindingRow=settings.locator('[data-binding-id="'+binding.id+'"]'),approvalRow=approval?settings.locator('[data-approval-id="'+approval.id+'"]'):null;
   await bindingRow.waitFor();
   for(const viewport of [1440,390,320]){
    await target.setViewportSize({width:viewport,height:1000});await bindingRow.scrollIntoViewIfNeeded();
    assert.ok(await target.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'channel settings fits viewport');await concealed(bindingRow);if(approvalRow)await concealed(approvalRow);
    const managerRow=surfaces.get(manager).find(row=>row.width===viewport),memberRow=surfaces.get('member').find(row=>row.width===viewport),reason=await reasonText(bindingRow,code);
    if(code!=='live'){
     assert.equal(managerRow.reason,reason,'manager reason agrees across the public doors');
     if(approvalRow)assert.equal(await reasonText(approvalRow,code),reason,'approval reason agrees with the binding');
    }
    if(approvalRow)assert.equal(await approvalRow.getAttribute('data-usable'),String(approval.usable));
    const existing=settings.getByLabel('Existing channel',{exact:true});
    if(code==='slack_disconnected')assert.equal(await existing.locator('option[value^="slack:"]').count(),0);
    if(sourceAvailable===false){assert.equal(await existing.locator('option[value^="discord:"]').filter({hasText:binding.channelName}).count(),0);assert.equal(memberState.destinations.some(d=>d.provider===binding.provider&&d.channelId===binding.channelId),false);}
    const slackChoice=existing.locator('option[value="slack:CSCOPED'+width+'"]');if(await slackChoice.count())await existing.selectOption('slack:CSCOPED'+width);
    await concealed(settings.getByRole('form',{name:'Approve initiative channel',exact:true}));
    for(const row of manager==='owner'?[memberRow,managerRow]:[managerRow])recordChannelEvidence({...row,settingsBinding:await bindingRow.innerText(),settingsApproval:approvalRow?await approvalRow.innerText():'',settingsReason:reason});
   }
  }
  await page.setViewportSize({width,height:1000});await viewer.setViewportSize({width,height:1000});await admin.setViewportSize({width,height:1000});
  return ownerState;
 };
 const renderDisconnected=async()=>{
  const memberState=await member(door),ownerState=await call(door),adminState=await adminRead(door),config=await configuration();
  for(const state of [memberState,ownerState,adminState]){assert.equal(state.binding,null);assert.equal(state.destinations.some(d=>d.provider==='slack'),false);}
  assert.equal(config.slack.connected,false);const approval=config.approvals.find(a=>a.initiativeId===root.id&&a.provider==='slack');assert.ok(approval);assert.equal(approval.usable,false);assert.equal(approval.notPosting.code,'slack_disconnected');
  for(const [role,target] of [['member',reader],['owner',page],['admin',admin]]){
   const form=await openPanel(target),collected=[];await form.locator('[data-channel-state="unbound"]').waitFor();
   for(const viewport of [1440,390,320]){
    await target.setViewportSize({width:viewport,height:1000});await form.scrollIntoViewIfNeeded();await concealed(form);assert.ok(await target.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    const header=role==='member'?null:target.locator('main header [data-channel-state="unbound"]');if(header)await header.waitFor();
    collected.push({kind:'channel-reason',scenarioWidth:width,width:viewport,role,live:0,code:'slack_disconnected',bindingPresent:0,approvalPresent:1,approvalUsable:0,currentWorkspace:approval.notPosting.currentWorkspace??'',panel:await form.locator('[data-channel-state]').innerText(),header:header?await header.innerText():''});
   }
   const manager=role==='member'?page:target,settings=await openSettings(manager),row=settings.locator('[data-approval-id="'+approval.id+'"]');await row.locator('[data-not-posting="slack_disconnected"]').waitFor();
   assert.equal(await settings.getByLabel('Existing channel',{exact:true}).locator('option[value^="slack:"]').count(),0);
   for(const entry of collected){
    await manager.setViewportSize({width:entry.width,height:1000});await row.scrollIntoViewIfNeeded();await concealed(row);assert.ok(await manager.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    recordChannelEvidence({...entry,settingsApproval:await row.innerText(),settingsReason:await reasonText(row,'slack_disconnected'),settingsBinding:''});
   }
  }
  await page.setViewportSize({width,height:1000});await reader.setViewportSize({width,height:1000});
 };
 const saveMember=async(provider,channelId)=>{
  const form=await openPanel(reader);await form.getByLabel('Approved channel',{exact:true}).selectOption(provider+':'+channelId);
  const saved=reader.waitForResponse(r=>r.request().method()==='PUT'&&r.url().endsWith(door));await form.getByRole('button',{name:'Save initiative channel',exact:true}).click();assert.equal((await saved).status(),200);
  await form.locator('[data-channel-state="live"]').waitFor();await settleReads(reader);
 };
 const approveSource=async(source)=>{
  const settings=await openSettings(),form=settings.getByRole('form',{name:'Approve initiative channel',exact:true});
  await form.getByLabel('Initiative to approve for',{exact:true}).selectOption(root.id);await form.getByLabel('Existing channel',{exact:true}).selectOption('discord:'+source.id);
  const approved=page.waitForResponse(r=>r.request().method()==='POST'&&r.url().endsWith('/channels/initiative-approvals'));
  await form.getByRole('button',{name:'Approve channel for initiative',exact:true}).click();const response=await approved;assert.equal(response.status(),201);assert.equal((await response.json()).changed,true);
  await page.locator('.initiative-approval-outcome').waitFor();await settleReads(page);
 };
 try{
  const adminEmail='synthetic-vector-1864-'+width+String.fromCharCode(64)+'vector.test';
  await call('/settings/operators/invite','POST',{displayName:'synthetic-vector-1864-'+width,email:adminEmail,role:'admin'},202);
  const adminSignIn=await confirmLink(await readDevelopmentLink(base,null,adminEmail,runtime.state)),adminCookie=adminSignIn.headers.get('set-cookie').split(';')[0];
  admin=await openAuthenticatedPage(page.context().browser(),adminCookie,base);
  adminRead=async(path)=>{const response=await runtime.req('/api'+path,{headers:{Cookie:adminCookie}});assert.equal(response.status,200);return response.json();};
  await render('live');
  const approval=(await configuration()).approvals.find(a=>a.initiativeId===root.id&&a.provider==='slack');
  await call('/settings/integrations/channels/initiative-approvals/'+approval.id,'DELETE');await render('approval_withdrawn');
  await call('/settings/integrations/channels/initiative-approvals','POST',{provider:'slack',initiativeId:root.id,channelId:'CSCOPED'+width,audience:'workspace'},201);await render('approved_again');
  await call('/settings/operators/'+session.operatorId+'/role','PATCH',{role:'viewer',teamIds:[]});
  const refused=await runtime.req('/api'+door,{headers});assert.equal(refused.status,403);await refused.body.cancel();
  const observerEmail='synthetic-vector-1862-'+width+String.fromCharCode(64)+'vector.test';
  await call('/settings/operators/invite','POST',{displayName:'synthetic-vector-1862-'+width,email:observerEmail,role:'member'},202);
  const observerSignIn=await confirmLink(await readDevelopmentLink(base,null,observerEmail,runtime.state)),observerCookie=observerSignIn.headers.get('set-cookie').split(';')[0];
  observer=await openAuthenticatedPage(page.context().browser(),observerCookie,base);
  const observerRead=async(path)=>{const response=await runtime.req('/api'+path,{headers:{Cookie:observerCookie}});assert.equal(response.status,200);return response.json();};
  await render('binder_cannot_edit',{viewer:observer,read:observerRead});
  await call('/settings/operators/'+session.operatorId+'/role','PATCH',{role:'member',teamIds:[]});await saveMember('slack','CSCOPED'+width);
  await call('/settings/integrations/slack','POST',{botToken:'synthetic-vector-1850'});await render('workspace_changed');
  // Disconnect while a different workspace is installed: disconnected must take precedence.
  const settings=page.locator('.channel-settings'),removed=page.waitForResponse(r=>r.request().method()==='DELETE'&&r.url().endsWith('/integrations/slack'));
  await settings.getByRole('button',{name:'Remove Slack connection',exact:true}).click();assert.equal((await removed).status(),200);await settleReads(page);
  await renderDisconnected();await holdUpdate('slack_disconnected');
  const credentials=settings.getByRole('form',{name:'Slack credential',exact:true,includeHidden:true});await credentials.locator('xpath=ancestor::details').locator('summary').click();
  await credentials.getByLabel('Slack bot token',{exact:true}).fill('synthetic-vector-1820');
  const connected=page.waitForResponse(r=>r.request().method()==='POST'&&r.url().endsWith('/integrations/slack'));await credentials.getByRole('button',{name:'Validate and save Slack token',exact:true}).click();assert.equal((await connected).status(),200);await settleReads(page);await saveMember('slack','CSCOPED'+width);await render('live');
  const channelId='7300000000000'+width,sourceName='synthetic-vector-1860-'+width;
  identities.add(channelId);
  let source=await call('/settings/integrations/channels','POST',{scope:'project',objectId:projects[2].id,provider:'discord',channelName:sourceName,webhookUrl:'https://discord.com/api/webhooks/'+channelId+'/synthetic-vector-1861',events:['issue.created']},201);identities.add(source.id);
  await approveSource(source);
  // Keep the existing immediate header refresh proof for an Owner save.
  let form=await openPanel(page);await form.getByLabel('Approved channel',{exact:true}).selectOption('discord:'+channelId);
  let saved=page.waitForResponse(r=>r.request().method()==='PUT'&&r.url().endsWith(door));await form.getByRole('button',{name:'Save initiative channel',exact:true}).click();assert.equal((await saved).status(),200);
  await page.locator('main header [data-channel-state="live"]').filter({hasText:sourceName}).waitFor();
  await saveMember('discord',channelId);await render('live');
  const staleApproval=(await configuration()).approvals.find(a=>a.initiativeId===root.id&&a.provider==='discord');
  // Rebinding the same source object creates a new identity even with the same display name.
  const rebind=page.locator('.channel-settings').getByRole('form',{name:'Bind notification channel',exact:true});
  await rebind.getByLabel('Team, project, saved view or initiative').selectOption('project:'+projects[2].id);await rebind.getByLabel('Channel service').selectOption('discord');await rebind.getByLabel('Channel display name').fill(sourceName);await rebind.getByLabel('Discord webhook URL').fill('https://discord.com/api/webhooks/'+channelId+'/synthetic-vector-1863');
  const rebound=page.waitForResponse(r=>r.request().method()==='POST'&&r.url().endsWith('/integrations/channels'));await rebind.getByRole('button',{name:'Save channel binding',exact:true}).click();const reboundResponse=await rebound;assert.equal(reboundResponse.status(),201);source=await reboundResponse.json();identities.add(source.id);await settleReads(page);
  await render('source_changed',{sourceAvailable:true});
  const options=page.locator('.channel-settings').getByLabel('Existing channel',{exact:true});assert.equal(await options.locator('option[value="discord:'+source.id+'"]').count(),1);
  const beforeRepair=posts().length;await holdUpdate('source_changed');
  await approveSource(source);
  const freshApproval=(await configuration()).approvals.find(a=>a.initiativeId===root.id&&a.provider==='discord');assert.notEqual(freshApproval.id,staleApproval.id);assert.equal(freshApproval.usable,true);
  await render('approved_again');await saveMember('discord',channelId);await render('live');
  form=await openPanel(reader);await reader.getByText('Edit initiative',{exact:true}).click();const edit=reader.getByRole('form',{name:'Edit initiative',exact:true});await edit.getByLabel('Initiative status',{exact:true}).selectOption('active');
  saved=reader.waitForResponse(r=>r.request().method()==='PATCH'&&new URL(r.url()).pathname==='/api/initiatives/'+root.id);await edit.getByRole('button',{name:'Save initiative',exact:true}).click();assert.equal((await saved).status(),200);await settleReads(reader);
  await dispatch();const delivered=posts().slice(beforeRepair);assert.equal(delivered.length,1,'explicit Member save resumes exactly one future post');assert.equal(delivered[0].method,'discord');
  recordChannelEvidence({kind:'channel-delivery',scenarioWidth:width,state:'repaired',postsBefore:beforeRepair,postsAfter:posts().length,newPosts:delivered.length,provider:delivered[0].method});
  await call('/settings/integrations/channels/initiative-approvals/'+freshApproval.id,'DELETE');await render('approval_withdrawn');await holdUpdate('discord_withdrawn');
  await approveSource(source);await render('approved_again');await holdUpdate('discord_approved_again');
  await call('/settings/operators/'+session.operatorId+'/role','PATCH',{role:'viewer',teamIds:[]});await render('binder_cannot_edit',{viewer:observer,read:observerRead});await holdUpdate('discord_binder_demoted');
  await call('/settings/operators/'+session.operatorId+'/role','PATCH',{role:'member',teamIds:[]});await saveMember('discord',channelId);await render('live');
  await openSettings();const removedSource=page.waitForResponse(r=>r.request().method()==='DELETE'&&r.url().endsWith('/channels/'+source.id));await settings.locator('[data-binding-id="'+source.id+'"]').getByRole('button').click();assert.equal((await removedSource).status(),200);await settleReads(page);
  await render('source_changed',{sourceAvailable:false});await holdUpdate('source_removed');
  form=await openPanel(page);const withdrawn=page.waitForResponse(r=>r.request().method()==='DELETE'&&r.url().endsWith(door));await form.getByRole('button',{name:'Withdraw initiative channel',exact:true}).click();assert.equal((await withdrawn).status(),200);
  await page.waitForFunction(name=>!document.querySelector('main header')?.textContent.includes(name),sourceName);assert.equal((await call(door)).binding,null);
  recordChannelEvidence({kind:'channel-withdrawn',scenarioWidth:width,panel:await form.locator('p').first().innerText(),header:await page.locator('main header').innerText(),bindingPresent:0});
 }finally{await admin?.context().close();await observer?.context().close();await reader.context().close();}
}
