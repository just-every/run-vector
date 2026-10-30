import assert from 'node:assert/strict';
import { navigate, settleReads, trackRequests, beforePrivateNavigation } from './collaboration-navigation.mjs';
import { inviteReader, readerApi } from './role-reader-support.mjs';
import { roleScreens } from './role-ui-support.mjs';
import { openSavedViewFromPalette } from './core-palette-journey.mjs';
import { withOperatorClient } from './operator-request.mjs';

// The saved definition is shared; issue rows and aggregates always belong to
// the current reader. All fixtures and authority changes use native HTTP doors.
export async function crossTeamViewJourney({ page, context, base, state, sql, evidence, record }) {
  const owner = readerApi(page, base), browser = context.browser();
  const nativeSession = reader => withOperatorClient(reader.context, async client => {
    const response = await client.get(base + '/auth/session');
    assert.equal(response.status(), 200);
    return response.json();
  });
  const marker = 'synthetic-vector-' + Date.now();
  const prefix = marker.slice(-7).replaceAll(/\d/g, digit => String.fromCharCode(65 + Number(digit)));
  const teams = [];
  for (const [index, isPrivate] of [false, false, true].entries()) {
    const name = `${marker}-team-${index}`;
    teams.push((await owner('/settings/teams', 'POST', {
      name, identifierPrefix: String.fromCharCode(65 + index) + prefix, isPrivate,
    })).teams.find(team => team.name === name));
  }
  const [firstTeam, secondTeam, privateTeam] = teams;
  assert.ok(teams.every(Boolean));
  const issues = [];
  for (const [team, title, priority] of [
    [firstTeam, 'first', 'urgent'], [firstTeam, 'second', 'urgent'],
    [secondTeam, 'third', 'urgent'], [secondTeam, 'excluded', 'low'],
    [privateTeam, 'private', 'urgent'],
  ]) issues.push(await owner('/issues', 'POST', { teamId: team.id, title: `${marker} ${title}`, priority }, 201));
  const invited = [];
  const consoleErrors = [], failedRequests = [], externalRequests = [], expectedDenials = new Set();
  const invite = async (role, teams = []) => {
    const name = `${marker}-${role}-${invited.length}`;
    const reader = await inviteReader({ owner: page, browser, runtime: { base, state, sql },
      name, email: [name, 'vector.test'].join(String.fromCharCode(64)), role, teams });
    invited.push(reader);
    trackRequests(reader.page);
    reader.page.on('console', message => {
      if (message.type() === 'error' && !(expectedDenials.has(message.location().url) &&
        /^Failed to load resource: the server responded with a status of (403|404)(?: \([^)]*\))?$/.test(message.text())))
        consoleErrors.push(message.text());
    });
    reader.page.on('requestfailed', request => failedRequests.push(new URL(request.url()).pathname + ':' + request.failure()?.errorText));
    await reader.context.route('**/*', async route => {
      if (new URL(route.request().url()).origin === base) await route.continue();
      else { externalRequests.push(new URL(route.request().url()).origin); await route.abort(); }
    });
    assert.equal((await reader.api('/session')).role, role);
    return reader;
  };
  const inspect = roleScreens(evidence);
  const capture = async (reader, name, region = reader.locator('main:visible').first()) => {
    await settleReads(reader);
    await inspect(reader, region, 'cross-team-view-' + name);
    await reader.setViewportSize({ width: 1440, height: 1000 });
  };
  try {
    const author = await invite('member');
    const member = await invite('member');
    const session = await nativeSession(member);
    assert.ok(session.id);
    assert.notEqual(author.id, member.id, 'Author and reader are different Members');
    assert.notEqual((await nativeSession(author)).id, session.id, 'The reader has an independent genuine session');
    const target = base + '/app/issues?' + new URLSearchParams({ q: marker, priority: 'urgent', team: 'all', sort: 'oldest', grouping: 'team' });
    await navigate(author.page, target);
    await author.page.locator('.issues-browser[data-list-state="ready"]').waitFor();
    await author.page.getByRole('button', { name: 'Save view', exact: true }).click();
    const viewName = marker + ' shared work';
    await author.page.getByRole('textbox', { name: 'View name', exact: true }).fill(viewName);
    await author.page.getByRole('checkbox', { name: 'Shared with workspace', exact: true }).check();
    const created = author.page.waitForResponse(response => response.url() === base + '/api/views' && response.request().method() === 'POST');
    await author.page.getByRole('button', { name: 'Create view', exact: true }).focus();
    await author.page.keyboard.press('Enter');
    const response = await created;
    assert.equal(response.status(), 201);
    const view = await response.json();
    assert.equal(view.isShared, true);
    assert.equal(view.ownerOperatorId, author.id);
    assert.equal(view.query.team, 'all');
    assert.equal(view.query.q, marker);
    assert.equal(view.query.priority, 'urgent');
    assert.equal(view.query.sort, 'oldest');
    assert.equal(view.query.grouping, 'team');
    await author.page.waitForURL(base + '/app/views/' + view.id);
    await settleReads(author.page);
    // Park completed pages so only the reader under test owns live polling.
    await navigate(author.page, base + '/');

    const assertRows = async (reader, expected, hidden = [], saved = true) => {
      const current = reader.page;
      await current.getByRole('heading', { name: saved ? viewName : 'Issues', exact: true }).waitFor();
      await current.locator('.issues-browser[data-list-state="ready"]').waitFor();
      await settleReads(current);
      const rows = await current.locator('.issues-row').evaluateAll(nodes => nodes.map(node => node.dataset.issueIdentifier));
      assert.deepEqual([...rows].sort(), expected.map(issue => issue.identifier).sort(), 'Only matching issues in currently visible teams appear');
      assert.equal(await current.locator('.issues-count').innerText(), `${expected.length} ${expected.length === 1 ? 'issue' : 'issues'}`);
      const groups = current.locator('.issues-group');
      const expectedTeams = teams.filter(team => expected.some(issue => issue.team.id === team.id));
      assert.equal(await groups.count(), expectedTeams.length);
      for (const team of expectedTeams) {
        const group = groups.filter({ has: current.getByRole('heading', { name: new RegExp('^' + team.name + ' ') }) });
        assert.equal(await group.getByRole('heading').innerText(), team.name + ' ' + expected.filter(issue => issue.team.id === team.id).length);
        const actual = await group.locator('.issues-row').evaluateAll(nodes => nodes.map(node => node.dataset.issueIdentifier));
        assert.deepEqual(actual, expected.filter(issue => issue.team.id === team.id).map(issue => issue.identifier), 'Stored oldest sort survives within each team');
      }
      const query = new URLSearchParams(await current.locator('.issues-browser').getAttribute('data-list-query'));
      for (const key of ['q', 'priority', 'sort', 'grouping']) assert.equal(query.get(key), String(view.query[key]));
      assert.equal(query.get('team') ?? 'all', 'all');
      assert.equal(await current.getByRole('searchbox', { name: 'Title or identifier', exact: true }).inputValue(), marker);
      for (const [label, value] of [['Team', 'all'], ['Priority', 'urgent'], ['Sort', 'oldest'], ['Group by', 'team']])
        assert.equal(await current.getByRole('combobox', { name: label, exact: true }).inputValue(), value);
      const text = await current.locator('main:visible').first().innerText();
      for (const issue of hidden) { assert.ok(!text.includes(issue.identifier)); assert.ok(!text.includes(issue.title)); }
      if (saved) assert.deepEqual(await reader.api('/views/' + view.id), view, 'Changing reader authority never edits the shared definition');
      const result = await reader.api('/issues?' + new URLSearchParams({ ...view.query, orderView: saved ? view.id : '' }));
      assert.equal(result.total, expected.length);
      assert.deepEqual(result.issues.map(issue => issue.identifier).sort(), expected.map(issue => issue.identifier).sort());
      const counts = expectedTeams.map(team => ({ key: team.id, name: team.name,
        count: expected.filter(issue => issue.team.id === team.id).length })).sort((a, b) => a.key.localeCompare(b.key));
      for (const groups of [result.groups, result.allGroups])
        assert.deepEqual([...groups].sort((a, b) => a.key.localeCompare(b.key)), counts, 'Both group aggregates use current visibility and the stored filter');
      for (const issue of hidden) {
        assert.ok(!JSON.stringify(result).includes(issue.identifier));
        assert.ok(!JSON.stringify(result).includes(issue.title));
      }
    };
    const publicIssues = issues.slice(0, 3), privateIssue = issues[4];
    await openSavedViewFromPalette(member.page, base, view, (current, palette) => capture(current, 'member-palette', palette));
    await assertRows(member, publicIssues, [issues[3], privateIssue]);
    await capture(member.page, 'member-public-teams');
    // The second team's result is a usable issue, with keyboard return to the
    // same persisted view rather than a separate unfiltered issue list.
    const secondTeamRow = member.page.locator(`[data-issue-identifier="${issues[2].identifier}"]`);
    await secondTeamRow.focus();
    await member.page.keyboard.press('Enter');
    await member.page.waitForURL(base + '/app/views/' + view.id + '/' + issues[2].identifier);
    await member.page.getByRole('heading', { name: issues[2].title, exact: true }).waitFor();
    await settleReads(member.page);
    await member.page.keyboard.press('Escape');
    await member.page.waitForURL(base + '/app/views/' + view.id);
    await member.page.waitForFunction(id => document.activeElement?.id === 'issue-row-' + id, issues[2].identifier);
    await assertRows(member, publicIssues, [issues[3], privateIssue]);

    // Reader-local exploration must neither mutate the author's definition
    // nor replace its saved controls on the next document load.
    await member.page.getByRole('combobox', { name: 'Priority', exact: true }).selectOption('low');
    await member.page.waitForFunction(id => {
      const rows = document.querySelectorAll('.issues-row');
      return rows.length === 1 && rows[0].dataset.issueIdentifier === id;
    }, issues[3].identifier);
    assert.equal(await member.page.locator('.issues-count').innerText(), '1 issue');
    assert.deepEqual(await member.api('/views/' + view.id), view);
    for (const name of ['Update saved controls', 'Delete view'])
      assert.equal(await member.page.getByRole('button', { name, exact: true }).count(), 0);
    const sharedBefore = sql('SELECT * FROM saved_views ORDER BY id');
    expectedDenials.add(base + '/api/views/' + view.id);
    await member.api('/views/' + view.id, 'PATCH', { query: { ...view.query, priority: 'low' } }, 403);
    await member.api('/views/' + view.id, 'DELETE', undefined, 403);
    assert.deepEqual(sql('SELECT * FROM saved_views ORDER BY id'), sharedBefore, 'Another Member cannot change or delete the shared definition');
    await beforePrivateNavigation(member.page, member.page.url());
    assert.equal((await member.page.reload()).status(), 200);
    await assertRows(member, publicIssues, [issues[3], privateIssue]);
    expectedDenials.add(base + '/api/issues/' + privateIssue.identifier);
    await member.api('/issues/' + privateIssue.identifier, 'GET', undefined, 404);
    assert.ok(!JSON.stringify(await member.api('/search?q=' + encodeURIComponent(marker))).includes(privateIssue.identifier));
    await owner(`/settings/teams/${privateTeam.id}/members/${member.id}`, 'PUT', { role: 'member' });
    await beforePrivateNavigation(member.page, member.page.url());
    await member.page.reload();
    await assertRows(member, [...publicIssues, privateIssue], [issues[3]]);
    await capture(member.page, 'private-membership-granted');
    await owner(`/settings/teams/${privateTeam.id}/members/${member.id}`, 'DELETE');
    // The same mounted view must shed withdrawn work on its next native refresh.
    await member.page.waitForFunction(id => !document.querySelector(`[data-issue-identifier="${id}"]`), privateIssue.identifier);
    await assertRows(member, publicIssues, [issues[3], privateIssue]);
    assert.equal((await nativeSession(member)).id, session.id);
    await capture(member.page, 'private-membership-withdrawn');
    await beforePrivateNavigation(member.page, member.page.url());
    await member.page.reload();
    await assertRows(member, publicIssues, [issues[3], privateIssue]);
    await member.api('/issues/' + privateIssue.identifier, 'GET', undefined, 404);
    assert.ok(!JSON.stringify(await member.api('/search?q=' + encodeURIComponent(marker))).includes(privateIssue.identifier));
    await navigate(member.page, base + '/app/issues');
    await openSavedViewFromPalette(member.page, base, view);
    await assertRows(member, publicIssues, [issues[3], privateIssue]);
    assert.equal((await nativeSession(member)).id, session.id, 'Palette reopening retains the same current Member session');
    await navigate(member.page, base + '/');

    const guest = await invite('guest', [firstTeam.id]);
    expectedDenials.add(base + '/api/views/' + view.id);
    await guest.api('/views/' + view.id, 'GET', undefined, 404);
    assert.ok(!(await guest.api('/views')).views.some(candidate => candidate.id === view.id));
    await settleReads(guest.page);
    await guest.page.locator('h1:visible').first().click();
    await guest.page.keyboard.press('Control+k');
    const palette = guest.page.getByRole('dialog', { name: 'Command palette', exact: true });
    await palette.getByRole('textbox').fill(viewName);
    await palette.getByText('No available records or commands match', { exact: false }).waitFor();
    assert.equal(await palette.locator(`[id="palette-view:${view.id}"]`).count(), 0);
    await capture(guest.page, 'guest-shared-view-omitted', palette);
    await palette.getByRole('textbox').press('Escape');
    await palette.waitFor({ state: 'detached' });
    await navigate(guest.page, target);
    await assertRows(guest, issues.slice(0, 2), [issues[2], issues[3], privateIssue], false);
    assert.deepEqual((await guest.api('/options')).teams.map(team => team.id), [firstTeam.id]);
    expectedDenials.add(base + '/api/issues/' + issues[2].identifier);
    await guest.api('/issues/' + issues[2].identifier, 'GET', undefined, 404);
    await capture(guest.page, 'guest-invited-team');
    await navigate(guest.page, base + '/');

    const viewer = await invite('viewer');
    await openSavedViewFromPalette(viewer.page, base, view);
    await assertRows(viewer, publicIssues, [issues[3], privateIssue]);
    for (const name of ['Save view', 'Duplicate view', 'Update saved controls', 'Delete view'])
      assert.equal(await viewer.page.getByRole('button', { name, exact: true }).count(), 0);
    const before = sql(`SELECT * FROM saved_views ORDER BY id`);
    for (const [path, method, data] of [
      ['/views', 'POST', { name: marker + ' refused', query: {} }],
      ['/views/' + view.id, 'PATCH', { name: marker + ' refused' }],
      ['/views/' + view.id, 'DELETE', undefined],
      ['/views/' + view.id + '/duplicate', 'POST', { name: marker + ' refused' }],
    ]) {
      expectedDenials.add(base + '/api' + path);
      await viewer.api(path, method, data, 403);
    }
    assert.deepEqual(sql(`SELECT * FROM saved_views ORDER BY id`), before, 'Viewer writes leave every saved definition unchanged');
    await capture(viewer.page, 'viewer-read-only');
    for (const reader of invited) assert.deepEqual(reader.errors, [], 'No browser hydration errors');
    assert.deepEqual(consoleErrors, []);
    assert.deepEqual(failedRequests, []);
    assert.deepEqual(externalRequests, []);
    record('VIEW-009', 'Member saves a shared filtered cross-team issue view; a second Member opens it by keyboard palette, opens a second-team issue and returns by keyboard, explores a local filter, and reloads with both public teams, exact identifiers, totals, group counts and stored query restored. Non-owner writes are refused without changing saved definitions. Current private membership grants and withdraws rows without changing the definition or session, including reopening from the palette after withdrawal. An invited Guest cannot open the workspace-wide shared view and their equivalent issue query stays scoped; a Viewer is read-only with unchanged storage. Palette and view screens pass accessibility and overflow proof at 1440 and 390.');
    console.log('PROBE VIEW-009 shared-cross-team: saved view and second Member palette -> two public teams, 3 filtered issues, counts and query retained after reload');
    console.log('PROBE VIEW-009 visibility: same saved view and Member session -> 3 public, 4 with private membership, 3 after withdrawal; Guest shared view 404 and scoped query 2; Viewer mutations 403 with unchanged views');
    console.log('PROBE VIEW-009 persisted-controls: second Member keyboard detail and return, then local low-priority filter -> 1 issue; shared PATCH and DELETE 403 with unchanged views; reload restores 3 urgent issues and saved query; palette reopening after withdrawal remains scoped');
  } finally {
    for (const reader of invited) await reader.context.close();
  }
}
