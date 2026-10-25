import { withOperatorClient } from './operator-request.mjs';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { beforePrivateNavigation, settleReads } from './collaboration-navigation.mjs';

// Exact live PATCH URLs, present only while a deliberate stale request runs.
export const expectedBoardConflicts = new Set();
export const priorities = ['urgent', 'high', 'medium', 'low', 'none'];
export const ordinaryCategories = new Set(['backlog', 'unstarted', 'started', 'completed', 'canceled']);

export function boardApi(context, base) {
  return async (path, method = 'GET', data) => {
    return withOperatorClient(context, async client => {
      const response = await client.fetch(base + '/api' + path, {
        method, headers: { Origin: base }, ...(data === undefined ? {} : { data }),
      });
      assert(response.ok(), `${method} ${path}: ${response.status()} ${await response.text()}`);
      return await response.json();
    });
  };
}

export async function boardFixture(api) {
  const suffix = [...randomBytes(6)].map(byte => String.fromCharCode(65 + byte % 26)).join('');
  const marker = 'Board journey ' + suffix;
  let administration;
  for (const [name, identifierPrefix] of [['Delivery', 'BD' + suffix], ['Quiet', 'BQ' + suffix]]) {
    administration = await api('/settings/teams', 'POST', { name: `${marker} ${name}`, identifierPrefix });
  }
  const team = administration.teams.find(row => row.identifierPrefix === 'BD' + suffix);
  const empty = administration.teams.find(row => row.identifierPrefix === 'BQ' + suffix);
  administration = await api(`/settings/teams/${team.id}/statuses`, 'POST', { name: 'Review ready', category: 'started' });
  const configured = administration.teams.find(row => row.id === team.id).statuses;
  const review = configured.find(row => row.name === 'Review ready');
  const ordered = configured.filter(row => row.id !== review.id);
  ordered.splice(4, 0, review);
  await api(`/settings/teams/${team.id}/statuses/order`, 'PUT', { statusIds: ordered.map(row => row.id) });
  const options = await api('/options');
  const statuses = options.statuses.filter(row => row.teamId === team.id).sort((a, b) => a.position - b.position);
  const status = category => statuses.find(row => row.category === category);
  const create = (title, fields = {}) => api('/issues', 'POST', {
    teamId: team.id, statusId: status('backlog').id, title: `${marker} ${title}`, ...fields,
  });
  const priorityIssues = [];
  for (const priority of [...priorities].reverse()) {
    priorityIssues.push(await create('priority ' + priority, { priority }));
  }
  const omitted = await create('priority omitted');
  assert.equal(omitted.priority, 'none', 'Omitting priority persists No priority');
  const mover = await create('route ordinary', { priority: 'high' });
  const intake = await api('/intake', 'POST', { teamId: team.id, title: marker + ' route intake' });
  let duplicate = await create('route duplicate');
  duplicate = await api(`/issues/${duplicate.identifier}/duplicate`, 'POST', {
    expectedVersion: duplicate.version, canonicalIdentifier: mover.identifier,
  });
  const completed = await create('route completed', { statusId: status('completed').id });
  const issues = [...priorityIssues, omitted, mover, intake, duplicate];
  // Same-team identifier allocation is sequential; fixtures use only real APIs.
  for (let i = 0; i < 96; i++) issues.push(await create('page ' + i));
  return { marker, team, empty, statuses, status, review, omitted, priorityIssues, mover, intake, duplicate, completed, issues };
}

export async function readyBoard(page, expected = {}) {
  await page.waitForFunction(expected => {
    const main = document.querySelector('main[data-list-query]');
    if (!main || main.dataset.listState !== 'ready' || !main.querySelector('.issues-board')) return false;
    const query = new URLSearchParams(main.dataset.listQuery);
    return Object.entries(expected).every(([key, value]) => (query.get(key) ?? (key === 'offset' ? '0' : 'all')) === String(value));
  }, expected);
  await settleReads(page);
}

export async function openBoard(page, base, query) {
  const target = base + '/app/board?' + new URLSearchParams(query);
  await beforePrivateNavigation(page, target);
  await page.goto(target);
  await readyBoard(page, { ...query, pageSize: 100, grouping: 'status' });
}

export function boardColumn(page, status) {
  return page.getByRole('region', { name: status.name + ' column', exact: true, includeHidden: true });
}
export function cardSelector(page, issue) {
  return page.getByRole('combobox', { name: 'Status for ' + issue.identifier, exact: true, includeHidden: true });
}
export async function boardSnapshot(page, api, statuses) {
  const search = await page.locator('main[data-list-query]').getAttribute('data-list-query');
  const query = new URLSearchParams(search);
  assert.equal(query.get('pageSize'), '100');
  assert.equal(query.get('grouping'), 'status');
  const url = new URL(page.url());
  assert.equal(url.searchParams.get('pageSize'), '100');
  assert.equal(url.searchParams.get('grouping'), 'status');
  const data = await api('/issues' + search);
  assert.equal(data.pageSize, 100);
  assert.equal(data.statusCounts.reduce((sum, row) => sum + row.count, 0), data.total);
  assert.deepEqual(await page.locator('.board-column').evaluateAll(columns => columns.map(column => column.getAttribute('aria-label'))),
    statuses.map(status => status.name + ' column'), 'Every configured column follows the authored workflow order');
  for (const status of statuses) {
    const column = boardColumn(page, status);
    const rows = data.issues.filter(row => row.status.id === status.id);
    const count = data.statusCounts.find(row => row.key === status.id)?.count ?? 0;
    assert.equal(Number(await column.locator('h2 > span').innerText()), count);
    if (rows.length < count) assert.deepEqual((await column.locator(':scope > p').first().textContent()).match(/\d+/g).map(Number), [rows.length, count]);
    else assert.equal(await column.locator(':scope > p').count(), 0);
    assert.deepEqual(await column.locator('.board-card-open small:first-child').allTextContents(), rows.map(row => row.identifier));
  }
  return data;
}

