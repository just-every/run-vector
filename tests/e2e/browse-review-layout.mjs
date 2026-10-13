import assert from "node:assert/strict";
import { expect } from "@playwright/test";
import { settled, auditState } from "./ui-state-audit.mjs";
export async function emptyBoard(context, fixture) {
  const { page, base } = context;
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto(
      `${base}/app/board?team=${fixture.team.id}&q=no-empty-board-match`,
    );
    await settled(page);
    const region = page.getByRole("region", {
      name: "Workflow columns",
      exact: true,
    });
    await expect(region).toHaveAttribute("tabindex", "0");
    await region.focus();
    await expect(region).toBeFocused();
    if (viewport.width === 1440) {
      await page.keyboard.press("ArrowRight");
      await expect
        .poll(() => region.evaluate((el) => el.scrollLeft))
        .toBeGreaterThan(0);
    }
    const audit = await auditState(context, "empty-board-keyboard");
    assert.ok(audit.geometry.documentWidth <= viewport.width);
  }
}
export async function longView(context, fixture) {
  const { page, base } = context;
  const name =
    "Production incidents requiring customer success escalation and engineering investigation";
  const view = await fixture.api(
    "/api/views",
    "POST",
    { name, query: {}, layout: "list", isShared: false },
    201,
  );
  assert.equal((await fixture.api(`/api/views/${view.id}`)).name, name);
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto(`${base}/app/views/${view.id}`);
    await settled(page);
    await expect(page.locator(".issues-heading h1")).toHaveText(name);
    const action = page
      .locator(".issues-heading")
      .getByRole("link", { name: "New issue", exact: true });
    await action.focus();
    await expect(action).toBeFocused();
    const geometry = await action.evaluate((el) => {
      const range = document.createRange();
      range.selectNodeContents(el);
      const rects = [...range.getClientRects()].map((r) => ({
        x: r.x,
        y: r.y,
        right: r.right,
        bottom: r.bottom,
        width: r.width,
        height: r.height,
      }));
      const title = el.parentElement
        .querySelector("h1")
        .getBoundingClientRect();
      const box = el.getBoundingClientRect();
      return {
        rects,
        box: { x: box.x, y: box.y, right: box.right, bottom: box.bottom },
        title: {
          x: title.x,
          y: title.y,
          right: title.right,
          bottom: title.bottom,
        },
        width: innerWidth,
      };
    });
    assert.equal(
      geometry.rects.length,
      1,
      "New issue text occupies exactly one line",
    );
    assert.ok(geometry.box.x >= 0 && geometry.box.right <= viewport.width);
    assert.ok(
      geometry.title.right <= geometry.box.x ||
        geometry.title.bottom <= geometry.box.y ||
        geometry.box.bottom <= geometry.title.y,
      "heading and action do not overlap",
    );
    const audit = await auditState(context, "long-saved-view-action");
    audit.actionGeometry = geometry;
    assert.ok(audit.geometry.documentWidth <= viewport.width);
    await page.keyboard.press("Enter");
    await page.waitForURL(`${base}/app/new-issue`);
    await expect(
      page.getByRole("heading", { name: "New issue", exact: true }),
    ).toBeVisible();
  }
}
