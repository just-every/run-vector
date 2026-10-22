import assert from 'node:assert/strict';
import {writeRuntimeD1} from './runtime-d1.mjs';
import { beforePrivateNavigation } from './collaboration-navigation.mjs';

export async function exerciseAuditView({ page, runtime, capture, clause }) {
  await clause('ROLE-005', 'Owners browse and filter retained audit entries and download exactly the visible filtered set', async () => {
    const all = await (await page.request.get(runtime.base + '/api/settings/audit')).json();
    const entry = all.entries.find(item => item.action === 'operator.role_changed');
    assert.ok(entry, 'the preceding native role journey produced an audit event');
    await beforePrivateNavigation(page, runtime.base + '/app/settings');
    await page.goto(runtime.base + '/app/settings');
    await page.getByRole('link', { name: 'Audit log', exact: true }).click();
    const panel = page.locator('#audit');
    await panel.getByRole('heading', { name: 'Audit log', exact: true }).waitFor();
    await panel.getByLabel('Actor reference', {exact:true}).fill(entry.actorRef);
    await panel.getByRole('combobox', {name:'Actor kind',exact:true}).selectOption(entry.actorKind);
    await panel.getByLabel('Action kind', {exact:true}).fill(entry.action);
    await panel.getByLabel('Subject reference', {exact:true}).fill(entry.subjectRef);
    const [from,to]=await page.evaluate(at=>{const stamp=Date.parse(at),local=value=>{const d=new Date(value);const pad=n=>String(n).padStart(2,'0');return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())+'T'+pad(d.getHours())+':'+pad(d.getMinutes());};return [local(stamp-60000),local(stamp+60000)];},entry.at);
    await panel.getByLabel('From (your local time)',{exact:true}).fill(from);
    await panel.getByLabel('To (your local time)',{exact:true}).fill(to);
    const response = page.waitForResponse(r => r.url().includes('/api/settings/audit?') && r.url().includes('subject='));
    await panel.getByRole('button', {name:'Apply filters',exact:true}).click();
    const selected = await (await response).json();
    assert.ok(selected.entries.some(item=>item.id===entry.id),'the selected event remains inside the chosen time range');
    assert.ok(selected.entries.every(item => item.actorRef === entry.actorRef && item.action === entry.action && item.subjectRef === entry.subjectRef));
    await panel.locator('tbody tr').first().waitFor();
    assert.equal(await panel.locator('tbody tr').count(), selected.entries.length);
    const csvUrl = await panel.getByRole('link',{name:'Export filtered CSV'}).getAttribute('href');
    const csv = await page.request.get(runtime.base + csvUrl);
    assert.equal(csv.status(),200);
    const ids=(await csv.text()).trim().split('\r\n').slice(1).map(line=>line.split(',')[0].slice(1,-1));
    assert.deepEqual(ids,selected.entries.map(item=>item.id));
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth),true,'audit filters fit the viewport');
    await capture('workspace-audit-filtered');
    await panel.getByLabel('Subject reference',{exact:true}).fill('absent');
    const empty=page.waitForResponse(r=>r.url().includes('/api/settings/audit?')&&r.url().includes('subject=absent'));
    await panel.getByRole('button',{name:'Apply filters',exact:true}).click();
    await empty;
    await panel.getByText('No audit entries match these filters.').waitFor();
  });
}

export async function exerciseAuditAccess({ peer, runtime, clause, memberId }) {
  await clause('ROLE-005', 'a Member is refused the audit document and both data doors', async () => {
    for (const path of ['/app/settings/audit', '/api/settings/audit', '/api/settings/audit.csv']) {
      const response = await peer.request.get(runtime.base + path);
      assert.equal(response.status(), 403, path);
      assert.equal((await response.json()).error, 'forbidden');
    }
    assert.equal(await peer.getByRole('link', { name: 'Audit log', exact: true }).count(), 0);
    await exerciseGuestAuditAccess({peer,runtime,memberId});
  });
}

/** ROLE-005 independently refuses the stored Guest role before ROLE-003's
 * assignment door lands. This is synthetic fixture state, never app code. */
export async function exerciseGuestAuditAccess({peer,runtime,memberId}) {
 await writeRuntimeD1(runtime.base,"UPDATE operators SET role='guest' WHERE id=?",[memberId]);
 try {for(const path of ['/app/settings/audit','/api/settings/audit','/api/settings/audit.csv']) {
  const response=await peer.request.get(runtime.base+path);assert.equal(response.status(),403,'Guest '+path);assert.equal((await response.json()).error,'forbidden');
 }}finally{await writeRuntimeD1(runtime.base,"UPDATE operators SET role='member' WHERE id=?",[memberId]);}
}
