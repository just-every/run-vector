import assert from "node:assert/strict";
import { auditState, settled } from "./ui-state-audit.mjs";
import { browserReceipt } from "./issue-controls-fixture.mjs";
import { savedViewHeldResponses, finishSavedViewProbe } from "./saved-view-held-responses.mjs";
import { observeSavedViewPatch, savedViewPatchProcessed, restoreSavedViewPatchObserver } from "./saved-view-response-observer.mjs";

async function assertPrivateViewAbsent(page, view, names) {
  assert.equal(await page.locator("main h1").textContent(), "Saved view", "VIEW-002 remount keeps the private heading absent after native PATCH completion");
  for (const name of names)
    assert.equal(await page.locator("main").getByText(name, { exact: true }).count(), 0, "VIEW-002 remount never renders a denied private receipt");
  assert.equal(await page.getByRole("region", { name: "Saved view actions" }).count(), 0, "VIEW-002 denied actions stay absent after remount");
  assert.equal(await page.locator("main[data-list-query]").count(), 0, "VIEW-002 denied private query and issue surface stay absent after remount");
  const navs = await page.locator(".saved-view-navigation").count();
  assert.ok(navs > 0, "VIEW-002 remount checks genuine navigation instances");
  assert.equal(await page.locator(`.saved-view-navigation a[href="/app/views/${view.id}"]`).count(), 0, "VIEW-002 every navigation keeps the denied private identity absent");
}

// Both widths drive Current/back independently. A resize of one document does
// not prove the mobile saved-view navigation's unmount/remount behavior.
export async function exerciseSavedViewLifetime(context, fixture, { widths = [1440, 390] } = {}) {
  const { page, base } = context;
  const originalViewport = page.viewportSize();
  try {
  const preferences = await fixture.api("/api/preferences/issues");
  for (const width of widths) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    const view = await fixture.api("/api/views", "POST", { name: `Private lifetime ${width}`, query: { priority: "high" } }, 201);
    const deniedName = `Private lifetime ${width} denied`;
    const delayedName = `Private lifetime ${width} delayed`;
    const path = `/api/views/${view.id}`;
    await page.goto(base + `/app/views/${view.id}`);
    await page.getByRole("heading", { name: view.name, exact: true }).waitFor();
    await settled(page);
    const marker = `saved-view-lifetime-${width}`;
    await page.evaluate(value => { window.__savedViewLifetimeDocument = value; }, marker);
    const transport = savedViewHeldResponses(page);
    let primaryFailure = null;
    try {
      const firstRead = await transport.hold(path, "GET", { beforeFetch: true, inspect: row => {
        assert.equal(row.status, 404, "VIEW-002 pre-remount detail denial is genuine");
      } });
      await page.getByLabel("View name", { exact: true }).fill(deniedName);
      await browserReceipt(page, path, "PATCH", () => page.getByRole("button", { name: "Rename / visibility", exact: true }).click());
      await page.getByRole("heading", { name: deniedName, exact: true }).waitFor();
      await transport.ready(() => firstRead.deliveries.length > 0, "VIEW-002 actual first PATCH starts its held detail read");
      const latePatch = await transport.hold(path, "PATCH", { inspect: row => {
        assert.equal(row.status, 200, "VIEW-002 delayed PATCH genuinely succeeded before deletion");
        assert.equal(row.body.id, view.id);
        assert.equal(row.body.name, delayedName);
      } });
      await observeSavedViewPatch(page, base, path);
      await page.getByLabel("View name", { exact: true }).fill(delayedName);
      await page.getByRole("button", { name: "Rename / visibility", exact: true }).click();
      await transport.ready(() => latePatch.rows.length === 1, "VIEW-002 successful genuine PATCH body is held");
      await fixture.api(path, "DELETE");
      const omittedRead = await transport.hold("/api/views", "GET", { inspect: row => {
        assert.equal(row.status, 200);
        assert.equal(row.body.views.some(item => item.id === view.id), false, "VIEW-002 genuine authorized navigation omits deleted identity");
      } });
      firstRead.release();
      await page.getByText("This view is unavailable.", { exact: false }).waitFor();
      await transport.retire(firstRead);
      await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
      await transport.ready(() => omittedRead.rows.length > 0, "VIEW-002 actual navigation omission read arrived");
      omittedRead.release();
      await transport.retire(omittedRead);
      await page.waitForFunction(id => !document.querySelector(`.saved-view-navigation a[href="/app/views/${id}"]`), view.id);
      await assertPrivateViewAbsent(page, view, [view.name, deniedName, delayedName]);
      await auditState(context, `view-lifetime-known-denial-${width}`);

      await page.getByRole("link", { name: "Current", exact: true }).filter({ visible: true }).first().click();
      await page.waitForURL(base + "/app");
      // History changes before the async operator route commits. Require the
      // destination tree so Back actually remounts the retired view readers.
      await page.getByRole("heading", { name: "Current", exact: true }).waitFor();
      assert.equal(await page.locator(".app-mobile-views").count(), 0, "VIEW-002 Current unmounts the phone saved-view navigation");
      await settled(page);
      assert.equal(await page.evaluate(() => window.__savedViewLifetimeDocument), marker, "VIEW-002 Current is actual SPA navigation");
      const remountDetail = await transport.hold(path, "GET", { inspect: row => {
        assert.equal(row.status, 404, "VIEW-002 held remount detail is a genuine server denial");
      } });
      const remountNavigation = await transport.hold("/api/views", "GET", { inspect: row => {
        assert.equal(row.status, 200);
        assert.equal(row.body.views.some(item => item.id === view.id), false, "VIEW-002 held remount navigation genuinely omits deleted identity");
      } });
      await page.goBack();
      await page.waitForURL(base + `/app/views/${view.id}`);
      await page.getByRole("heading", { name: "Saved view", exact: true }).waitFor();
      assert.equal(await page.evaluate(() => window.__savedViewLifetimeDocument), marker, "VIEW-002 back remount preserves the same authorized document");
      await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
      await transport.ready(() => remountDetail.rows.length > 0 && remountNavigation.rows.length > 0, "VIEW-002 remount's genuine detail and navigation bodies are held");
      latePatch.release();
      await savedViewPatchProcessed(page, { id: view.id, name: delayedName });
      assert.equal(await page.evaluate(() => window.__savedViewLifetimeDocument), marker);
      await assertPrivateViewAbsent(page, view, [view.name, deniedName, delayedName]);
      if (width === 390) await page.getByText("Board and saved views", { exact: true }).click();
      await auditState(context, `view-lifetime-remount-late-patch-${width}`);
      remountDetail.release();
      remountNavigation.release();
      await transport.retire(remountDetail);
      await transport.retire(remountNavigation);
      await page.getByText("This view is unavailable.", { exact: false }).waitFor();
      await assertPrivateViewAbsent(page, view, [view.name, deniedName, delayedName]);
      await auditState(context, `view-lifetime-fresh-denial-${width}`);
    } catch (error) {
      primaryFailure = error;
      await context.recordFailure?.(error);
    } finally {
      await finishSavedViewProbe(context, transport, primaryFailure, () => restoreSavedViewPatchObserver(page));
    }
  }
  assert.deepEqual(await fixture.api("/api/preferences/issues"), preferences, "VIEW-003 denial and remount never write origin controls");
  } finally {
    await page.setViewportSize(originalViewport);
  }
}
