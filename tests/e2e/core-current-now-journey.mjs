import { withOperatorClient } from './operator-request.mjs';
import assert from 'node:assert/strict';
import { beforePrivateNavigation } from './collaboration-navigation.mjs';

export async function currentNowJourney(page, context, base, capture = async () => {}) {
  const viewport = page.viewportSize();
  const api = async (path, method = 'GET', data) => {
    return withOperatorClient(context, async client => {
      const response = await client.fetch(base + '/api' + path, { method, headers: { Origin: base }, ...(data === undefined ? {} : { data }) });
      assert(response.ok(), `${method} ${path}: ${response.status()}`);
      return await response.json();
    });
  };
  const settings = await api('/settings');
  const timezone = settings.workspace.timezone;
  await api('/settings', 'PATCH', { timezone: 'Pacific/Kiritimati' });
  try {
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Pacific/Kiritimati', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    const yesterday = new Date(Date.parse(today + 'T12:00:00Z') - 86400000).toISOString().slice(0, 10);
    const stamp = String(Date.now());
    const prefix = 'CN' + stamp.slice(-6).replace(/\d/g, n => String.fromCharCode(65 + Number(n)));
    const state = await api('/settings/teams', 'POST', { name: 'Payment response ' + stamp, identifierPrefix: prefix });
    const team = state.teams.find(t => t.identifierPrefix === prefix);
    const create = data => api('/issues', 'POST', { teamId: team.id, ...data });
    const started = await create({ title: 'Investigate delayed payment confirmations', statusId: team.statuses.find(s => s.category === 'started').id });
    const overdue = await create({ title: 'Reconcile provider settlement mismatch', dueDate: yesterday });
    const dueToday = await create({ title: 'Prepare settlement review', dueDate: today });
    const canceled = await create({ title: 'Retired provider alert', dueDate: yesterday, statusId: team.statuses.find(s => s.category === 'canceled').id });
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      await beforePrivateNavigation(page, base + '/app'); await page.goto(base + '/app');
      const now = page.getByRole('region', { name: 'Now', exact: true });
      await now.locator('#issue-row-' + started.identifier).waitFor();
      await now.locator('#issue-row-' + overdue.identifier).waitFor();
      assert.match(await now.locator('#issue-row-' + started.identifier).innerText(), /Started work/);
      assert.match(await now.locator('#issue-row-' + overdue.identifier).innerText(), /Overdue/);
      assert.equal(await now.locator('#issue-row-' + dueToday.identifier).count(), 0);
      assert.equal(await now.locator('#issue-row-' + canceled.identifier).count(), 0);
      await now.locator('#issue-row-' + overdue.identifier).click({ trial: true });
      await capture('CURR-003', `now-${width}`, page);
      await now.locator('#issue-row-' + overdue.identifier).click();
      await page.getByRole('heading', { name: overdue.title, exact: true }).waitFor();
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await capture('CURR-003', `overdue-detail-${width}`, page);
    }
  } finally {
    await api('/settings', 'PATCH', { timezone });
    if (viewport) await page.setViewportSize(viewport);
  }
}