export async function chooseSourceColumn(page, issue, width) {
  if (width < 800) await page.getByRole('combobox', { name: 'Board column', exact: true }).selectOption(issue.status.id);
}

async function recovered(page, issue, outside = false) {
  await page.waitForFunction(({ identifier, statusId, outside }) => {
    const control = document.activeElement;
    const focused = outside ? control?.getAttribute('data-moved-issue') === identifier
      : control?.getAttribute('data-status-identifier') === identifier && control.value === statusId;
    const picker = document.querySelector('[aria-label="Board column"]');
    return focused && picker?.value === statusId;
  }, { identifier: issue.identifier, statusId: issue.status.id, outside });
  if (!outside) assert(await cardSelector(page, issue).isVisible(), 'Recovered focus is in the visible destination column');
}

export async function openCardMove(page, issue) {
  const details = page.locator('.board-card-status').filter({has: cardSelector(page, issue)});
  if (!(await details.evaluate(node => node.open))) await details.locator('summary').click();
}

export async function moveBoardCard(page, base, api, issue, target, width) {
  const before = await api('/issues/' + issue.identifier);
  await chooseSourceColumn(page, before, width);
  await openCardMove(page, issue);
  const selector = cardSelector(page, issue);
  await page.waitForFunction(identifier => {
    const control = document.querySelector(`[data-status-identifier="${identifier}"]`);
    return control && !control.disabled;
  }, issue.identifier);
  await selector.focus();
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Tab');
  assert.equal(await selector.evaluate(node => node === document.activeElement), true, 'The labelled native selector is reachable by keyboard');
  const [response] = await Promise.all([
    page.waitForResponse(response => response.url() === base + '/api/issues/' + issue.identifier && response.request().method() === 'PATCH'),
    selector.selectOption(target.id),
  ]);
  assert.equal(response.status(), 200);
  assert.deepEqual(response.request().postDataJSON(), { expectedVersion: before.version, statusId: target.id });
  const receipt = await response.json();
  assert.equal(receipt.status.id, target.id);
  assert.equal(receipt.version, before.version + 1);
  await recovered(page, receipt);
  const persisted = await api('/issues/' + issue.identifier);
  assert.equal(persisted.version, receipt.version);
  assert.equal(persisted.activity.length, before.activity.length + 1);
  return persisted;
}

export async function rejectStaleBoardMove(page, base, api, issue, rejected, currentStatus, width, outside = false) {
  const before = await api('/issues/' + issue.identifier);
  await chooseSourceColumn(page, before, width);
  await openCardMove(page, issue);
  const url = base + '/api/issues/' + issue.identifier;
  let release;
  const held = new Promise(resolve => { release = resolve; });
  const hold = async route => {
    if (route.request().method() === 'PATCH') await held;
    await route.continue();
  };
  // Delay the actual browser transport; never replace a response or issue data.
  await page.route(url, hold);
  expectedBoardConflicts.add(url);
  try {
    const requestPromise = page.waitForRequest(request => request.url() === url && request.method() === 'PATCH');
    const responsePromise = page.waitForResponse(response => response.url() === url && response.request().method() === 'PATCH');
    await cardSelector(page, issue).selectOption(rejected.id);
    const request = await requestPromise;
    assert.deepEqual(request.postDataJSON(), { expectedVersion: before.version, statusId: rejected.id });
    const concurrent = await api('/issues/' + issue.identifier, 'PATCH', {
      expectedVersion: before.version, statusId: currentStatus.id, title: before.title + ' current',
    });
    release();
    const response = await responsePromise;
    assert.equal(response.status(), 409, 'The genuine server refuses the old version');
    const conflict = await response.json();
    assert.equal(conflict.error, 'stale_version');
    assert.equal(conflict.issue.status.id, currentStatus.id);
    assert.equal(conflict.issue.version, concurrent.version);
    assert.equal(conflict.issue.title, concurrent.title);
    await recovered(page, concurrent, outside);
    const alert = page.getByRole('alert').filter({ has: page.locator('strong', { hasText: issue.identifier }) });
    assert((await alert.textContent()).includes(currentStatus.name), 'The notice names the current server status');
    if (!outside) assert.equal(await page.locator('#issue-row-' + issue.identifier + ' strong').textContent(), concurrent.title);
    const persisted = await api('/issues/' + issue.identifier);
    assert.equal(persisted.status.id, currentStatus.id);
    assert.equal(persisted.version, concurrent.version, 'Rejected move writes no version');
    assert.equal(persisted.activity.length, concurrent.activity.length, 'Rejected move writes no activity');
    await settleReads(page);
    return persisted;
  } finally {
    release();
    await page.unroute(url, hold);
    expectedBoardConflicts.delete(url);
  }
}
