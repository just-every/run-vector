import { withOperatorClient } from './operator-request.mjs';
import assert from 'node:assert/strict';
import { beforePrivateNavigation, settleReads } from './collaboration-navigation.mjs';
import { withInvitedOperator } from './core-operator-journey.mjs';

/** WORK-004: a member's Created, Subscribed (with Unfollow) and Activity tabs. */
export async function myWorkTabsJourney(page, context, base, state, teamId, evidence, record) {
  const api = async (path, method = 'GET', data) => {
    return withOperatorClient(context, async client => {
      const response = await client.fetch(base + '/api' + path, { method, headers: { Origin: base }, ...(data ? { data } : {}) });
      assert.ok(response.ok(), `${method} ${path} ${response.status()}`);
      return await response.json();
    });
  };
  const stamp = Date.now();
  const others = [await api('/issues', 'POST', { title: `Owner issue to follow ${stamp}`, teamId }), await api('/issues', 'POST', { title: `Owner issue to discuss ${stamp}`, teamId })];
  const rows = async () => page.locator('.issues-row').evaluateAll((nodes) => nodes.map((node) => node.dataset.issueIdentifier));
  const open = async (path) => {
    await beforePrivateNavigation(page, base + path);
    await page.goto(base + path);
    await page.getByRole('navigation', { name: 'My work' }).waitFor();
    await settleReads(page);
  };
  // Leaving a tab disposes its poller; settle reads first so none is aborted.
  const tab = async (name) => {
    await settleReads(page);
    await page.getByRole('link', { name, exact: true }).click();
  };
  await withInvitedOperator(page, context, base, state, async () => {
    const mine = [await api('/issues', 'POST', { title: `Member first ${stamp}`, teamId }), await api('/issues', 'POST', { title: `Member second ${stamp}`, teamId })];
    await api(`/issues/${others[0].identifier}/subscription`, 'PATCH', { following: true });
    await api(`/issues/${others[1].identifier}/comments`, 'POST', { body: `Member comment ${stamp}` });
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
      await open('/app/my-work');
      await tab('Created');
      await page.getByRole('heading', { name: 'Created', exact: true }).waitFor();
      await page.waitForFunction((count) => document.querySelectorAll('.issues-row').length === count, 2);
      assert.deepEqual(await rows(), [mine[1].identifier, mine[0].identifier]);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'Created fits without horizontal scroll');
      await page.screenshot({ path: `${evidence}/my-work-created-${width}.png`, fullPage: true });

      await tab('Subscribed');
      await page.getByRole('heading', { name: 'Subscribed', exact: true }).waitFor();
      const followed = page.locator(`#issue-row-${others[0].identifier}`);
      // The 1440 pass unfollows the explicitly followed issue; it stays gone at 390.
      const subscribed = (width === 1440 ? [...mine, ...others] : [...mine, others[1]]).map((issue) => issue.identifier);
      await page.waitForFunction((count) => document.querySelectorAll('.issues-row').length === count, subscribed.length);
      assert.deepEqual(new Set(await rows()), new Set(subscribed));
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'Subscribed fits without horizontal scroll');
      await page.screenshot({ path: `${evidence}/my-work-subscribed-${width}.png`, fullPage: true });
      if (width === 1440) {
        await page.getByRole('button', { name: `Unfollow ${others[0].identifier}`, exact: true }).click();
        await followed.waitFor({ state: 'detached' });
        assert.equal((await api(`/issues/${others[0].identifier}/subscription`)).following, false);
      }

      await tab('Activity');
      await page.getByRole('heading', { name: 'Activity', exact: true }).waitFor();
      const first = page.locator('.my-activity-list li').first();
      await first.getByText(`Member comment ${stamp}`).waitFor();
      assert.match(await first.innerText(), new RegExp(`${others[1].identifier}[\\s\\S]*Commented`));
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'Activity fits without horizontal scroll');
      await page.screenshot({ path: `${evidence}/my-work-activity-${width}.png`, fullPage: true });
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    // Activity links to its issue; Created saves as a view that keeps its scope.
    await settleReads(page);
    await page.locator('.my-activity-list li').first().getByRole('link').click();
    await page.waitForURL(base + '/app/issues/' + others[1].identifier);
    await open('/app/my-work/created?q=second');
    await page.waitForFunction(() => document.querySelectorAll('.issues-row').length === 1);
    await page.getByRole('button', { name: 'Save view', exact: true }).click();
    await page.getByRole('textbox', { name: 'View name', exact: true }).fill(`My created ${stamp}`);
    await settleReads(page);
    await page.getByRole('button', { name: 'Create view', exact: true }).click();
    await page.waitForURL(/\/app\/views\/[0-9A-Z]{26}$/);
    await page.locator(`#issue-row-${mine[1].identifier}`).waitFor();
    assert.deepEqual(await rows(), [mine[1].identifier]);
    await settleReads(page);
  }, 'My work teammate');
  record('WORK-004', 'At 1440px and 390px a member who created two issues, followed a third and commented on a fourth finds the two newest-first in Created, the followed issue in Subscribed until its row Unfollow removes it, and the comment first in Activity linking to its issue; Created with a filter saves as a view that keeps the scope.');
}
