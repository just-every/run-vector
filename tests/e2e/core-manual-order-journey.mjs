import { withOperatorClient } from './operator-request.mjs';
import assert from 'node:assert/strict';
import { beforePrivateNavigation } from './collaboration-navigation.mjs';
export async function manualOrderJourney(page, context, base, record=async()=>{}) {
  async function api(path,method='GET',data) {
    return withOperatorClient(context, async client => {
      const r=await client.fetch(base+'/api'+path,{method,headers:{Origin:base},...(data===undefined?{}:{data})});
      assert(r.ok(),`${method} ${path}: ${r.status()}`);return await r.json();
    });
  }
  const suffix=String(Date.now()), prefix='MR'+suffix.slice(-6).replaceAll(/\d/g,d=>String.fromCharCode(65+Number(d)));
  const state=await api('/settings/teams','POST',{name:'Delivery planning '+suffix.slice(-4),identifierPrefix:prefix}),team=state.teams.find(t=>t.identifierPrefix===prefix);
  const create=title=>api('/issues','POST',{title,teamId:team.id});
  const issues=[await create('Recover checkout retries'),await create('Explain failed card authentication'),await create('Keep mobile payment state')];
  await api('/issues','POST',{title:'Investigate provider latency',teamId:team.id,statusId:team.statuses.find(s=>s.category==='started').id,priority:'high'});
  const currentOrder=async()=>Object.fromEntries(Object.entries((await api('/current')).sections).map(([section,items])=>[section,items.map(i=>i.identifier)]));
  const current=await currentOrder();
  const listPath='/app/issues?team='+team.id+'&sort=manual';
  const visible=()=>page.locator('.issues-row[data-issue-identifier]').evaluateAll(nodes=>nodes.map(n=>n.dataset.issueIdentifier));
  let expected=[...issues.map(i=>i.identifier)];
  const check=async order=>{await page.waitForFunction(order=>JSON.stringify([...document.querySelectorAll('.issues-row[data-issue-identifier]')].map(n=>n.dataset.issueIdentifier))===JSON.stringify(order),order);assert.deepEqual(await visible(),order)};
  // Filter to backlog so the independent Started work remains a Current witness.
  const backlog=listPath+'&category=backlog';
  for(const width of [1440,390]) {
    await page.setViewportSize({width,height:1000});await beforePrivateNavigation(page,base+backlog);await page.goto(base+backlog);
    expected=(await api('/issues?team='+team.id+'&sort=manual&category=backlog')).issues.map(i=>i.identifier);await check(expected);
    await page.waitForFunction(identifier=>{const button=document.querySelector('[aria-label="Move '+identifier+' to top"]');return button&&!button.disabled;},expected[0]);
    const first=expected[0],second=expected[1];
    const row=page.locator('#issue-row-'+first);await row.focus();
    const moved=page.waitForResponse(r=>r.url()===base+'/api/issues/order'&&r.request().method()==='POST');
    await row.press('Alt+ArrowDown');assert.equal((await moved).status(),200);
    expected=[second,first,expected[2]];await check(expected);
    await page.getByRole('button',{name:'Move '+expected[2]+' to top',exact:true}).click();expected=[expected[2],expected[0],expected[1]];await check(expected);
    await page.getByRole('group',{name:'Order '+expected[2],exact:true}).dragTo(page.getByRole('group',{name:'Order '+expected[0],exact:true}));
    expected=[expected[2],expected[0],expected[1]];await check(expected);
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await page.locator('#issue-row-'+expected[0]).scrollIntoViewIfNeeded();await record('VIEW-006',`list-${width}`,page);
    const other=await context.browser().newContext({storageState:await context.storageState(),viewport:{width,height:1000}});
    try {const p=await other.newPage();await p.goto(base+backlog);await p.waitForFunction(order=>JSON.stringify([...document.querySelectorAll('.issues-row[data-issue-identifier]')].map(n=>n.dataset.issueIdentifier))===JSON.stringify(order),expected);}finally{await other.close()}
    assert.deepEqual(await currentOrder(),current,'manual order leaves Current ranking unchanged');
    const view=await api('/views','POST',{name:'Payment backlog '+width+' '+suffix.slice(-4),isShared:true,query:{team:team.id,category:'backlog',sort:'manual'}});
    await beforePrivateNavigation(page,base+'/app/views/'+view.id);await page.goto(base+'/app/views/'+view.id);
    const natural=issues.map(i=>i.identifier);await check(natural);
    await page.getByRole('button',{name:'Move '+natural[2]+' to top',exact:true}).click();const saved=[natural[2],natural[0],natural[1]];await check(saved);
    await page.getByLabel('View layout',{exact:true}).selectOption('board');
    await page.getByRole('region',{name:'Workflow columns'}).waitFor();
    if(width===390)await page.getByLabel('Board column',{exact:true}).selectOption(team.statuses.find(s=>s.category==='backlog').id);
    const column=page.getByRole('region',{name:'Backlog column',exact:true});
    await column.waitFor();
    await page.waitForFunction(order=>JSON.stringify([...document.querySelectorAll('.board-card-open small')].map(n=>n.textContent))===JSON.stringify(order),saved);
    await page.getByRole('button',{name:'Move '+saved[2]+' up',exact:true}).click();const boardOrder=[saved[0],saved[2],saved[1]];
    await page.waitForFunction(order=>JSON.stringify([...document.querySelectorAll('.board-card-open small')].map(n=>n.textContent))===JSON.stringify(order),boardOrder);
    await column.scrollIntoViewIfNeeded();assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await record('VIEW-006',`board-${width}`,page);
    await page.getByLabel('View layout',{exact:true}).selectOption('list');await check(boardOrder);await page.locator('#issue-row-'+boardOrder[0]).scrollIntoViewIfNeeded();await record('VIEW-006',`saved-view-${width}`,page);
    await beforePrivateNavigation(page,base+backlog);await page.goto(base+backlog);await check(expected);
    assert.deepEqual(await currentOrder(),current);
  }
}
