import { withOperatorClient } from './operator-request.mjs';
import assert from 'node:assert/strict';
import { beforePrivateNavigation, settleReads } from './collaboration-navigation.mjs';

export async function streamPlanningJourney(page, context, base, record) {
  async function api(path, method = 'GET', data) {
    return withOperatorClient(context, async client => {
      const response = await client.fetch(base + '/api' + path, {
        method, headers: { Origin: base }, ...(data === undefined ? {} : { data }),
      });
      assert(response.ok(), `${method} ${path}: ${response.status()}`);
      return await response.json();
    });
  }
  const options = await api('/options'), team = options.teams[0];
  const started = options.statuses.find(row => row.teamId === team.id && row.category === 'started');
  const fixtures = [];
  for (const title of ['Preserve checkout details', 'Explain payment failures']) fixtures.push(await api('/issues', 'POST', {
    teamId: team.id, statusId: started.id, title: `${title} ${Date.now()}`, assigneeOperatorId: options.operator.id,
  }));
  for (const [path, detailPrefix] of [['/app', '/app/current/'], ['/app/my-work', '/app/my-work/']]) {
    await api('/preferences/' + (path === '/app' ? 'current' : 'my-work'), 'DELETE');
    await beforePrivateNavigation(page, base + path);
    await page.goto(base + path);
    const first = page.locator('#issue-row-' + fixtures[0].identifier);
    await first.waitFor();
    await page.waitForFunction(() => [...document.querySelectorAll('.stream-row')].every(row => !row.disabled));
    const order = await page.locator('.stream-row').evaluateAll(rows => rows.map(row => row.dataset.issueIdentifier));
    await first.focus();
    const index = order.indexOf(fixtures[0].identifier), next = order[Math.min(index + 1, order.length - 1)];
    await page.keyboard.press('ArrowDown');
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'issue-row-' + next);
    for (const issue of fixtures) {
      await page.locator('#issue-row-' + issue.identifier).focus();
      await page.keyboard.press('x');
      assert(await page.getByRole('checkbox', { name: 'Select ' + issue.identifier, exact: true }).isChecked());
    }
    await page.keyboard.press('p');
    const dialog = page.getByRole('dialog', { name: 'Change priority', exact: true });
    await dialog.waitFor();
    const priority = path === '/app' ? 'high' : 'urgent';
    const select = dialog.getByRole('combobox', { name: 'Priority', exact: true });
    await select.pressSequentially(priority[0].toUpperCase() + priority.slice(1));
    assert.equal(await select.inputValue(), priority);
    await dialog.getByRole('button', { name: 'Apply changes', exact: true }).focus();
    const [response] = await Promise.all([
      page.waitForResponse(response => response.url() === base + '/api/issues/bulk' && response.request().method() === 'POST'),
      page.keyboard.press('Enter'),
    ]);
    assert.equal(response.status(), 200);
    assert.deepEqual(response.request().postDataJSON().issues.map(row => row.identifier).sort(), fixtures.map(row => row.identifier).sort());
    await dialog.waitFor({ state: 'detached' });
    for (const issue of fixtures) assert.equal((await api('/issues/' + issue.identifier)).priority, priority);
    await first.focus(); await settleReads(page); await page.keyboard.press('Enter');
    await page.waitForURL(url => url.pathname === detailPrefix + fixtures[0].identifier);
    // The default desktop inspector can already show the same heading while
    // route admission is pending. Wait for the explicitly selected pane.
    await page.locator('.stream-workspace.has-mobile-detail').waitFor();
    await page.keyboard.press('Escape');
    await page.waitForURL(url => url.pathname === path);
    await page.waitForFunction(identifier => document.activeElement?.id === 'issue-row-' + identifier, fixtures[0].identifier);
    for (const issue of fixtures) assert(await page.getByRole('checkbox', { name: 'Select ' + issue.identifier, exact: true }).isChecked());
  }
  record('CMD-003-STREAMS', 'Current and My work support rendered-order arrows, X selection, one atomic keyboard edit, and Enter/Escape with selection and row focus preserved.');
  await selectedCommands(page, base, api, record);
}

