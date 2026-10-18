import assert from 'node:assert/strict';
import { beforePrivateNavigation } from './collaboration-navigation.mjs';
export async function workloadJourney(page, context, base, record = async () => {}) {
  async function api(path, method='GET', data) {
    const response = await context.request.fetch(base+'/api'+path,{method,headers:{Origin:base},...(data===undefined?{}:{data})});
    assert(response.ok(),`${method} ${path}: ${response.status()}`); return response.json();
  }
  const state = await api('/settings/administration'), me = (await api('/session')).operatorId;
  const others = state.operators.filter(p=>p.id!==me).slice(0,2);
  assert.equal(others.length,2,'workload fixture has three genuine operators');
  const suffix=String(Date.now()), prefix='WL'+suffix.slice(-6).replaceAll(/\d/g,d=>String.fromCharCode(65+Number(d)));
  const next = await api('/settings/teams','POST',{name:'Payments delivery '+suffix.slice(-4),identifierPrefix:prefix});
  const team = next.teams.find(t=>t.identifierPrefix===prefix);
  await api('/settings','PATCH',{timezone:'UTC'});
  const local = d => new Date(Date.now()+d*86400000).toISOString().slice(0,16);
  const withCycle = await api('/settings/cycles','POST',{teamId:team.id,name:'Checkout reliability '+suffix.slice(-4),startsLocal:local(-1),endsLocal:local(7),capacity:30});
  const cycle = withCycle.cycles.find(c=>c.teamId===team.id);
  const due = new Date(Date.now()+3*86400000).toISOString().slice(0,10);
  for (const [title,assigneeOperatorId,estimate] of [
    ['Recover delayed payment confirmations',me,8],['Reconcile provider retry receipts',me,5],
    ['Protect the mobile checkout redirect',others[0].id,5],['Explain card authentication failures',others[1].id,3],
  ]) await api('/issues','POST',{teamId:team.id,title,assigneeOperatorId,estimate,cycleId:cycle.id,dueDate:due});
  const myName = state.operators.find(p=>p.id===me).name;
  for (const width of [1440,390]) {
    await page.setViewportSize({width,height:1000});
    await beforePrivateNavigation(page,base+'/app/cycles/'+cycle.id); await page.goto(base+'/app/cycles/'+cycle.id);
    const mine=page.getByRole('article',{name:'Workload for '+myName,exact:true});
    await mine.getByText('2 issues · 13 estimated points',{exact:true}).waitFor();
    for (const [person,points] of [[others[0],5],[others[1],3]]) await page.getByRole('article',{name:'Workload for '+person.name,exact:true}).getByText(`1 issue · ${points} estimated points`,{exact:true}).waitFor();
    const capacity=mine.getByLabel('My capacity in points'); await capacity.fill('10');
    const saved=page.waitForResponse(r=>r.url().includes('/api/workload?')&&r.request().method()==='PUT');
    await mine.getByRole('button',{name:'Save my capacity',exact:true}).click(); assert.equal((await saved).status(),200);
    await mine.getByText('Over capacity',{exact:true}).waitFor();
    await mine.getByText('Capacity: 10 points',{exact:false}).waitFor();
    await page.getByRole('heading',{name:'Workload',exact:true}).scrollIntoViewIfNeeded();
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'workload fits viewport');
    await record('REPORT-004',`cycle-${width}`,page);
    await mine.locator('summary').click(); await mine.getByRole('link',{name:/Recover delayed payment confirmations/}).waitFor();
    await record('REPORT-004',`assigned-${width}`,page);
    // A distinct browser session, signed in as the same operator, reads the persisted capacity.
    const second=await context.browser().newContext({storageState:await context.storageState(),viewport:{width,height:1000}});
    try {
      const other=await second.newPage(); await other.goto(base+'/app/cycles/'+cycle.id);
      await other.getByRole('article',{name:'Workload for '+myName,exact:true}).getByText('Over capacity',{exact:true}).waitFor();
    } finally { await second.close(); }
    const rangePath='/workload?from='+due+'&to='+due;
    const rangeMine=(await api(rangePath)).rows.find(r=>r.operatorId===me);
    await api(rangePath,'PUT',{capacity:null,expectedVersion:rangeMine.version});
    await page.getByLabel('Workload period',{exact:true}).selectOption('dates');
    const range=page.getByRole('form',{name:'Workload due-date range'});
    await range.getByLabel('Due from').fill(due); await range.getByLabel('Due through').fill(due);
    await range.getByRole('button',{name:'Show workload'}).click();
    await mine.getByText('Capacity not stated',{exact:false}).waitFor();
    await mine.getByLabel('My capacity in points').fill(String(rangeMine.points));
    await mine.getByRole('button',{name:'Save my capacity'}).click(); await mine.getByText(rangeMine.unestimated ? 'Capacity unknown' : 'Within capacity',{exact:true}).waitFor();
    await page.getByRole('heading',{name:'Workload',exact:true}).scrollIntoViewIfNeeded();
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await record('REPORT-004',`date-range-${width}`,page);
    await mine.scrollIntoViewIfNeeded();
    await record('REPORT-004',`date-capacity-${width}`,page);
  }
}
