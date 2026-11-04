import assert from 'node:assert/strict';
import { roleScreens } from './role-ui-support.mjs';
import { beforePrivateNavigation } from './collaboration-navigation.mjs';

export async function exerciseAuditView({ page, runtime, capture, clause, evidence }) {
  await clause('ROLE-005', 'Owners browse and filter retained audit entries and download exactly the visible filtered set', async () => {
    const labelNames = ['synthetic-vector-5101', 'synthetic-vector-5102', 'synthetic-vector-5103'];
    for (const name of labelNames) {
      const created = await page.request.post(runtime.base + '/api/settings/labels', {
        headers: { Origin: runtime.base }, data: { name, color: '#224466' },
      });
      assert.equal(created.status(), 200);
    }
    const all = await (await page.request.get(runtime.base + '/api/settings/audit')).json();
    const entry = all.entries.find(item => item.action === 'operator.role_changed');
    assert.ok(entry, 'the preceding native role journey produced an audit event');
    const settings = await (await page.request.get(runtime.base + '/api/settings')).json();
    const invitee = settings.operators.find(person => person.id === entry.subjectRef);
    assert.ok(invitee);
    const invitation = all.entries.find(item => item.action === 'operator.invited' && item.subjectName === invitee.name);
    assert.ok(invitation, 'the invitation resolves to the invited person rather than an auth ID');
    const { cycles } = await (await page.request.get(runtime.base + '/api/settings/cycles')).json();
    const cycle = cycles.find(cycle => all.entries.some(item => item.action === 'cycle.created' && item.subjectRef === cycle.id));
    assert.ok(cycle, 'the preceding cycle journey produced an audit event');
    for (const name of labelNames) assert.ok(all.entries.some(item => item.action === 'label.created' && item.subjectName === name));
    assert.equal(all.entries.find(item => item.action === 'cycle.created' && item.subjectRef === cycle.id).subjectName, cycle.name);
    await beforePrivateNavigation(page, runtime.base + '/app/settings');
    await page.goto(runtime.base + '/app/settings');
    // Following the link leaves Settings; its reads finish first, as before any private navigation.
    await beforePrivateNavigation(page, runtime.base + '/app/settings/audit');
    await page.getByRole('link', { name: 'Audit log', exact: true }).click();
    const panel = page.locator('#audit');
    await panel.getByRole('heading', { name: 'Audit log', exact: true }).waitFor();
    await panel.locator('tbody tr').first().waitFor();
    for (const name of [...labelNames, invitee.name, cycle.name]) {
      const subject = panel.locator('.audit-subject').getByText(name, { exact: true }).first();
      await subject.waitFor();
      assert.equal(await subject.isVisible(), true, 'item names are readable without opening record details');
    }
    const actorOptions = panel.locator('select[name="actor"] option');
    const expectedActors = new Set(all.entries.map(item => item.actorFilterRef));
    assert.equal(await actorOptions.count(), expectedActors.size + 1, 'each identity has one filter option');
    const personEntries = all.entries.filter(item => item.actorFilterRef === entry.actorFilterRef);
    assert.ok(personEntries.some(item => item.actorRef.startsWith('auth:')) && personEntries.some(item => item.actorRef.startsWith('person:')), 'the person has native-auth and product activity');
    await panel.locator('select[name="actor"]').selectOption(entry.actorFilterRef);
    const personResponse = page.waitForResponse(r => r.url().includes('/api/settings/audit?') && new URL(r.url()).searchParams.get('actor') === entry.actorFilterRef);
    await panel.getByRole('button', { name: 'Apply filters', exact: true }).click();
    const personSelected = await (await personResponse).json();
    assert.deepEqual(personSelected.entries.map(item => item.id), personEntries.map(item => item.id), 'one person filter includes both native-auth and product events');
    await panel.locator('tbody tr').first().waitFor();
    assert.equal(await panel.locator('tbody tr').count(), personSelected.entries.length);
    const inspect = roleScreens(evidence);
    await inspect(page, panel, 'workspace-audit');
    await panel.locator('select[name="actor"]').selectOption(entry.actorFilterRef);
    await panel.locator('select[name="kind"]').selectOption(entry.actorKind);
    await panel.locator('select[name="action"]').selectOption(entry.action);
    await panel.getByLabel('Item reference', {exact:true}).fill(entry.subjectRef);
    const [from,to]=await page.evaluate(at=>{const stamp=Date.parse(at),local=value=>{const d=new Date(value);const pad=n=>String(n).padStart(2,'0');return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())+'T'+pad(d.getHours())+':'+pad(d.getMinutes());};return [local(stamp-60000),local(stamp+60000)];},entry.at);
    await panel.getByLabel('From (your local time)',{exact:true}).fill(from);
    await panel.getByLabel('To (your local time)',{exact:true}).fill(to);
    const response = page.waitForResponse(r => r.url().includes('/api/settings/audit?') && r.url().includes('subject='));
    await panel.getByRole('button', {name:'Apply filters',exact:true}).click();
    const selected = await (await response).json();
    assert.ok(selected.entries.some(item=>item.id===entry.id),'the selected event remains inside the chosen time range');
    assert.ok(selected.entries.every(item => item.actorFilterRef === entry.actorFilterRef && item.action === entry.action && item.subjectRef === entry.subjectRef));
    await panel.locator('tbody tr').first().waitFor();
    assert.equal(await panel.locator('tbody tr').count(), selected.entries.length);
    const csvUrl = await panel.getByRole('link',{name:'Export filtered CSV'}).getAttribute('href');
    const csv = await page.request.get(runtime.base + csvUrl);
    assert.equal(csv.status(),200);
    const ids=(await csv.text()).trim().split('\r\n').slice(1).map(line=>line.split(',')[0].slice(1,-1));
    assert.deepEqual(ids,selected.entries.map(item=>item.id));
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth),true,'audit filters fit the viewport');
    await capture('workspace-audit-filtered');
    await inspect(page, panel, 'workspace-audit-filtered');
    await panel.getByLabel('Item reference',{exact:true}).fill('absent');
    const empty=page.waitForResponse(r=>r.url().includes('/api/settings/audit?')&&r.url().includes('subject=absent'));
    await panel.getByRole('button',{name:'Apply filters',exact:true}).click();
    await empty;
    await panel.getByText('No audit entries match these filters.').waitFor();
    await inspect(page, panel, 'workspace-audit-empty');
  });
}

