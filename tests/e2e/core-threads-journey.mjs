import assert from 'node:assert/strict';
import { beforePrivateNavigation, settleReads } from './collaboration-navigation.mjs';
import { withInvitedOperator } from './core-operator-journey.mjs';

const teammate = 'Thread teammate';

/** ISSUE-008: a teammate replies twice and resolves; the author reopens with a reply. */
export async function threadsJourney(page, context, base, state, teamId, evidence, record) {
  const created = await context.request.post(base + '/api/issues', { headers: { Origin: base }, data: { title: `Thread journey ${Date.now()}`, teamId } });
  assert.equal(created.status(), 201);
  const { identifier } = await created.json();
  const url = base + '/app/issues/' + identifier;
  const open = async () => {
    await beforePrivateNavigation(page, url);
    await page.goto(url);
    await page.getByRole('heading', { name: 'Discussion', exact: true }).waitFor();
    await settleReads(page);
  };
  const thread = () => page.getByRole('region', { name: /^Thread started by/ });
  await open();
  await page.getByRole('textbox', { name: 'Add a comment', exact: true }).fill('Which browsers fail to load the report?');
  await page.getByRole('button', { name: 'Add comment', exact: true }).click();
  await thread().getByText('Which browsers fail to load the report?').waitFor();
  const root = (await (await context.request.get(base + `/api/issues/${identifier}/discussion`)).json()).comments[0];

  await withInvitedOperator(page, context, base, state, async () => {
    await open();
    // Another member's comment offers neither editing nor deletion, and the route refuses an edit.
    assert.equal(await thread().getByRole('button', { name: 'Edit comment', exact: true }).count(), 0);
    assert.equal(await thread().getByRole('button', { name: 'Delete comment', exact: true }).count(), 1, 'Workspace Owners delete any comment');
    const refused = await context.request.patch(base + `/api/issues/${identifier}/comments/${root.id}`, { headers: { Origin: base }, data: { body: 'Rewritten by a teammate' } });
    assert.equal(refused.status(), 403);
    for (const reply of ['Safari 18 on macOS', 'Firefox 131 too']) {
      await thread().getByRole('button', { name: 'Reply', exact: true }).click();
      await thread().getByRole('textbox', { name: 'Reply to thread', exact: true }).fill(reply);
      await thread().getByRole('button', { name: 'Post reply', exact: true }).click();
      await thread().getByRole('list', { name: 'Replies' }).getByText(reply).waitFor();
    }
    assert.deepEqual(await thread().getByRole('list', { name: 'Replies' }).locator('.comment-body').allInnerTexts(), ['Safari 18 on macOS', 'Firefox 131 too']);
    await thread().getByRole('button', { name: 'Resolve thread', exact: true }).click();
    const summary = page.getByRole('region', { name: /^Resolved thread/ });
    await summary.getByText(`Resolved by ${teammate}`).waitFor();
    assert.equal(await summary.locator('.comment-entry').count(), 0, 'A resolved thread collapses to one line');
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
      await summary.scrollIntoViewIfNeeded();
      assert.ok((await summary.boundingBox()).width <= width);
      await page.screenshot({ path: `${evidence}/thread-resolved-${width}.png` });
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    await settleReads(page);
  }, teammate);

  await open();
  const summary = page.getByRole('region', { name: /^Resolved thread/ });
  await summary.getByText(`Resolved by ${teammate}`).waitFor();
  await summary.getByRole('button', { name: 'Show thread', exact: true }).click();
  await thread().getByRole('button', { name: 'Reply', exact: true }).click();
  await thread().getByRole('textbox', { name: 'Reply to thread', exact: true }).fill('Fixed in build 42, please retest');
  await thread().getByRole('button', { name: 'Post reply', exact: true }).click();
  await thread().getByRole('button', { name: 'Resolve thread', exact: true }).waitFor();
  assert.equal(await page.getByRole('region', { name: /^Resolved thread/ }).count(), 0, 'A new reply reopens the thread');
  assert.equal(await thread().getByRole('list', { name: 'Replies' }).locator('.comment-entry').count(), 3);
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    await thread().scrollIntoViewIfNeeded();
    assert.ok((await thread().boundingBox()).width <= width);
    await page.screenshot({ path: `${evidence}/thread-reopened-${width}.png` });
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  const activity = (await (await context.request.get(base + `/api/issues/${identifier}`)).json()).activity.map((entry) => entry.kind);
  assert.deepEqual(activity.filter((kind) => kind.startsWith('thread.')), ['thread.resolved', 'thread.reopened']);
  await settleReads(page);
  record('ISSUE-008', 'At 1440px and 390px a teammate replies twice in order under a top-level comment, cannot edit it (no control; PATCH 403), resolves the thread and sees it collapse to one line naming them; the author expands it, replies, and the thread reopens with resolve/reopen activity recorded.');
}