async function selectedCommands(page, base, api, record) {
  let options = await api('/options');
  if (!options.teams.some(row => row.identifierPrefix === 'KEY')) await api('/settings/teams', 'POST', {
    name: 'Keyboard delivery', identifierPrefix: 'KEY',
  });
  options = await api('/options');
  const source = options.teams.find(row => row.identifierPrefix !== 'KEY');
  const destination = options.teams.find(row => row.identifierPrefix === 'KEY');
  const status = (teamId, category) => options.statuses.find(row => row.teamId === teamId && row.category === category).id;
  const marker = `Selected keyboard moves ${Date.now()}`;
  const started = await api('/issues', 'POST', { teamId: source.id, title: marker + ' execution', statusId: status(source.id, 'started') });
  const intake = await api('/intake', 'POST', { teamId: source.id, title: marker + ' triage' });
  const canonical = await api('/issues', 'POST', { teamId: source.id, title: 'Canonical payment diagnosis' });
  await beforePrivateNavigation(page, base + '/app/issues');
  await page.goto(base + '/app/issues?' + new URLSearchParams({ q: marker, grouping: 'none' }));
  await page.waitForFunction(() => document.querySelectorAll('.issues-row:not(:disabled)').length === 2);
  for (const issue of [started, intake]) {
    await page.locator('#issue-row-' + issue.identifier).focus(); await page.keyboard.press('x');
  }
  await page.keyboard.press('m');
  let dialog = page.getByRole('dialog', { name: 'Move team', exact: true });
  await dialog.getByRole('combobox', { name: 'Target team', exact: true }).pressSequentially(destination.name);
  for (const category of ['started', 'intake']) {
    const select = dialog.getByRole('combobox', { name: 'Target status · ' + category, exact: true });
    const choice = options.statuses.find(row => row.id === status(destination.id, category));
    await select.pressSequentially(choice.name); assert.equal(await select.inputValue(), choice.id);
  }
  let [response] = await Promise.all([
    page.waitForResponse(response => response.url() === base + '/api/issues/bulk/team'),
    dialog.getByRole('button', { name: 'Move selected issues', exact: true }).press('Enter'),
  ]);
  assert.equal(response.status(), 200); await dialog.waitFor({ state: 'detached' });
  for (const original of [started, intake]) {
    const issue = await api('/issues/' + original.identifier);
    assert.equal(issue.team.id, destination.id); assert.equal(issue.status.category, original.status.category);
    assert.equal(issue.activity.filter(row => row.kind === 'issue.team_moved').length, 1);
  }
  await page.locator('#issue-row-' + started.identifier).focus(); await page.keyboard.press('Shift+d');
  dialog = page.getByRole('dialog', { name: 'Duplicate decision', exact: true });
  await dialog.getByRole('textbox', { name: 'Canonical issue identifier', exact: true }).fill(canonical.identifier);
  [response] = await Promise.all([
    page.waitForResponse(response => response.url() === base + '/api/issues/bulk/duplicate'),
    dialog.getByRole('button', { name: 'Mark selected as duplicates', exact: true }).press('Enter'),
  ]);
  assert.equal(response.status(), 200); await dialog.waitFor({ state: 'detached' });
  for (const issue of [started, intake]) assert.equal((await api('/issues/' + issue.identifier)).canonical.identifier, canonical.identifier);
  await page.locator('#issue-row-' + started.identifier).focus(); await page.keyboard.press('Shift+d');
  dialog = page.getByRole('dialog', { name: 'Duplicate decision', exact: true });
  [response] = await Promise.all([
    page.waitForResponse(response => response.url() === base + '/api/issues/bulk/duplicate'),
    dialog.getByRole('button', { name: 'Remove duplicate decision', exact: true }).press('Enter'),
  ]);
  assert.equal(response.status(), 200); await dialog.waitFor({ state: 'detached' });
  for (const original of [started, intake]) {
    const issue = await api('/issues/' + original.identifier);
    assert.equal(issue.canonical, null); assert.equal(issue.status.category, original.status.category);
  }
  record('CMD-004-SELECTED', 'M atomically moves selected Intake and Started issues with explicit category mappings; Shift-D marks and removes their duplicate decisions through one request per action.');
}
