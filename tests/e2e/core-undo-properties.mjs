import { withOperatorClient } from './operator-request.mjs';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { verificationDirectory } from '../../scripts/verification-paths.mjs';
import { beforePrivateNavigation, settleReads } from './collaboration-navigation.mjs';

export const expectedUndoConflicts = new Set();

export async function undoPropertiesJourney(page, context, base, record) {
  const api = async (path, method = 'GET', data) => {
    return withOperatorClient(context, async client => {
      const response = await client.fetch(base + '/api' + path, {
        method, headers: { Origin: base }, ...(data === undefined ? {} : { data }),
      });
      assert(response.ok(), `${method} ${path}: ${response.status()} ${await response.text()}`);
      return await response.json();
    });
  };
  const width = page.viewportSize().width, marker = 'Payment retry ' + Date.now();
  const suffix = [...randomBytes(7)].map(n => String.fromCharCode(65 + n % 26)).join('');
  await api('/settings/teams', 'POST', { name: marker + ' Delivery', identifierPrefix: 'US' + suffix });
  const teams = await api('/settings/teams', 'POST', { name: marker + ' Platform', identifierPrefix: 'UD' + suffix });
  const team = teams.teams.find(row => row.identifierPrefix === 'US' + suffix);
  const destination = teams.teams.find(row => row.identifierPrefix === 'UD' + suffix);
  const options = await api('/options');
  const status = category => options.statuses.find(row => row.teamId === team.id && row.category === category);
  const labels = await api('/settings/labels', 'POST', { name: marker + ' reliability', color: '#2563eb' });
  const label = labels.labels.find(row => row.name === marker + ' reliability');
  await api('/settings/cycles', 'POST', { teamId: team.id, name: marker + ' cycle', startsLocal: '2027-04-05T09:00', endsLocal: '2027-04-12T09:00', capacity: 20 });
  const cycle = (await api('/options')).cycles.find(row => row.name === marker + ' cycle');
  const issue = await api('/issues', 'POST', { teamId: team.id, title: marker, description: 'A retry after a timeout must keep the original payment identifier.', statusId: status('started').id, priority: 'low' });
  const read = () => api('/issues/' + issue.identifier);
  const notice = page.getByRole('region', { name: 'Issue Undo', exact: true });
  const evidence = verificationDirectory + '/issue-undo';
  await mkdir(evidence, { recursive: true });
  const capture = name => page.screenshot({ path: `${evidence}/${name}-${width}.png`, fullPage: true });
  await beforePrivateNavigation(page, base + '/app/issues/' + issue.identifier);
  await page.goto(base + '/app/issues/' + issue.identifier);
  await page.getByRole('heading', { name: marker, exact: true }).waitFor();
  async function saved(action, path = '/api/issues/' + issue.identifier, method = 'PATCH') {
    const [response] = await Promise.all([
      page.waitForResponse(r => new URL(r.url()).pathname === path && r.request().method() === method), action(),
    ]);
    assert.equal(response.status(), 200);
    assert(response.headers()['x-vector-undo']);
    await notice.getByRole('button', { name: 'Undo', exact: true }).waitFor();
    return response;
  }
  async function reverse(before, key) {
    if (key) await page.getByRole('heading', { name: marker, exact: true }).click();
    const [response] = await Promise.all([
      page.waitForResponse(r => new URL(r.url()).pathname === '/api/issues/undo'),
      key ? page.keyboard.press(key) : notice.getByRole('button', { name: 'Undo', exact: true }).click(),
    ]);
    assert.equal(response.status(), 200);
    const current = await read();
    for (const field of ['status', 'priority', 'assignee', 'labels', 'cycle', 'team', 'completedAt', 'canceledAt'])
      assert.deepEqual(current[field], before[field], `Undo restores ${field}`);
    assert.equal(current.version, before.version + 2);
    assert.equal(current.activity.filter(row => row.nextValue?.undoOf).length, before.activity.filter(row => row.nextValue?.undoOf).length + 1);
    await settleReads(page);
  }
  for (const [name, value, key] of [
    ['status', status('completed').id, null], ['assignee', options.operator.id, 'Control+z'],
    ['priority', 'urgent', 'Meta+z'], ['cycle', cycle.id, null],
  ]) {
    const before = await read();
    await saved(() => page.getByLabel('Issue ' + name, { exact: true }).selectOption(value));
    if (name === 'status') await capture('status-offer');
    await reverse(before, key);
  }
  let before = await read();
  await page.getByRole('button', { name: /^Labels(?: · \d+)?$/ }).click();
  await page.getByRole('checkbox', { name: label.name, exact: true }).check();
  await saved(() => page.getByRole('button', { name: 'Save labels', exact: true }).click());
  await reverse(before);
  await saved(() => page.getByLabel('Issue cycle', { exact: true }).selectOption(cycle.id));
  await settleReads(page);
  before = await read();
  await page.getByText('Move team', { exact: true }).click();
  await page.getByRole('combobox', { name: /^Target team/ }).selectOption(destination.id);
  await page.getByRole('combobox', { name: /^Target status/ }).selectOption(destination.statuses.find(row => row.category === 'started').id);
  await saved(() => page.getByRole('button', { name: 'Move issue', exact: true }).click(), '/api/issues/' + issue.identifier + '/team', 'POST');
  assert.equal((await read()).cycle, null);
  await reverse(before);
  assert.equal(await page.locator('.team-move > [role="status"]').count(), 0, 'Undo removes the superseded move confirmation');
  await capture('team-cycle-restored');

  before = await read();
  await saved(() => page.getByLabel('Issue priority', { exact: true }).selectOption('high'));
  const concurrent = await read();
  await api('/issues/' + issue.identifier, 'PATCH', { expectedVersion: concurrent.version, title: marker + ' clarified elsewhere' });
  const untouched = await read(), conflictUrl = base + '/api/issues/undo';
  expectedUndoConflicts.add(conflictUrl);
  try {
    const [response] = await Promise.all([
      page.waitForResponse(r => r.url() === conflictUrl), notice.getByRole('button', { name: 'Undo', exact: true }).click(),
    ]);
    assert.equal(response.status(), 409);
    await notice.getByRole('alert').waitFor();
    assert.match(await notice.innerText(), new RegExp(issue.identifier));
    assert.deepEqual(await read(), untouched, 'A stale Undo changes no issue or activity');
    await capture('stale-refusal');
  } finally { expectedUndoConflicts.delete(conflictUrl); }
  await beforePrivateNavigation(page, page.url());
  await page.reload();
  await page.getByRole('heading', { name: untouched.title, exact: true }).waitFor();
  await saved(() => page.getByLabel('Issue priority', { exact: true }).selectOption('medium'));
  const retained = await read();
  await notice.getByRole('button', { name: 'Undo', exact: true }).waitFor({ state: 'detached', timeout: 12_000 });
  const requests = [];
  const watch = request => { if (request.url() === conflictUrl) requests.push(request); };
  page.on('request', watch);
  await page.getByRole('heading', { name: retained.title, exact: true }).click(); await page.keyboard.press('Control+z');
  await page.waitForTimeout(100); page.off('request', watch);
  assert.equal(requests.length, 0, 'Expired keyboard Undo sends no mutation');
  assert.deepEqual(await read(), retained);
  await capture('expired-retained');
  record('ISSUE-020', `${width}px: status/completion timestamps, assignee, priority, labels, cycle and team restore through toast and Ctrl/Cmd-Z; stale Undo refuses atomically; expired keyboard Undo does nothing.`);
}
