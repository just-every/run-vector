import assert from 'node:assert/strict';
import { beforePrivateNavigation } from './collaboration-navigation.mjs';
import { streamControlsFixture } from './core-stream-controls-fixture.mjs';
import { streamRankingJourney } from './core-stream-controls-ranking.mjs';
import { controlsFit, cycleContextChecks, fixtureRows, saveControl, streamControlsReady } from './core-stream-controls-browser.mjs';

export async function streamControlsJourney(page, context, base, record, capture, widths = [1440, 390]) {
  const fixture = await streamControlsFixture(context, base);
  const { api, teams, project, operatorId, items } = fixture;
  const all = Object.values(items);
  await streamRankingJourney(fixture, record);
  // A client using the old three-field preference body must receive the new
  // fields defaulted, on both the write receipt and subsequent stored read.
  for (const surface of ['current', 'my-work']) {
    const saved = await api('/preferences/' + surface, 'PUT', {
      filters: { teamId: 'all', assigneeId: 'all', priority: surface === 'current' ? 'all' : 'low' },
      sort: 'priority', grouping: 'none',
    });
    for (const key of ['projectId', 'itemType', 'attentionReason']) assert.equal(saved.filters[key], 'all');
    assert.deepEqual((await api('/preferences/' + surface)).filters, saved.filters);
  }
  const fields = [
    ['Team', 'teamId'], ['Project', 'projectId'], ['Priority', 'priority'],
    ['Item type', 'itemType'], ['Assignee', 'assigneeId'], ['Attention reason', 'attentionReason'],
  ];
  const cases = [
    ['Team', teams[0].id, [items.primary, items.context, items.done, items.intake]],
    ['Project', project.id, [items.primary, items.done]],
    ['Project', 'none', [items.context, items.other, items.countDone, items.intake, items.unrelated]],
    ['Priority', 'high', [items.done, items.countDone]],
    ['Item type', 'intake', [items.intake]],
    ['Item type', 'issue', all.filter(issue => issue !== items.intake)],
    ['Assignee', operatorId, [items.primary, items.other, items.done]],
    ['Assignee', 'unassigned', [items.context, items.countDone, items.intake, items.unrelated]],
    ['Attention reason', 'started-work', [items.primary, items.context, items.other, items.unrelated]],
    ['Attention reason', 'unassigned-urgent-work', [items.context]],
    ['Attention reason', 'completed-within-seven-days', [items.done, items.countDone]],
  ];
  const combination = {
    teamId: teams[0].id, projectId: project.id, priority: 'medium',
    itemType: 'issue', assigneeId: operatorId, attentionReason: 'started-work',
  };
  const filters = page.locator('.stream-filters');
  async function reset(surface = 'current') {
    await saveControl(page, base, surface,
      () => filters.getByRole('button', { name: 'Reset filters', exact: true }).click(), 'DELETE');
    await page.waitForFunction(() => [...document.querySelectorAll('.stream-filters select')].every(select => select.value === 'all'));
    for (const control of await filters.getByRole('combobox').all()) assert.equal(await control.inputValue(), 'all');
  }
  async function open(path, reload = false) {
    await beforePrivateNavigation(page, base + path);
    if (reload) await page.reload();
    else await page.goto(base + path);
    await streamControlsReady(page);
  }
  for (const width of widths) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    await open('/app');
    await fixtureRows(page, items, all);
    await page.getByRole('heading', { name: 'Recently done', exact: true }).waitFor();
    await controlsFit(page);
    await capture?.(`stream-controls-${width}-defaults`);
    for (const [label, value, expected] of cases) {
      await saveControl(page, base, 'current', () => filters.getByRole('combobox', { name: label, exact: true }).selectOption(value));
      await fixtureRows(page, items, expected);
      await reset();
      await fixtureRows(page, items, all);
    }
    for (const [label, key] of fields) {
      await saveControl(page, base, 'current', () => filters.getByRole('combobox', { name: label, exact: true }).selectOption(combination[key]));
    }
    await fixtureRows(page, items, [items.primary]);
    await controlsFit(page);
    await capture?.(`stream-controls-${width}-combined`);
    await open('/app', true);
    for (const [label, key] of fields)
      assert.equal(await filters.getByRole('combobox', { name: label, exact: true }).inputValue(), combination[key]);
    await fixtureRows(page, items, [items.primary]);
    await page.locator('#issue-row-' + items.primary.identifier).click();
    await page.getByRole('heading', { name: items.primary.title, exact: true }).waitFor();
    await page.waitForURL(base + '/app/current/' + items.primary.identifier);
    if (width === 390) await page.getByRole('button', { name: '← Back to list', exact: true }).click();
    else {
      await page.locator('.stream-detail').focus();
      await page.locator('.stream-detail').press('Escape');
    }
    await page.waitForURL(base + '/app');
    await streamControlsReady(page);
    assert.deepEqual((await api('/preferences/current')).filters, combination);
    await reset();
    await open('/app', true);
    await fixtureRows(page, items, all);
    for (const [label] of fields) assert.equal(await filters.getByRole('combobox', { name: label, exact: true }).inputValue(), 'all');
  }
  record('CURR-009', 'At 1440px and 390px, Current filters team/project/priority/Intake-vs-Issue/assignee/attention reason (primary or context), combines all six, restores stored controls on reload, resets durably, retains Recently done by default and wraps every control with 44px touch targets.');

  await page.setViewportSize({ width: 1440, height: 1000 });
  await open('/app/my-work');
  assert.equal(await filters.getByRole('combobox', { name: 'Priority', exact: true }).inputValue(), 'low');
  await fixtureRows(page, items, [items.other]);
  await reset('my-work');
  await fixtureRows(page, items, [items.primary, items.other]);
  for (const width of widths) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    await cycleContextChecks(page, fixture);
    await controlsFit(page);
    await capture?.(`my-work-cycle-context-${width}`);
  }
  record('WORK-003', 'My work shows exactly one context row for each of two qualifying fixture teams, with API-backed start/end dates and timezone, 2/5 points (40%) and 1/2 issues (50%); an unrelated active team is absent at desktop and mobile widths. Old three-field My work controls normalize and reset correctly.');
  await page.setViewportSize({ width: 1440, height: 1000 });
}
