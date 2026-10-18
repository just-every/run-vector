import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { beforePrivateNavigation } from './collaboration-navigation.mjs';
import { saveControl, streamControlsReady } from './core-stream-controls-browser.mjs';

export async function currentDisjointJourney(page, context, base, capture = async () => {}) {
  const viewport = page.viewportSize();
  const api = async (path, method = 'GET', data) => {
    const response = await context.request.fetch(base + '/api' + path, {
      method, headers: { Origin: base }, ...(data === undefined ? {} : { data }),
    });
    assert(response.ok(), `${method} ${path}: ${response.status()} ${await response.text()}`);
    return response.json();
  };
  const [settings, preference] = await Promise.all([api('/settings'), api('/preferences/current')]);
  const filters = { teamId: 'all', projectId: 'all', priority: 'all', itemType: 'all', assigneeId: 'all', attentionReason: 'all' };
  await api('/settings', 'PATCH', { timezone: 'UTC' });
  try {
    const prefix = 'CD' + Array.from(randomBytes(8), byte => String.fromCharCode(65 + byte % 26)).join('');
    const state = await api('/settings/teams', 'POST', { name: `Settlement response ${prefix}`, identifierPrefix: prefix });
    const team = state.teams.find(row => row.identifierPrefix === prefix);
    assert.ok(team);
    const status = category => team.statuses.find(row => row.category === category).id;
    const day = offset => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);
    const cycles = await api('/settings/cycles', 'POST', {
      teamId: team.id, name: `Payment recovery ${prefix}`, startsLocal: day(-2) + 'T00:00', endsLocal: day(10) + 'T00:00',
    });
    const cycleId = cycles.cycles.find(row => row.name === `Payment recovery ${prefix}`).id;
    const create = data => api('/issues', 'POST', { teamId: team.id, ...data });
    const intake = async title => {
      const issue = await api('/intake', 'POST', { teamId: team.id, title });
      return api('/issues/' + issue.identifier, 'PATCH', { expectedVersion: issue.version, dueDate: day(-1), cycleId });
    };
    const [decision, started, overdue, next, done, canceled, duplicate, deferred, deleted, backlog] = await Promise.all([
      intake('Assess provider settlement evidence'),
      create({ title: 'Investigate missing payment acknowledgements', statusId: status('started'), dueDate: day(2), cycleId }),
      create({ title: 'Reconcile overdue settlements', statusId: status('unstarted'), dueDate: day(-1), cycleId }),
      create({ title: 'Document settlement recovery', statusId: status('unstarted'), dueDate: day(2), cycleId }),
      create({ title: 'Ship corrected receipt matching', statusId: status('completed'), dueDate: day(-1) }),
      create({ title: 'Retire obsolete provider alert', statusId: status('canceled'), dueDate: day(-1) }),
      create({ title: 'Repeated report of missing acknowledgements', statusId: status('started'), dueDate: day(-1) }),
      intake('Wait for the provider reconciliation file'),
      create({ title: 'Remove an accidentally logged incident', statusId: status('started'), dueDate: day(-1) }),
      create({ title: 'Explore a future provider migration', statusId: status('backlog') }),
    ]);
    await Promise.all([
      api(`/issues/${duplicate.identifier}/duplicate`, 'POST', { expectedVersion: duplicate.version, canonicalIdentifier: started.identifier }),
      api(`/issues/${deferred.identifier}/defer`, 'POST', {
        expectedVersion: deferred.version, returnAt: new Date(Date.now() + 3600000).toISOString(), reason: 'Wait for the provider file',
      }),
      api('/issues/' + deleted.identifier, 'DELETE', { expectedVersion: deleted.version, confirmed: true }),
    ]);
    const excluded = [canceled, duplicate, deferred, deleted, backlog];
    const sections = { 'needs-decision': [decision], now: [started, overdue], next: [next], 'recently-done': [done] };
    async function assertSections(expected) {
      const wanted = Object.fromEntries(Object.entries(expected).map(([section, issues]) => [section, issues.map(row => row.identifier).sort()]));
      await page.waitForFunction(wanted => Object.entries(wanted).every(([section, identifiers]) => {
        const region = document.querySelector(`[aria-labelledby="section-${section}"]`);
        const actual = [...(region?.querySelectorAll('.stream-row') ?? [])].map(row => row.dataset.issueIdentifier).sort();
        return region && JSON.stringify(actual) === JSON.stringify(identifiers);
      }), wanted);
      const rows = await page.locator('.stream-list .stream-row').evaluateAll(rows => rows.map(row => row.dataset.issueIdentifier));
      assert.deepEqual(rows.slice().sort(), Object.values(wanted).flat().sort());
      assert.equal(new Set(rows).size, rows.length, 'Each issue appears in exactly one Current section');
      for (const issue of excluded) assert.ok(!rows.includes(issue.identifier));
    }
    for (const width of [1440, 390]) {
      const current = await api('/issues/' + next.identifier);
      if (current.status.category !== 'unstarted')
        await api('/issues/' + next.identifier, 'PATCH', { expectedVersion: current.version, statusId: status('unstarted') });
      await api('/preferences/current', 'PUT', { filters, sort: 'priority', grouping: 'none' });
      await page.setViewportSize({ width, height: 1000 });
      await beforePrivateNavigation(page, base + '/app');
      await page.goto(base + '/app');
      await streamControlsReady(page);
      await saveControl(page, base, 'current', () => page.locator('.stream-filters').getByRole('combobox', { name: 'Team', exact: true }).selectOption(team.id));
      await assertSections(sections);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await capture('CURR-001', `disjoint-${width}`, page);

      await page.getByRole('region', { name: 'Next', exact: true }).locator('#issue-row-' + next.identifier).click();
      await page.getByRole('heading', { name: next.title, exact: true }).waitFor();
      const [saved] = await Promise.all([
        page.waitForResponse(response => response.url() === base + '/api/issues/' + next.identifier && response.request().method() === 'PATCH'),
        page.getByRole('combobox', { name: 'Issue status', exact: true }).selectOption(status('started')),
      ]);
      assert.equal(saved.status(), 200);
      assert.equal((await api('/issues/' + next.identifier)).status.category, 'started');
      if (width === 390) await page.getByRole('button', { name: /Back to list/ }).click();
      await assertSections({ ...sections, now: [...sections.now, next], next: [] });
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await capture('CURR-001', `disjoint-started-${width}`, page);
    }
  } finally {
    await Promise.all([
      api('/settings', 'PATCH', { timezone: settings.workspace.timezone }),
      api('/preferences/current', 'PUT', { filters: preference.filters, sort: preference.sort, grouping: preference.grouping }),
    ]);
    if (viewport) await page.setViewportSize(viewport);
  }
}
