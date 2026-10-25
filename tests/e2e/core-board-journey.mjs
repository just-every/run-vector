import assert from 'node:assert/strict';
import { settleReads } from './collaboration-navigation.mjs';
import {
  boardApi, boardFixture, boardColumn, boardSnapshot, cardSelector,
  chooseSourceColumn, moveBoardCard, openBoard, ordinaryCategories, priorities,
  readyBoard, rejectStaleBoardMove, openCardMove,
} from './core-board-support.mjs';

export async function boardJourney(page, context, base, record, capture) {
  const api = boardApi(context, base);
  const fixture = await boardFixture(api);
  const { marker, team, empty, statuses, status, review, mover, intake, duplicate, completed } = fixture;
  const shot = async (name, width) => { if (capture) await capture(page, name, width); };
  await api('/preferences/board', 'DELETE');

  const priorityQuery = { q: marker + ' priority', team: team.id, sort: 'priority' };
  const priorityList = await api('/issues?' + new URLSearchParams(priorityQuery));
  assert.equal(priorityList.pageSize, 50, 'Ordinary list requests default to 50');
  assert.deepEqual(priorityList.issues.map(row => row.priority), [...priorities, 'none']);
  assert.equal(priorityList.issues.find(row => row.identifier === fixture.omitted.identifier).priority, 'none');
  for (const original of fixture.priorityIssues) {
    assert.equal(priorityList.issues.find(row => row.identifier === original.identifier).priority, original.priority);
  }
  const invalidSize = await context.request.get(base + '/api/issues?pageSize=51');
  assert.equal(invalidSize.status(), 400, 'Only the bounded public page sizes are accepted');

  await page.setViewportSize({ width: 1440, height: 1000 });
  await openBoard(page, base, { q: marker });
  const metadata = await api('/metadata');
  const preferred = metadata.teams.find(team => !team.archivedAt && team.members.some(member => member.operatorId === metadata.viewer.id));
  assert.equal(await page.getByLabel('Team', { exact: true }).inputValue(), preferred.id);
  assert((await page.locator('.board-column').count()) > 0, 'The default team opens its workflow board');
  const choices = await page.getByLabel('Team', { exact: true }).locator('option').evaluateAll(nodes => nodes.map(node => node.value));
  assert(choices.includes(team.id) && choices.includes(empty.id));
  await shot('board-choose-team', 1440);
  await page.getByLabel('Team', { exact: true }).selectOption(team.id);
  await readyBoard(page, { team: team.id, pageSize: 100, grouping: 'status' });
  const first = await boardSnapshot(page, api, statuses);
  assert.equal(first.total, fixture.issues.length);
  assert(first.total > first.pageSize, 'Public fixture reaches beyond the first 100 cards');
  assert.equal(first.issues.length, 100);
  assert(!first.issues.some(row => row.identifier === completed.identifier));
  assert.equal(first.statusCounts.find(row => row.key === status('completed').id)?.count ?? 0, 0);
  assert.equal(await boardColumn(page, review).locator('.board-card').count(), 0, 'An authored empty status remains a column');
  await shot('board-workflow-empty-status', 1440);
  await page.getByRole('navigation', { name: 'Issue pages', exact: true }).getByRole('button', { name: 'Next', exact: true }).click();
  await readyBoard(page, { offset: 100 });
  const second = await boardSnapshot(page, api, statuses);
  assert.equal(second.total, first.total);
  assert.equal(second.issues.length, first.total - first.pageSize);
  assert.deepEqual(new Set([...first.issues, ...second.issues].map(row => row.identifier)), new Set(fixture.issues.map(row => row.identifier)));
  assert.equal(await page.getByRole('navigation', { name: 'Issue pages', exact: true }).getByRole('button', { name: 'Next', exact: true }).count(), 0);
  await shot('board-page-beyond-100', 1440);
  await page.getByRole('navigation', { name: 'Issue pages', exact: true }).getByRole('button', { name: 'Previous', exact: true }).click();
  await readyBoard(page, { offset: 0 });

  // Both team controls share the filter reducer, including its status reset.
  for (const control of ['Team']) {
    await page.getByLabel('Status', { exact: true }).selectOption(status('backlog').id);
    await readyBoard(page, { status: status('backlog').id });
    await page.getByLabel(control, { exact: true }).selectOption(empty.id);
    await readyBoard(page, { team: empty.id, status: 'all', offset: 0 });
    assert.equal(await page.getByLabel('Status', { exact: true }).inputValue(), 'all');
    const emptyStatuses = (await api('/options')).statuses.filter(row => row.teamId === empty.id).sort((a, b) => a.position - b.position);
    const emptyPage = await boardSnapshot(page, api, emptyStatuses);
    assert.equal(emptyPage.total, 0);
    assert.equal(await page.locator('.board-card').count(), 0);
    await shot('board-empty-team-' + control.toLowerCase().replace(' ', '-'), 1440);
    await page.getByLabel(control, { exact: true }).selectOption(team.id);
    await readyBoard(page, { team: team.id, status: 'all' });
    assert.equal((await boardSnapshot(page, api, statuses)).total, fixture.issues.length);
  }
  await shot('board-team-switch-restored', 1440);
  await page.getByLabel('Title or identifier', { exact: true }).fill(priorityQuery.q);
  await readyBoard(page, { q: priorityQuery.q });
  await page.getByLabel('Sort', { exact: true }).selectOption('priority');
  await readyBoard(page, priorityQuery);
  const sorted = await boardSnapshot(page, api, statuses);
  assert.deepEqual(sorted.issues.map(row => row.priority), [...priorities, 'none']);
  assert.deepEqual(await boardColumn(page, status('backlog')).locator('.board-card-open small:first-child').allTextContents(), sorted.issues.map(row => row.identifier));
  record('ISSUE-003', 'The public create API persists all five explicit priorities and omitted priority as none; ordinary-list and rendered-board priority sort place urgent, high, medium, low, then both No priority issues.');

  await page.getByLabel('Title or identifier', { exact: true }).fill(marker + ' route');
  await readyBoard(page, { q: marker + ' route' });
  const routePage = await boardSnapshot(page, api, statuses);
  assert.equal(routePage.total, 3);
  const legalTargets = statuses.filter(row => ordinaryCategories.has(row.category)).map(row => row.id);
  assert.deepEqual(await cardSelector(page, mover).locator('option').evaluateAll(nodes => nodes.map(node => node.value)), legalTargets);
  for (const decisionIssue of [intake, duplicate]) {
    assert.equal(await cardSelector(page, decisionIssue).count(), 0, 'Intake and duplicate cards cannot perform ordinary transitions');
    const decision = page.getByRole('button', { name: 'Review decision for ' + decisionIssue.identifier, exact: true });
    assert(await decision.isVisible());
    await shot('board-' + decisionIssue.status.category + '-decision', 1440);
    await decision.focus();
    await settleReads(page);
    await page.keyboard.press('Enter');
    await page.waitForURL(url => url.pathname === '/app/board/' + decisionIssue.identifier);
    await page.getByRole('heading', { name: decisionIssue.title, exact: true }).waitFor();
    await settleReads(page);
    await page.keyboard.press('Escape');
    await page.waitForURL(url => url.pathname === '/app/board');
    await readyBoard(page, { team: team.id });
  }
  for (const [source, destination] of [
    [mover, status('intake')], [mover, status('duplicate')],
    [intake, status('started')], [duplicate, status('started')],
  ]) {
    const response = await context.request.patch(base + '/api/issues/' + source.identifier, {
      headers: { Origin: base }, data: { expectedVersion: source.version, statusId: destination.id },
    });
    assert.equal(response.status(), 409, 'Decision rules remain enforced at the real mutation door');
    const unchanged = await api('/issues/' + source.identifier);
    assert.equal(unchanged.version, source.version);
    assert.equal(unchanged.status.id, source.status.id);
    assert.equal(unchanged.activity.length, source.activity.length);
  }

  const moves = [];
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    if (width === 390) {
      const picker = page.getByLabel('Board column', { exact: true });
      assert(await picker.isVisible());
      assert.deepEqual(await picker.locator('option').evaluateAll(nodes => nodes.map(node => node.value)), statuses.map(row => row.id));
      for (const decisionIssue of [intake, duplicate]) {
        await chooseSourceColumn(page, decisionIssue, width);
        assert(await page.getByRole('button', { name: 'Review decision for ' + decisionIssue.identifier, exact: true }).isVisible());
        assert.equal(await page.locator('.board-column:visible').count(), 1);
        await shot('board-mobile-' + decisionIssue.status.category + '-decision', width);
      }
    }
    const moved = await moveBoardCard(page, base, api, mover, review, width);
    await shot('board-legal-move-' + width, width);
    const current = await rejectStaleBoardMove(page, base, api, mover, status('backlog'), status(width === 390 ? 'canceled' : 'unstarted'), width);
    assert.notEqual(current.status.id, status('backlog').id);
    assert.equal(current.version, moved.version + 1);
    assert.deepEqual(await cardSelector(page, mover).locator('option').evaluateAll(nodes => nodes.map(node => node.value)), legalTargets);
    await boardSnapshot(page, api, statuses);
    assert(await boardColumn(page, current.status).evaluate(node => node.classList.contains('is-current')));
    await shot('board-stale-recovery-' + width, width);
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'Board stays within the viewport');
    moves.push({ width, acceptedVersion: moved.version, conflictVersion: current.version, currentStatus: current.status.id });
  }

  // A stale server receipt can also leave the default page: retain rejection,
  // select its actual column, and place focus on the notice's issue action.
  const hidden = await rejectStaleBoardMove(page, base, api, mover, status('unstarted'), status('completed'), 390, true);
  assert.equal(await cardSelector(page, mover).count(), 0);
  assert.equal(await page.locator('#issue-row-' + completed.identifier).count(), 0);
  assert.equal((await boardSnapshot(page, api, statuses)).total, 2);
  await shot('board-stale-completed-hidden', 390);
  await page.getByLabel('Status category', { exact: true }).selectOption('completed');
  await readyBoard(page, { category: 'completed' });
  const explicit = await boardSnapshot(page, api, statuses);
  assert.deepEqual(new Set(explicit.issues.map(row => row.identifier)), new Set([completed.identifier, hidden.identifier]));
  await openCardMove(page, completed);
  await openCardMove(page, hidden);
  assert(await cardSelector(page, completed).isVisible());
  assert(await cardSelector(page, hidden).isVisible());
  await shot('board-completed-explicitly-shown', 390);
  await settleReads(page);
  await page.setViewportSize({ width: 1440, height: 1000 });
  record('VIEW-005', '1440/390 browser board uses an explicit team, authored empty columns, matching full-result totals and 100-card paging; card moves are version checked, real stale409s preserve the server issue and restore destination focus/column, including a hidden completed receipt; decision cards open detail and completed work appears only when requested.');
  return { moves, total: first.total, omittedPriority: fixture.omitted.identifier, hiddenVersion: hidden.version };
}
