import assert from 'node:assert/strict';
import { beforePrivateNavigation, settleReads } from './collaboration-navigation.mjs';

const hydrationProblem = /hydrat|did not match|Minified React error #(418|423|425)/i;

/** PROJ-015 project-page door. The Owner and the Member lead operate the real
 * controls; the scoped API, both endpoint activities and the lead Inbox read the
 * same independent graph. HTTP creates fixtures and reads stored outcomes. */
export async function projectDependenciesJourney({page,memberPage,memberContext,base,api,capture,memberId,team}) {
  // The shared runtime already fails on any Owner page error. The Member page
  // gets the same strict boundary here, with only the deliberate cycle 400.
  const problems=[],expected=new Set();
  const pageError=error=>problems.push(error.message);
  const consoleError=message=>{
    const url=message.location().url;
    if(expected.has(url)&&/status of 400/.test(message.text())){expected.delete(url);return;}
    if(message.type()==='error'||hydrationProblem.test(message.text()))problems.push(message.text()+' at '+url);
  };
  memberPage.on('pageerror',pageError);
  memberPage.on('console',consoleError);
  try {
    await dependencyFlow({page,memberPage,memberContext,base,api,capture,memberId,team,expected});
    assert.deepEqual(problems,[],'no Member page, console or hydration errors');
    assert.equal(expected.size,0,'the deliberate cycle refusal reached the browser');
  } finally {
    memberPage.off('pageerror',pageError);
    memberPage.off('console',consoleError);
  }
}

const controls=current=>{
  const region=current.getByRole('region',{name:'Project dependencies',exact:true});
  return {
    region,
    summary:region.locator('summary'),
    ready:region.locator('summary:not([aria-disabled])'),
    relationship:region.getByLabel('Relationship',{exact:true}),
    project:region.getByLabel('Project',{exact:true}),
    submit:region.locator('form button[type="submit"]'),
    links:region.locator('.project-dependencies__list a'),
  };
};
const focused=locator=>locator.evaluate(element=>element===document.activeElement);

