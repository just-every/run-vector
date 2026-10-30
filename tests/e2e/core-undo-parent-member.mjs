import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { inviteReader } from './role-reader-support.mjs';
import { beforePrivateNavigation, settleReads, trackRequests } from './collaboration-navigation.mjs';
import { withOperatorClient } from './operator-request.mjs';

/** An authorized child/parent command never acquires access to private ancestry. */
export async function undoPrivateParentJourney(owner, context, base, record, runtime, api) {
  const suffix = [...randomBytes(7)].map(n => String.fromCharCode(65 + n % 26)).join('');
  const privateTeam = (await api('/settings/teams', 'POST', { name: 'synthetic-vector-2040-' + suffix, identifierPrefix: 'UP' + suffix, isPrivate: true }))
    .teams.find(row => row.identifierPrefix === 'UP' + suffix);
  const options = await api('/options'), team = options.teams.find(row => !row.isPrivate);
  const create = (title, teamId = team.id) => api('/issues', 'POST', { title, teamId });
  const hidden = await create('synthetic-vector-2041', privateTeam.id);
  const parent = await create('synthetic-vector-2042'), other = await create('synthetic-vector-2043');
  const child = await create('synthetic-vector-2044');
  await api('/issues/' + parent.identifier + '/parent', 'PATCH', { expectedVersion: parent.version, parentIdentifier: hidden.identifier });
  const member = await inviteReader({ owner, browser: context.browser(), runtime: { base, ...runtime },
    email: 'synthetic-vector-' + suffix.toLowerCase() + '@vector.test', name: 'synthetic-vector-2045', role: 'member' });
  const { page } = member;
  trackRequests(page);
  const request = (path, method = 'GET', data) => withOperatorClient(member.context, async client => {
    const response = await client.fetch(base + '/api' + path, { method, headers: { Origin: base }, ...(data === undefined ? {} : { data }) });
    return { status: response.status(), body: await response.json(), receipt: response.headers()['x-vector-undo'] };
  });
  const noLeak = value => {
    for (const secret of [hidden.id, hidden.identifier, hidden.title]) assert(!JSON.stringify(value).includes(secret), 'Private ancestor is absent from responses and receipts');
  };
  try {
    const readable = await request('/issues/' + parent.identifier);
    assert.equal(readable.status, 200); assert.equal(readable.body.parent, null); noLeak(readable);
    assert.equal((await request('/issues/' + hidden.identifier)).status, 404);
    await beforePrivateNavigation(page, base + '/app/issues/' + child.identifier);
    await page.goto(base + '/app/issues/' + child.identifier);
    const heading = page.getByRole('heading', { name: child.title, exact: true });
    await heading.waitFor(); await settleReads(page);
    const hierarchy = page.getByRole('region', { name: 'Issue hierarchy', exact: true });
    const notice = page.getByRole('region', { name: 'Issue Undo', exact: true });
    const save = async destination => {
      await settleReads(page);
      await hierarchy.getByRole('button', { name: /^(Set|Change) parent$/ }).click();
      if (destination) {
        await hierarchy.getByRole('searchbox', { name: 'Search parent issues', exact: true }).fill(destination);
        await hierarchy.getByRole('button', { name: 'Search', exact: true }).press('Enter');
        await hierarchy.getByRole('list', { name: 'Matching parent issues' }).getByRole('button').filter({ hasText: destination }).click();
      }
      const [response] = await Promise.all([
        page.waitForResponse(r => new URL(r.url()).pathname === '/api/issues/' + child.identifier + '/parent' && r.request().method() === 'PATCH'),
        hierarchy.getByRole('button', { name: destination ? 'Save parent' : 'Clear parent', exact: true }).press('Enter'),
      ]);
      assert.equal(response.status(), 200); noLeak(await response.json());
      const receipt = JSON.parse(response.headers()['x-vector-undo']); noLeak(receipt);
      assert.deepEqual(receipt.identifiers, [child.identifier]);
      await notice.getByRole('button', { name: 'Undo', exact: true }).waitFor();
      return receipt;
    };
    const reverse = async (receipt, previous, key) => {
      if (key) await heading.click();
      const [response] = await Promise.all([
        page.waitForResponse(r => new URL(r.url()).pathname === '/api/issues/undo'),
        key ? page.keyboard.press(key) : notice.getByRole('button', { name: 'Undo', exact: true }).click(),
      ]);
      assert.equal(response.status(), 200); noLeak(await response.json());
      const restored = await request('/issues/' + child.identifier); noLeak(restored);
      assert.equal(restored.body.parent?.identifier ?? null, previous);
      const activities = restored.body.activity.filter(row => row.nextValue?.undoOf === receipt.actionId);
      assert.equal(activities.length, 1); assert.equal(activities[0].actor, 'synthetic-vector-2045');
      assert.equal((await request('/issues/' + hidden.identifier)).status, 404);
    };
    let receipt = await save(parent.identifier); await reverse(receipt, null);
    await save(parent.identifier);
    receipt = await save(other.identifier); await reverse(receipt, parent.identifier, 'Control+z');
    receipt = await save(null); await reverse(receipt, parent.identifier, 'Meta+z');
    assert.deepEqual(member.errors, []);
    record('ISSUE-020', 'An invited Member sets, changes and clears a readable parent under a private ancestor, receives Undo each time, and reverses through the control, Ctrl-Z and Command-Z with one attributed activity and no private ancestor in any response.');
  } finally { await member.context.close(); }
}
