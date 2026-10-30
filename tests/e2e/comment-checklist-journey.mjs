import assert from 'node:assert/strict';
import { beforePrivateNavigation, settleReads } from './collaboration-navigation.mjs';
import { readDevelopmentLink } from './outbox-session.mjs';
import { readLocalD1 } from './local-d1-read.mjs';
import { withInvitedOperator } from './core-operator-journey.mjs';

/** Two separate author sign-ins merge stale comment ticks through the real UI. */
export async function commentChecklistJourney(page, context, base, state, teamId, evidence, record) {
  const actorResponse = await context.request.get(base + '/auth/session');
  assert.equal(actorResponse.status(), 200);
  const actor = (await actorResponse.json()).operator;
  const created = await context.request.post(base + '/api/issues', { headers: { Origin: base }, data: { title: 'synthetic-vector-2502', teamId } });
  assert.equal(created.status(), 201);
  const issue = await created.json(), path = `/api/issues/${issue.identifier}`, url = base + '/app/issues/' + issue.identifier;
  const body = '- [ ] Review draft\n- [ ] Publish notes';
  async function open(target) {
    await beforePrivateNavigation(target, url);
    await target.goto(url);
    await target.getByRole('heading', { name: 'Discussion', exact: true }).waitFor();
    await settleReads(target);
  }
  await open(page);
  await page.getByRole('textbox', { name: 'Add a comment', exact: true }).fill(body);
  await page.getByRole('button', { name: 'Add comment', exact: true }).click();
  await page.locator('.comment-body').getByRole('checkbox', { name: 'Review draft', exact: true }).waitFor();
  await settleReads(page);
  const initial = await (await context.request.get(base + path + '/discussion')).json();
  const comment = initial.comments.find(row => row.body === body);
  assert.equal(comment.version, 0);
  const checklist = `${base}${path}/comments/${comment.id}/checklist`;
  const peerContext = await context.browser().newContext({ viewport: { width: 1440, height: 1000 }, extraHTTPHeaders: { Connection: 'close' } });
  const peer = await peerContext.newPage();
  try {
    const sent = await peerContext.request.post(base + '/auth/request', { headers: { Origin: base }, data: { email: actor.email } });
    assert.equal(sent.status(), 202);
    await peer.goto(await readDevelopmentLink(base, peerContext.request, actor.email, state));
    await peer.getByRole('button', { name: 'Confirm', exact: true }).click();
    await peer.waitForURL(base + '/app');
    const second = await (await peerContext.request.get(base + '/auth/session')).json();
    const first = await (await context.request.get(base + '/auth/session')).json();
    assert.equal(second.operator.id, first.operator.id);
    assert.notEqual(second.id, first.id, 'Both browser contexts have independent genuine sessions');
    await open(peer);
    const click = async (target, name) => {
      const pending = target.waitForResponse(response => response.url() === checklist && response.request().method() === 'POST');
      await target.locator('.comment-body').getByRole('checkbox', { name, exact: true }).check();
      const response = await pending;
      assert.equal(response.status(), 200);
      const input = response.request().postDataJSON();
      assert.equal(input.expectedVersion, 0);
      assert.equal(input.expectedBody, body, 'The second session really submits the original stale body');
      await settleReads(target);
    };
    await click(page, 'Review draft');
    await click(peer, 'Publish notes');
    await open(page);
    const boxes = page.locator('.comment-body').getByRole('checkbox');
    assert.equal(await boxes.count(), 2);
    assert.equal(await boxes.nth(0).isChecked(), true);
    assert.equal(await boxes.nth(1).isChecked(), true);
    const current = await (await context.request.get(base + path + '/discussion')).json();
    assert.equal(current.comments.find(row => row.id === comment.id).version, 2);
    assert.equal(current.comments.find(row => row.id === comment.id).body, '- [x] Review draft\n- [x] Publish notes');
    const readIssue = async () => (await (await context.request.get(base + path)).json());
    const changed = await readIssue();
    assert.equal(changed.status.id, issue.status.id);
    assert.equal(changed.version, issue.version);
    const edits = changed.activity.filter(row => row.kind === 'comment.edited' && row.nextValue.id === comment.id);
    assert.deepEqual(edits.map(row => ({ actor: row.actor, revision: row.nextValue.revision, task: row.nextValue.checklist })), [
      { actor: actor.displayName, revision: 1, task: { index: 0, text: 'Review draft', checked: true } },
      { actor: actor.displayName, revision: 2, task: { index: 1, text: 'Publish notes', checked: true } },
    ]);
    assert.equal(readLocalD1(state, `SELECT count(*) n FROM audit_records WHERE subject_id='${comment.id}' AND action='comment.edited'`)[0].n, 2);
    // One assertion width; both release widths get a screen of the changed state.
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
      await page.locator('.comment-body').scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${evidence}/comment-checklist-merged-${width}.png` });
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    const tables = readLocalD1(state, "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT GLOB '_cf_*' AND name NOT IN ('integration_token_usage','access_rate_limits') ORDER BY name");
    const storage = () => Object.fromEntries(tables.map(({ name }) => [name,
      readLocalD1(state, 'SELECT * FROM "' + name.replaceAll('"', '""') + '"').map(row => JSON.stringify(row)).sort()]));
    await page.getByRole('button', { name: 'Edit comment', exact: true }).click();
    await page.getByRole('textbox', { name: 'Edit comment', exact: true }).fill('- [x] Review draft\n- [x] Revised notes');
    await page.getByRole('button', { name: 'Save comment', exact: true }).click();
    await page.locator('.comment-body').getByRole('checkbox', { name: 'Revised notes', exact: true }).waitFor();
    await settleReads(page);
    const beforeConflict = storage();
    const conflict = await peerContext.request.post(checklist, { headers: { Origin: base }, data: { expectedBody: body, expectedVersion: 0, index: 1, text: 'Publish notes', checked: true } });
    assert.equal(conflict.status(), 409);
    assert.deepEqual((await conflict.json()).comment, { id: comment.id, body: '- [x] Review draft\n- [x] Revised notes', version: 3 });
    assert.deepEqual(storage(), beforeConflict);
    await withInvitedOperator(page, context, base, state, async () => {
      await open(page);
      const readOnly = page.locator('.comment-body').getByRole('checkbox');
      assert.equal(await readOnly.count(), 2);
      assert.equal(await readOnly.nth(0).isDisabled(), true);
      assert.equal(await readOnly.nth(1).isDisabled(), true);
      const mint = await context.request.post(base + '/api/settings/integrations/tokens', { headers: { Origin: base }, data: { name: 'synthetic-vector-2503', scopes: ['comments:write'] } });
      assert.equal(mint.status(), 201);
      const token = (await mint.json()).token, beforeRefusal = storage();
      const denied = await context.request.post(checklist.replace('/api/issues/', '/api/v1/issues/'), { headers: { Origin: base, Authorization: 'Bearer ' + token }, data: { expectedBody: body, expectedVersion: 0, index: 0, text: 'Review draft', checked: false } });
      assert.equal(denied.status(), 403);
      assert.deepEqual(storage(), beforeRefusal);
    }, 'synthetic-vector-2504');
    record('ISSUE-025', 'Two genuine author sessions tick independent unchanged comment items from revision zero; both changes and two attributed revision and item activity receipts persist. A changed item returns current text with 409, another author sees read-only boxes and is refused 403 through the scoped API, refused writes change no product storage, and ticks preserve issue status. Screens at 1440 and 390.');
  } finally { await peerContext.close(); }
}