async function dependencyFlow({page,memberPage,memberContext,base,api,capture,memberId,team,expected}) {
  for(const current of [page,memberPage])await current.setViewportSize({width:1440,height:1000});
  const actor=await api('/session'),suffix=Date.now();
  const create=async(n,leadOperatorId)=>{
    const name=`synthetic-vector-${n}-${suffix}`;
    const state=await api('/settings/projects','POST',{name,leadOperatorId});
    const project=state.projects.find(row=>row.name===name);
    await api('/issues','POST',{teamId:team.id,projectId:project.id,title:`synthetic-vector-${n+10}-${suffix}`});
    return project;
  };
  const a=await create(1531,actor.operatorId),b=await create(1532,memberId);
  const detail=id=>api('/projects/'+id);
  const changes=async(id,kind)=>(await detail(id)).activity.filter(entry=>entry.kind===kind);
  const notices=async current=>{
    const response=await current.get(base+'/api/notifications?limit=50');
    assert.equal(response.status(),200);
    return (await response.json()).items.filter(item=>item.projectId===b.id);
  };
  const ownerNotices=async()=>(await api('/notifications?limit=50')).items.filter(item=>item.projectId===b.id);
  const open=async(current,project)=>{
    await beforePrivateNavigation(current,base+'/app/projects/'+project.id);
    await current.goto(base+'/app/projects/'+project.id);
    await current.getByRole('heading',{name:project.name,exact:true}).waitFor();
    const ui=controls(current);
    await ui.ready.waitFor();
    return ui;
  };
  const reload=async(current,project)=>{
    await beforePrivateNavigation(current,current.url());
    await current.reload();
    await current.getByRole('heading',{name:project.name,exact:true}).waitFor();
    const ui=controls(current);
    await ui.ready.waitFor();
    return ui;
  };
  const latestActivity=current=>current.getByRole('heading',{name:'Project activity',exact:true}).locator('xpath=..').locator('li').first();
  const inspect=async(current,label)=>{
    await settleReads(current);
    for(const width of [1440,390]) {
      await current.setViewportSize({width,height:1000});
      assert.ok(await current.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),label+' has no horizontal overflow at '+width);
      const smallest=await controls(current).region.evaluate(region=>Math.min(...[...region.querySelectorAll('*')]
        .filter(node=>[...node.childNodes].some(child=>child.nodeType===3&&child.textContent.trim()))
        .map(node=>parseFloat(getComputedStyle(node).fontSize))));
      assert.ok(smallest>=13,label+' text is at least 13px at '+width);
      await capture('PROJ-015',label+'-'+width,current);
    }
    await current.setViewportSize({width:1440,height:1000});
  };

  // The Owner sets B blocked by A with the keyboard on B's hydrated page.
  let owner=await open(page,b);
  assert.equal(await owner.links.count(),0);
  await owner.summary.focus();
  await page.keyboard.press('Enter');
  await owner.relationship.waitFor();
  await page.keyboard.press('Tab');
  assert.ok(await focused(owner.relationship),'Tab reaches the relationship choice');
  assert.equal(await owner.relationship.inputValue(),'blocked-by');
  await page.keyboard.press('Tab');
  assert.ok(await focused(owner.project),'Tab reaches the project choice');
  assert.equal(await owner.project.locator('option',{hasText:b.name}).count(),0,'a project is never offered as its own blocker');
  await owner.project.selectOption({label:a.name});
  await page.keyboard.press('Tab');
  assert.ok(await focused(owner.submit),'Tab reaches the add action');
  const added=page.waitForResponse(r=>r.url()===`${base}/api/projects/${b.id}/dependencies/${a.id}`&&r.request().method()==='PUT');
  await page.keyboard.press('Enter');
  assert.equal((await added).status(),200);
  await owner.region.getByRole('button',{name:'Remove blocker '+a.name,exact:true}).waitFor();
  const receipt=await owner.region.getByRole('status').innerText();
  assert.ok(receipt.includes(a.name)&&receipt.includes(b.name),'the receipt names both endpoints');
  assert.ok(await focused(owner.summary),'focus returns to the add disclosure');
  assert.ok(await owner.summary.evaluate(node=>getComputedStyle(node).outlineStyle!=='none'),'keyboard focus is visible');
  const graph=(await detail(b.id)).directDependencies;
  assert.equal(graph.blockedBy.length,1);
  const edge=graph.blockedBy[0];
  assert.deepEqual(edge.project,{id:a.id,name:a.name});
  assert.deepEqual((await detail(a.id)).directDependencies.blocking,[{id:edge.id,project:{id:b.id,name:b.name}}]);
  for(const endpoint of [a,b])assert.equal((await changes(endpoint.id,'project.dependency_added')).length,1,'one activity entry on each endpoint');
  const ownerName=(await changes(b.id,'project.dependency_added'))[0].actorName;
  assert.ok(ownerName);
  await owner.summary.click();
  await owner.project.waitFor();
  await inspect(page,'project-dependency-blocked-by');
  await owner.summary.click();

  // The linked project opens through hydrated navigation and shows the reverse edge.
  const timeOrigin=await page.evaluate(()=>performance.timeOrigin);
  await settleReads(page);
  await owner.region.getByRole('link',{name:a.name,exact:true}).click();
  await page.getByRole('heading',{name:a.name,exact:true}).waitFor();
  owner=controls(page);
  await owner.region.getByRole('button',{name:'Remove blocked project '+b.name,exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>performance.timeOrigin),timeOrigin,'project links navigate without a document reload');
  owner=await reload(page,a);
  await owner.region.getByRole('link',{name:b.name,exact:true}).waitFor();
  const reverse=await latestActivity(page).innerText();
  assert.ok(reverse.includes(b.name)&&reverse.includes(ownerName),'the blocking endpoint shows the attributed activity');
  await inspect(page,'project-dependency-blocking');
  owner=await open(page,b);
  await owner.region.getByRole('button',{name:'Remove blocker '+a.name,exact:true}).waitFor();
  const forward=await latestActivity(page).innerText();
  assert.ok(forward.includes(a.name)&&forward.includes(ownerName),'the blocked endpoint shows the attributed activity');

  // The scoped API uses the same graph: replay is a no-op and cycles are refused.
  const edgePath=`/projects/${b.id}/dependencies/${a.id}`;
  const before=(await detail(b.id)).activity.length;
  assert.equal((await api(edgePath,'PUT')).activity.length,before,'a replayed set changes nothing');
  const minted=await api('/settings/integrations/tokens','POST',{name:'synthetic-vector-1533',scopes:['projects:read','projects:write']});
  const scoped=async(path,method)=>{
    const response=await page.request.fetch(base+'/api/v1'+path,{method,headers:{Authorization:'Bearer '+minted.token,Origin:base}});
    return {status:response.status(),body:await response.json()};
  };
  assert.equal((await scoped(`/projects/${a.id}/dependencies/${b.id}`,'PUT')).status,400);
  assert.equal((await scoped(`/projects/${a.id}/dependencies/${a.id}`,'PUT')).status,400);
  assert.equal((await scoped(edgePath,'DELETE')).status,200);
  const apiAdded=await scoped(edgePath,'PUT');
  assert.equal(apiAdded.status,200);
  assert.equal(apiAdded.body.directDependencies.blockedBy.length,1);
  assert.equal(apiAdded.body.activity.filter(entry=>entry.kind==='project.dependency_added').length,2);
  let memberNotices=await notices(memberContext.request);
  assert.equal(memberNotices.length,3,'each actual change notifies the current non-acting lead once');
  assert(memberNotices.every(item=>item.identifier==='Project'&&item.title===b.name&&item.causes.includes('blocking')));
  assert.equal((await ownerNotices()).length,0,'the acting lead is excluded');

  // The Member lead opens the genuine project notice from Inbox.
  await beforePrivateNavigation(memberPage,base+'/app/inbox');
  await memberPage.goto(base+'/app/inbox');
  const row=memberPage.locator('.inbox-row').filter({hasText:b.name}).first();
  await row.waitFor();
  await settleReads(memberPage);
  for(const width of [1440,390]) {
    await memberPage.setViewportSize({width,height:1000});
    assert.ok(await memberPage.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Inbox has no horizontal overflow at '+width);
    await capture('PROJ-015','project-dependency-inbox-'+width,memberPage);
  }
  await memberPage.setViewportSize({width:1440,height:1000});
  await row.click();
  await memberPage.waitForURL(base+'/app/projects/'+b.id);
  await memberPage.getByRole('heading',{name:b.name,exact:true}).waitFor();
  let member=controls(memberPage);
  await member.ready.waitFor();
  await member.region.getByRole('link',{name:a.name,exact:true}).waitFor();

  // The reverse edge is a readable refusal that changes nothing.
  const stored=await detail(b.id),unchangedA=await detail(a.id);
  await member.summary.click();
  await member.relationship.selectOption('blocking');
  await member.project.selectOption({label:a.name});
  const cycleUrl=`${base}/api/projects/${a.id}/dependencies/${b.id}`;
  expected.add(cycleUrl);
  const refused=memberPage.waitForResponse(r=>r.url()===cycleUrl&&r.request().method()==='PUT');
  await member.submit.click();
  assert.equal((await refused).status(),400);
  const refusal=member.region.getByRole('alert');
  await refusal.waitFor();
  assert.ok((await refusal.innerText()).trim().length>0);
  await expectNoChange(detail,stored,unchangedA);
  assert.equal((await notices(memberContext.request)).length,3);
  await capture('PROJ-015','project-dependency-cycle-refused-1440',memberPage);
  await member.summary.click();

  // The Member removes the edge with the keyboard; the tooltip names the icon action.
  const remove=member.region.getByRole('button',{name:'Remove blocker '+a.name,exact:true});
  await remove.focus();
  const tooltip=memberPage.getByRole('tooltip');
  await tooltip.waitFor();
  assert.equal(await remove.getAttribute('aria-describedby'),await tooltip.getAttribute('id'));
  assert.ok(await tooltip.evaluate(node=>{const box=node.getBoundingClientRect();return box.left>=0&&box.right<=innerWidth&&parseFloat(getComputedStyle(node).fontSize)>=13;}));
  await capture('PROJ-015','project-dependency-remove-tooltip-1440',memberPage);
  const removed=memberPage.waitForResponse(r=>r.url()===`${base}${'/api'+edgePath}`&&r.request().method()==='DELETE');
  await memberPage.keyboard.press('Enter');
  assert.equal((await removed).status(),200);
  await member.region.getByRole('status').waitFor();
  await member.links.first().waitFor({state:'detached'});
  assert.ok(await focused(member.summary),'focus returns to the add disclosure after removal');
  member=await reload(memberPage,b);
  assert.equal(await member.links.count(),0);
  const removal=await latestActivity(memberPage).innerText();
  const memberName=(await changes(b.id,'project.dependency_removed')).at(0).actorName;
  assert.ok(removal.includes(a.name)&&removal.includes(memberName),'the blocked endpoint shows the attributed removal');
  owner=await open(page,a);
  assert.equal(await owner.links.count(),0);
  const reverseRemoval=await latestActivity(page).innerText();
  assert.ok(reverseRemoval.includes(b.name)&&reverseRemoval.includes(memberName),'the blocking endpoint shows the attributed removal');
  memberNotices=await notices(memberContext.request);
  assert.equal(memberNotices.length,3,'the acting Member receives no notice');
  assert.equal((await ownerNotices()).length,1,'the other current lead receives the removal once');
  for(const id of [a.id,b.id]) {
    const graph=(await detail(id)).directDependencies;
    assert.deepEqual(graph,{blockedBy:[],blocking:[]});
  }
  for(const current of [page,memberPage]) {
    await beforePrivateNavigation(current,base+'/');
    await current.goto(base+'/');
  }
  console.log('[PROJ-015] project-page controls set, show, refuse and remove direct project edges with attributed endpoint activity and lead Inbox notices');
}

async function expectNoChange(detail,b,a) {
  const [currentB,currentA]=await Promise.all([detail(b.id),detail(a.id)]);
  assert.deepEqual(currentB.directDependencies,b.directDependencies);
  assert.deepEqual(currentA.directDependencies,a.directDependencies);
  assert.equal(currentB.activity.length,b.activity.length);
  assert.equal(currentA.activity.length,a.activity.length);
}
