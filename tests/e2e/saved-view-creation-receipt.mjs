import assert from "node:assert/strict";
import { auditState, settled } from "./ui-state-audit.mjs";
import { browserReceipt } from "./issue-controls-fixture.mjs";
import { savedViewHeldResponses, assertEverySavedViewNavigation, finishSavedViewProbe } from "./saved-view-held-responses.mjs";

export async function exerciseSavedViewCreationReceipt(context, fixture, { widths = [1440, 390] } = {}) {
  const { page, base } = context;
  const originalViewport = page.viewportSize();
  try {
  const preferences = await fixture.api("/api/preferences/issues");
  for (const width of widths) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    const initialNavigation = page.waitForResponse(response => new URL(response.url()).pathname === "/api/views" && response.request().method() === "GET");
    await page.goto(base + "/app/issues");
    const initialResponse = await initialNavigation;
    assert.equal(initialResponse.status(), 200);
    await initialResponse.finished();
    await settled(page);
    await page.waitForFunction(() => {
      const navs = [...document.querySelectorAll(".saved-view-navigation")];
      return navs.length > 0 && navs.every(nav => !nav.textContent.includes("Loading views"));
    });
    const transport = savedViewHeldResponses(page);
    let primaryFailure = null;
    const createdIds = [];
    try {
      const navigation = await transport.hold("/api/views", "GET", { inspect: row => assert.equal(row.status, 200) });
      await page.getByRole("button", { name: "Save view", exact: true }).click();
      await page.getByLabel("View name", { exact: true }).fill(`Creation receipt ${width}`);
      const created = await browserReceipt(page, "/api/views", "POST", () => page.getByRole("button", { name: "Create view", exact: true }).click(), 201);
      createdIds.push(created.id);
      await page.waitForURL(base + `/app/views/${created.id}`);
      await page.getByRole("heading", { name: created.name, exact: true }).waitFor();
      await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
      await transport.ready(() => navigation.rows.some(row => row.body.views.some(view => view.id === created.id && view.name === created.name)), "VIEW-002 genuine navigation body after actual SaveView POST is held");
      const renamed = { ...created, name: `Creation receipt ${width} immediately renamed` };
      await page.getByLabel("View name", { exact: true }).fill(renamed.name);
      await browserReceipt(page, `/api/views/${created.id}`, "PATCH", () => page.getByRole("button", { name: "Rename / visibility", exact: true }).click());
      await page.getByRole("heading", { name: renamed.name, exact: true }).waitFor({ timeout: 3000 });
      await assertEverySavedViewNavigation(page, renamed);
      if (width === 390) await page.getByText("Board and saved views", { exact: true }).click();
      await auditState(context, `view-creation-immediate-rename-before-get-${width}`);

      await page.getByLabel("View name", { exact: true }).fill(`Duplicate receipt ${width}`);
      const duplicate = await browserReceipt(page, `/api/views/${created.id}/duplicate`, "POST", () => page.getByRole("button", { name: "Duplicate view", exact: true }).click(), 201);
      createdIds.push(duplicate.id);
      await page.waitForURL(base + `/app/views/${duplicate.id}`);
      await page.getByRole("heading", { name: duplicate.name, exact: true }).waitFor();
      const renamedDuplicate = { ...duplicate, name: `Duplicate receipt ${width} immediately renamed` };
      await page.getByLabel("View name", { exact: true }).fill(renamedDuplicate.name);
      await browserReceipt(page, `/api/views/${duplicate.id}`, "PATCH", () => page.getByRole("button", { name: "Rename / visibility", exact: true }).click());
      await page.getByRole("heading", { name: renamedDuplicate.name, exact: true }).waitFor({ timeout: 3000 });
      await assertEverySavedViewNavigation(page, renamedDuplicate);
      await auditState(context, `view-duplicate-immediate-rename-before-get-${width}`);
      navigation.release();
      await transport.retire(navigation);
      await assertEverySavedViewNavigation(page, renamed);
      await assertEverySavedViewNavigation(page, renamedDuplicate);
      await page.reload();
      await page.getByRole("heading", { name: renamedDuplicate.name, exact: true }).waitFor();
      await assertEverySavedViewNavigation(page, renamed);
      await assertEverySavedViewNavigation(page, renamedDuplicate);
      await auditState(context, `view-creation-and-duplicate-persisted-${width}`);
    } catch (error) {
      primaryFailure = error;
      await context.recordFailure?.(error);
    } finally {
      await finishSavedViewProbe(context, transport, primaryFailure);
      for (const id of createdIds) await fixture.api(`/api/views/${id}`, "DELETE");
    }
  }
  assert.deepEqual(await fixture.api("/api/preferences/issues"), preferences, "VIEW-003 creating, duplicating and renaming preserve origin controls");
  } finally {
    await page.setViewportSize(originalViewport);
  }
}
