import assert from 'node:assert/strict';
import { navigate, settleReads, trackRequests, beforePrivateNavigation } from './collaboration-navigation.mjs';
import { inviteReader, readerApi } from './role-reader-support.mjs';
import { roleScreens } from './role-ui-support.mjs';

export async function booleanFilterJourney({ page, context, base, state, sql, evidence, record }) {
  const owner = readerApi(page, base), browser = context.browser();
  const marker = 'synthetic-vector-' + Date.now();
  const prefix = marker.slice(-7).replaceAll(/\d/g, digit => String.fromCharCode(65 + Number(digit)));
  const team = (await owner('/settings/teams', 'POST', { name: marker, identifierPrefix: 'B' + prefix })).teams.find(t => t.name === marker);
  const outside = (await owner('/settings/teams', 'POST', { name: marker + '-outside', identifierPrefix: 'C' + prefix })).teams.find(t => t.name === marker + '-outside');
  const privateTeam = (await owner('/settings/teams', 'POST', { name: marker + '-private', identifierPrefix: 'D' + prefix, isPrivate: true })).teams.find(t => t.name === marker + '-private');
  const issues = [];
  for (const [teamId, priority, suffix] of [
    [team.id, 'high', 'high'], [outside.id, 'urgent', 'urgent'], [team.id, 'low', 'low'],
    [team.id, 'high', 'blocked-high'], [team.id, 'urgent', 'blocked-urgent'], [privateTeam.id, 'urgent', 'private'],
  ]) issues.push(await owner('/issues', 'POST', { teamId, priority, title: marker + '-' + suffix }, 201));
  for (const blocked of issues.slice(3, 5)) {
    const blocker = await owner('/issues/' + issues[2].identifier);
    await owner('/issues/' + blocked.identifier + '/dependencies', 'POST', {
      expectedVersion: blocked.version, relatedIdentifier: blocker.identifier, relatedVersion: blocker.version, direction: 'blocked-by',
    });
  }
  const readers = [], consoleErrors = [], failed = [], external = [], denials = new Set();
  const invite = async (role, teams = []) => {
    const name = marker + '-' + role;
    const reader = await inviteReader({ owner: page, browser, runtime: { base, state, sql }, name,
      email: [name, 'vector.test'].join(String.fromCharCode(64)), role, teams });
    readers.push(reader); trackRequests(reader.page);
    reader.page.on('console', message => {
      if (message.type() === 'error' && !(denials.has(message.location().url) && /^Failed to load resource: the server responded with a status of (403|404)(?: \([^)]*\))?$/.test(message.text()))) consoleErrors.push(message.text());
    });
    reader.page.on('requestfailed', request => failed.push(new URL(request.url()).pathname + ':' + request.failure()?.errorText));
    await reader.context.route('**/*', async route => {
      if (new URL(route.request().url()).origin === base) await route.continue();
      else { external.push(new URL(route.request().url()).origin); await route.abort(); }
    });
    return reader;
  };
  const expression = '(priority=high OR priority=urgent) AND NOT blocked';
  const canonical = '(' + expression + ')';
  const target = base + '/app/issues?' + new URLSearchParams({ q: marker, sort: 'oldest' });
  const inspect = roleScreens(evidence);
  async function rows(reader, expected) {
    await reader.page.locator('.issues-browser[data-list-state="ready"]').waitFor();
    await settleReads(reader.page);
    const actual = await reader.page.locator('.issues-row').evaluateAll(nodes => nodes.map(node => node.dataset.issueIdentifier));
    assert.deepEqual(actual.sort(), expected.map(i => i.identifier).sort());
    assert.equal(await reader.page.locator('.issues-count').innerText(), `${expected.length} ${expected.length === 1 ? 'issue' : 'issues'}`);
  }
  try {
    const member = await invite('member'), current = member.page;
    await navigate(current, target);
    await rows(member, issues.slice(0, 5));
    await current.locator('.boolean-filters > summary').click();
    const bar = current.getByRole('combobox', { name: 'Filter expression', exact: true });
    await bar.fill('(priority=high OR priority=urgent)');
    await bar.pressSequentially(' AND NOT blocked');
    assert.equal(new URL(current.url()).pathname, '/app/issues', 'Typing expressions preserves list keyboard navigation');
    await bar.press('Enter');
    await current.waitForURL(url => url.searchParams.get('expression') === expression);
    await rows(member, issues.slice(0, 2));
    const typed = await member.api('/issues?' + new URLSearchParams({ q: marker, expression }));
    assert.equal(typed.total, 2);
    assert.deepEqual(typed.issues.map(i => i.identifier).sort(), issues.slice(0, 2).map(i => i.identifier).sort());
    for (const invalid of ['priority=critical', '(priority=high OR)', 'team=all']) {
      await bar.fill(invalid); await bar.press('Enter');
      await current.locator('.boolean-filters [role="alert"]').waitFor();
      assert.equal(new URL(current.url()).searchParams.get('expression'), expression);
      await rows(member, issues.slice(0, 2));
    }
    await bar.fill(expression); await bar.press('Enter');
    await inspect(current, current.locator('.issues-browser'), 'boolean-typed');
    await current.setViewportSize({ width: 1440, height: 1000 });
    await current.getByRole('button', { name: 'Clear expression', exact: true }).click();
    await current.waitForURL(url => !url.searchParams.has('expression'));
    await current.locator('.boolean-filters details > summary').click();
    await current.getByRole('combobox', { name: 'Condition 1', exact: true }).selectOption('and');
    await current.getByRole('combobox', { name: 'Condition 1.1', exact: true }).selectOption('or');
    await current.getByRole('combobox', { name: 'Priority 1.1.1', exact: true }).selectOption('high');
    await current.getByRole('combobox', { name: 'Priority 1.1.2', exact: true }).selectOption('urgent');
    await current.getByRole('combobox', { name: 'Condition 1.2', exact: true }).selectOption('not');
    assert.equal(await current.getByRole('combobox', { name: 'Condition 1.2.1', exact: true }).inputValue(), 'blocked');
    assert.equal(await current.getByLabel('Menu expression', { exact: true }).innerText(), canonical);
    await current.getByRole('button', { name: 'Apply menu filter', exact: true }).focus();
    await current.keyboard.press('Enter');
    await current.waitForURL(url => url.searchParams.get('expression') === canonical);
    await rows(member, issues.slice(0, 2));
    const menu = await member.api('/issues?' + new URLSearchParams({ q: marker, expression: canonical }));
    assert.deepEqual(menu.issues.map(i => i.identifier).sort(), typed.issues.map(i => i.identifier).sort());
    assert.equal(menu.total, typed.total);
    await inspect(current, current.locator('.boolean-filters'), 'boolean-menu');
    await current.setViewportSize({ width: 1440, height: 1000 });
    await current.getByRole('button', { name: 'Save view', exact: true }).click();
    const name = marker + ' Boolean work';
    await current.getByRole('textbox', { name: 'View name', exact: true }).fill(name);
    await current.getByRole('checkbox', { name: 'Shared with workspace', exact: true }).check();
    const saved = current.waitForResponse(response => response.url() === base + '/api/views' && response.request().method() === 'POST');
    await current.getByRole('button', { name: 'Create view', exact: true }).click();
    const response = await saved; assert.equal(response.status(), 201);
    const view = await response.json(); assert.equal(view.query.expression, canonical);
    await current.waitForURL(base + '/app/views/' + view.id);
    await rows(member, issues.slice(0, 2));
    await beforePrivateNavigation(current, current.url()); await current.reload();
    await rows(member, issues.slice(0, 2));
    assert.equal(await current.getByRole('combobox', { name: 'Filter expression', exact: true }).inputValue(), canonical);
    assert.equal((await member.api('/views/' + view.id)).query.expression, canonical);
    await owner(`/settings/teams/${privateTeam.id}/members/${member.id}`, 'PUT', { role: 'member' });
    await current.waitForFunction(id => !!document.querySelector(`[data-issue-identifier="${id}"]`), issues[5].identifier);
    await rows(member, [...issues.slice(0, 2), issues[5]]);
    await owner(`/settings/teams/${privateTeam.id}/members/${member.id}`, 'DELETE');
    await current.waitForFunction(id => !document.querySelector(`[data-issue-identifier="${id}"]`), issues[5].identifier);
    await rows(member, issues.slice(0, 2));
    assert.deepEqual(await member.api('/views/' + view.id), view, 'Membership withdrawal never rewrites the expression');
    await inspect(current, current.locator('.issues-browser'), 'boolean-saved-reopened');
    await navigate(current, base + '/');
    const guest = await invite('guest', [team.id]);
    await navigate(guest.page, target + '&expression=' + encodeURIComponent(canonical));
    await rows(guest, [issues[0]]);
    assert.ok(!(await guest.page.locator('main:visible').innerText()).includes(issues[5].identifier));
    await navigate(guest.page, base + '/');
    const viewer = await invite('viewer');
    await navigate(viewer.page, base + '/app/views/' + view.id);
    await rows(viewer, issues.slice(0, 2));
    assert.equal(await viewer.page.getByRole('button', { name: 'Save view', exact: true }).count(), 0);
    assert.equal(await viewer.page.getByRole('button', { name: 'Save changes', exact: true }).count(), 0);
    const before = sql('SELECT * FROM saved_views ORDER BY id');
    for (const [path, method, data] of [
      ['/views', 'POST', { name: marker, query: view.query }], ['/views/' + view.id, 'PATCH', { query: { expression: 'blocked' } }],
      ['/views/' + view.id, 'DELETE', undefined],
    ]) { denials.add(base + '/api' + path); await viewer.api(path, method, data, 403); }
    assert.deepEqual(sql('SELECT * FROM saved_views ORDER BY id'), before);
    assert.deepEqual(consoleErrors, []); assert.deepEqual(failed, []); assert.deepEqual(external, []);
    for (const reader of readers) assert.deepEqual(reader.errors, [], 'No hydration errors');
    record('SEARCH-004', 'Typed and menu Boolean filters yield the same exact rows and totals, reject unsupported terms visibly, preserve keyboard input and reopen a saved expression unchanged. Current private-team withdrawal, invited Guest scope and Viewer read-only admission remain enforced. Changed screens captured at 1440 and 390 with accessibility and overflow checks.');
    console.log('PROBE SEARCH-004 bar-menu: typed and menu expression -> identical 2 public issues, private issue omitted, exact totals');
    console.log('PROBE SEARCH-004 saved-reload: save and reopen -> expression unchanged, 2 issues; private membership 3 then withdrawal 2, Guest 1, Viewer writes 403 unchanged');
  } finally { for (const reader of readers) await reader.context.close(); }
}
