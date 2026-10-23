import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { beforePrivateNavigation } from './collaboration-navigation.mjs';
import { streamControlsReady } from './core-stream-controls-browser.mjs';

export async function currentIntakePaginationJourney(page, context, base, capture = async () => {}) {
  const viewport = page.viewportSize();
  const api = async (path, method = 'GET', data) => {
    const response = await context.request.fetch(base + '/api' + path, {
      method, headers: { Origin: base }, ...(data === undefined ? {} : { data }),
    });
    assert(response.ok(), `${method} ${path}: ${response.status()} ${await response.text()}`);
    return response.json();
  };
  const preference = await api('/preferences/current');
  const prefix = 'DQ' + Array.from(randomBytes(8), byte => String.fromCharCode(65 + byte % 26)).join('');
  const state = await api('/settings/teams', 'POST', { name: `Settlement review ${prefix}`, identifierPrefix: prefix });
  const team = state.teams.find(row => row.identifierPrefix === prefix);
  const issues = [];
  // Use the product's creation and deferral doors; no database seeding.
  for (let start = 0; start < 120; start += 6) {
    issues.push(...await Promise.all(Array.from({ length: 6 }, (_, offset) => api('/intake', 'POST', {
      teamId: team.id, title: `Review settlement exception ${String(start + offset + 1).padStart(3, '0')}`,
    }))));
  }
  let returnAt;
  for (let start = 0; start < issues.length; start += 6) {
    // Each batch owns a fresh future instant; earlier batch latency cannot
    // spend the admission window of deferrals that have not been sent yet.
    returnAt = new Date(Date.now() + 15000).toISOString();
    await Promise.all(issues.slice(start, start + 6).map(issue => api(`/issues/${issue.identifier}/defer`, 'POST', {
      expectedVersion: issue.version, returnAt, reason: 'Wait for the reconciliation window',
    })));
  }
  await page.waitForTimeout(Math.max(0, new Date(returnAt).getTime() - Date.now() + 100));
  try {
    for (const width of [1440, 390]) {
      await api('/preferences/current', 'PUT', {
        filters: { teamId: team.id, projectId: 'all', priority: 'all', itemType: 'all', assigneeId: 'all', attentionReason: 'all' },
        sort: 'priority', grouping: 'none',
      });
      await page.setViewportSize({ width, height: 1000 });
      await beforePrivateNavigation(page, base + '/app');
      await page.goto(base + '/app');
      await streamControlsReady(page);
      const region = page.getByRole('region', { name: 'Needs decision', exact: true });
      await region.getByRole('status').filter({ hasText: '50 shown of 120' }).waitFor();
      const rows = region.locator('.stream-row');
      assert.equal(await rows.count(), 50);
      await region.getByRole('button', { name: 'Show more decisions', exact: true }).scrollIntoViewIfNeeded();
      await capture('CURR-002', `decision-page-${width}`, page);
      await region.getByRole('button', { name: 'Show more decisions', exact: true }).click();
      await region.getByRole('status').filter({ hasText: '100 shown of 120' }).waitFor();
      assert.equal(await rows.count(), 100);
      await region.getByRole('button', { name: 'Show more decisions', exact: true }).click();
      await region.getByRole('status').filter({ hasText: '120 shown of 120' }).waitFor();
      assert.equal(await rows.count(), 120);
      assert.deepEqual((await rows.evaluateAll(rows => rows.map(row => row.dataset.issueIdentifier))).sort(), issues.map(row => row.identifier).sort());
      assert.equal(await region.getByRole('button', { name: 'Show more decisions', exact: true }).count(), 0);
      // Polling may finish return receipts and re-rank by updated time. Compare
      // the settled browser order to the same Current public response.
      const polled = await page.waitForResponse(response => response.url() === base + '/api/current' && response.status() === 200);
      const current = await polled.json();
      const expected = current.sections['needs-decision'].filter(row => row.team.id === team.id).map(row => row.identifier);
      await page.waitForFunction(expected => {
        const actual = [...document.querySelectorAll('[aria-labelledby="section-needs-decision"] .stream-row')].map(row => row.dataset.issueIdentifier);
        return JSON.stringify(actual) === JSON.stringify(expected);
      }, expected).catch(async error => {
        console.log('Current rank mismatch', JSON.stringify({ expected, actual: await rows.evaluateAll(rows => rows.map(row => row.dataset.issueIdentifier)) }));
        throw error;
      });
      await region.getByRole('status').scrollIntoViewIfNeeded();
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await capture('CURR-002', `decision-complete-${width}`, page);
      await rows.last().click();
      await page.getByRole('heading', { name: issues.find(row => row.identifier === expected.at(-1)).title, exact: true }).waitFor();
    }
  } finally {
    const current = await api('/current');
    const versions = new Map(current.sections['needs-decision'].map(row => [row.identifier, row.version]));
    for (let start = 0; start < issues.length; start += 6) {
      await Promise.all(issues.slice(start, start + 6).map(issue => api(`/issues/${issue.identifier}/decline`, 'POST', {
        expectedVersion: versions.get(issue.identifier), reason: 'Review journey complete',
      })));
    }
    await api('/preferences/current', 'PUT', { filters: preference.filters, sort: preference.sort, grouping: preference.grouping });
    if (viewport) await page.setViewportSize(viewport);
  }
}