export async function exerciseAuditAccess({ page, peer, runtime, clause, memberId }) {
  await clause('ROLE-005', 'a Member is refused the audit document and both data doors', async () => {
    // The page keeps its 403 but shows one plain line and a link, never the server's JSON.
    const page403 = await peer.request.get(runtime.base + '/app/settings/audit');
    assert.equal(page403.status(), 403);
    assert.match(page403.headers()['content-type'], /text\/html/);
    for (const path of ['/api/settings/audit', '/api/settings/audit.csv']) {
      const response = await peer.request.get(runtime.base + path);
      assert.equal(response.status(), 403, path);
      assert.equal((await response.json()).error, 'forbidden');
    }
    await peer.goto(runtime.base + '/app/settings/audit');
    await peer.getByText('You can’t open this page.').waitFor();
    assert.equal(await peer.getByText('Only Owners and Admins can browse and export the audit log.').count(), 0, 'no raw refusal text on the page');
    assert.equal(await peer.getByRole('link', { name: 'Audit log', exact: true }).count(), 0);
    await exerciseGuestAuditAccess({page,peer,runtime,memberId});
  });
}

/** After ROLE-003, audit refusals use a Guest assigned through the real door. */
export async function exerciseGuestAuditAccess({page,peer,runtime,memberId}) {
 const metadata=await (await page.request.get(runtime.base+'/api/metadata')).json();
 const role=async value=>{const response=await page.request.patch(runtime.base+'/api/settings/operators/'+memberId+'/role',{headers:{Origin:runtime.base},data:{role:value,...(value==='guest'?{teamIds:[metadata.teams[0].id]}:{})}});assert.equal(response.status(),200);};
 await role('guest');
 try {for(const path of ['/app/settings/audit','/api/settings/audit','/api/settings/audit.csv']) {
  const response=await peer.request.get(runtime.base+path);assert.equal(response.status(),403,'Guest '+path);
  if(path.startsWith('/api/'))assert.equal((await response.json()).error,'forbidden');else assert.match(response.headers()['content-type'],/text\/html/);
 }}finally{await role('member');}
}
