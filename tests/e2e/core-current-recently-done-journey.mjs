import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { beforePrivateNavigation } from './collaboration-navigation.mjs';
import { streamControlsReady } from './core-stream-controls-browser.mjs';

export async function currentRecentlyDoneJourney(page, context, base, capture = async () => {}) {
  const viewport = page.viewportSize();
  const api = async (path, method = 'GET', data) => {
    const response = await context.request.fetch(base + '/api' + path, {
      method, headers: { Origin: base }, ...(data === undefined ? {} : { data }),
    });
    assert(response.ok(), `${method} ${path}: ${response.status()} ${await response.text()}`);
    return response.json();
  };
  const preferences = await api('/preferences/current');
  const token = Array.from(randomBytes(4), b => String.fromCharCode(65 + b % 26)).join('');
  const prefix = 'RD' + token;
  const state = await api('/settings/teams', 'POST', { name: 'Payment recovery ' + token, identifierPrefix: prefix });
  const team = state.teams.find(t => t.identifierPrefix === prefix);
  const status = category => team.statuses.find(s => s.category === category).id;
  const create = data => api('/issues', 'POST', { teamId: team.id, statusId: status('started'), ...data });
  const older = await create({ title: 'Restore settlement receipt delivery', priority: 'urgent', dueDate: '2026-01-01', statusId: status('completed') });
  const newer = await create({ title: 'Document payment recovery procedure', priority: 'none', statusId: status('completed') });
  assert(newer.completedAt > older.completedAt, 'Native completions establish a strict order');
  const edited = await api('/issues/' + older.identifier, 'PATCH', { expectedVersion: older.version, title: older.title + ' — verified' });
  assert(edited.updatedAt > newer.updatedAt, 'Last update opposes completion order');
  const high = await create({ title: 'Investigate remaining checkout failures', priority: 'high' });
  const low = await create({ title: 'Review recovery telemetry', priority: 'low' });
  const expectedDone = [newer.identifier, older.identifier];
  const expectedNow = [high.identifier, low.identifier];
  const rows = region => region.locator('[id^="issue-row-"]').evaluateAll(elements => elements.map(e => e.id.slice('issue-row-'.length)));
  try {
    await api('/preferences/current', 'PUT', { filters: { teamId: team.id, projectId: 'all', assigneeId: 'all', priority: 'all', itemType: 'all', attentionReason: 'all' }, sort: 'priority', grouping: 'none' });
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
      await beforePrivateNavigation(page, base + '/app');
      await page.goto(base + '/app');
      await streamControlsReady(page);
      const done = page.getByRole('region', { name: 'Recently done', exact: true });
      const now = page.getByRole('region', { name: 'Now', exact: true });
      await done.locator('#issue-row-' + newer.identifier).waitFor();
      assert.deepEqual(await rows(done), expectedDone);
      assert.deepEqual(await rows(now), expectedNow);
      assert.match(await done.innerText(), /Completed this week/);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await capture('CURR-005', `recently-done-${width}`, page);
      // Open the older completed issue through its row, then reopen it through the native selector.
      await done.locator('#issue-row-' + older.identifier).click();
      await page.getByRole('heading', { name: edited.title, exact: true }).waitFor();
      const select = page.getByRole('combobox', { name: 'Issue status', exact: true });
      const [saved] = await Promise.all([
        page.waitForResponse(r => r.url() === base + '/api/issues/' + older.identifier && r.request().method() === 'PATCH'),
        select.selectOption(status('started')),
      ]);
      assert.equal(saved.status(), 200);
      if (width === 390) await page.getByRole('button', { name: /Back to list/ }).click();
      await now.locator('#issue-row-' + older.identifier).waitFor();
      assert.equal(await done.locator('#issue-row-' + older.identifier).count(), 0);
      await capture('CURR-005', `reopened-${width}`, page);
      // Return to the original completion ordering before the second viewport.
      const current = await api('/issues/' + older.identifier);
      await api('/issues/' + older.identifier, 'PATCH', { expectedVersion: current.version, statusId: status('completed') });
      expectedDone.reverse();
    }
  } finally {
    await api('/preferences/current', 'PUT', { filters: preferences.filters, sort: preferences.sort, grouping: preferences.grouping });
    if (viewport) await page.setViewportSize(viewport);
  }
}
