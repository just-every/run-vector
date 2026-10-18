import assert from 'node:assert/strict';
import { beforePrivateNavigation } from './collaboration-navigation.mjs';

export async function currentNextJourney(page, context, base, capture = async () => {}) {
  const api = async (path, method = 'GET', data) => {
    const response = await context.request.fetch(base + '/api' + path, { method, headers: { Origin: base }, ...(data === undefined ? {} : { data }) });
    assert(response.ok(), `${method} ${path}: ${response.status()}`);
    return response.json();
  };
  const timezone = (await api('/settings')).workspace.timezone;
  await api('/settings', 'PATCH', { timezone: 'UTC' });
  try {
    const day = days => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
    const stamp = String(Date.now());
    const prefix = 'CX' + stamp.slice(-6).replace(/\d/g, n => String.fromCharCode(65 + Number(n)));
    const state = await api('/settings/teams', 'POST', { name: 'Checkout delivery ' + stamp, identifierPrefix: prefix });
    const team = state.teams.find(t => t.identifierPrefix === prefix);
    const status = category => team.statuses.find(s => s.category === category).id;
    const create = data => api('/issues', 'POST', { teamId: team.id, statusId: status('unstarted'), ...data });
    const cycles = [];
    for (const [name, start, end] of [['Recovery sprint', -1, 3], ['Hardening sprint', 3, 10], ['Migration sprint', 10, 17]]) {
      const updated = await api('/settings/cycles', 'POST', { teamId: team.id, name: name + ' ' + stamp, startsLocal: day(start) + 'T00:00', endsLocal: day(end) + 'T00:00' });
      cycles.push(updated.cycles.find(c => c.name === name + ' ' + stamp));
    }
    const active = await create({ title: 'Handle delayed provider acknowledgements', cycleId: cycles[0].id });
    const nextCycle = await create({ title: 'Harden settlement retry limits', cycleId: cycles[1].id });
    const later = await create({ title: 'Migrate legacy provider adapter', cycleId: cycles[2].id });
    const due = await create({ title: 'Review payment recovery runbook', dueDate: day(7) });
    const beyond = await create({ title: 'Plan provider capacity exercise', dueDate: day(8) });
    for (const width of [1440, 390]) {
      // Restore before each viewport so both journeys exercise the real mutation.
      const current = await api('/issues/' + nextCycle.identifier);
      if (current.status.category !== 'unstarted')
        await api('/issues/' + nextCycle.identifier, 'PATCH', { expectedVersion: current.version, statusId: status('unstarted') });
      await page.setViewportSize({ width, height: 1000 });
      await beforePrivateNavigation(page, base + '/app'); await page.goto(base + '/app');
      const next = page.getByRole('region', { name: 'Next', exact: true });
      for (const issue of [active, nextCycle, due]) await next.locator('#issue-row-' + issue.identifier).waitFor();
      for (const issue of [later, beyond]) assert.equal(await next.locator('#issue-row-' + issue.identifier).count(), 0);
      assert.match(await next.locator('#issue-row-' + due.identifier).innerText(), /Due within 7 days/);
      assert.match(await next.locator('#issue-row-' + nextCycle.identifier).innerText(), /Cycle commitment/);
      await next.locator('#issue-row-' + nextCycle.identifier).click({ trial: true });
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await capture('CURR-004', `next-${width}`, page);
      await next.locator('#issue-row-' + nextCycle.identifier).click();
      await page.getByRole('heading', { name: nextCycle.title, exact: true }).waitFor();
      const select = page.getByRole('combobox', { name: 'Issue status', exact: true });
      const [saved] = await Promise.all([
        page.waitForResponse(r => r.url() === base + '/api/issues/' + nextCycle.identifier && r.request().method() === 'PATCH'),
        select.selectOption(status('started')),
      ]);
      assert.equal(saved.status(), 200);
      assert.equal((await api('/issues/' + nextCycle.identifier)).status.category, 'started');
      // Return through the mobile Back to list control, retaining the open stream.
      if (width === 390) await page.getByRole('button', { name: /Back to list/ }).click();
      const now = page.getByRole('region', { name: 'Now', exact: true });
      await now.locator('#issue-row-' + nextCycle.identifier).waitFor();
      assert.equal(await next.locator('#issue-row-' + nextCycle.identifier).count(), 0);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await capture('CURR-004', `started-from-next-${width}`, page);
    }
  } finally {
    await api('/settings', 'PATCH', { timezone });
  }
}
