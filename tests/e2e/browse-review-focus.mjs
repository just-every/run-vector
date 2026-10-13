import assert from "node:assert/strict";
import { expect } from "@playwright/test";
import { settled, auditState } from "./ui-state-audit.mjs";
import { savedViewHeldResponses } from "./saved-view-held-responses.mjs";

export async function boardFocus(context, fixture) {
  const { page, base } = context,
    { api, team, backlog, todo } = fixture;
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    const issue = await fixture.create(`Keyboard movement ${viewport.width}`);
    await page.goto(
      `${base}/app/board?team=${team.id}&q=${encodeURIComponent(issue.title)}`,
    );
    await settled(page);
    if (viewport.width === 390)
      await page
        .getByLabel("Board column", { exact: true })
        .selectOption(backlog.id);
    const holds = savedViewHeldResponses(page);
    try {
      const refresh = await holds.hold("/api/issues", "GET");
      const patch = page.waitForResponse(
        (r) =>
          new URL(r.url()).pathname === `/api/issues/${issue.identifier}` &&
          r.request().method() === "PATCH",
      );
      const selector = page.getByLabel(`Status for ${issue.identifier}`, {
        exact: true,
      });
      await selector.focus();
      await page.keyboard.type(todo.name);
      assert.equal((await patch).status(), 200);
      await holds.ready(
        () =>
          refresh.rows.some((r) =>
            r.body.issues?.some(
              (i) =>
                i.identifier === issue.identifier && i.status.id === todo.id,
            ),
          ),
        "genuine refreshed move response held",
      );
      assert.equal(
        (await api(`/api/issues/${issue.identifier}`)).status.id,
        todo.id,
      );
      assert.equal(
        await page
          .locator(".board-column")
          .filter({ has: selector })
          .locator("h2")
          .textContent(),
        `${backlog.name} 1`,
        "held genuine refresh has not moved the rendered card yet",
      );
      await holds.retire(refresh);
      await expect(selector).toBeFocused();
      await expect(selector).toBeEnabled();
      assert.equal(await selector.inputValue(), todo.id);
      if (viewport.width === 390)
        assert.equal(
          await page.getByLabel("Board column", { exact: true }).inputValue(),
          todo.id,
        );
      const col = page.locator(".board-column").filter({ has: selector });
      await expect(col).toContainText("Showing 1 of 1");
      await expect(col.locator("h2")).toHaveText(`${todo.name} 1`);
      await auditState(context, "board-move-focus");
    } finally {
      assert.deepEqual((await holds.close()).errors, []);
    }
  }
}
export async function parentFocus(context, fixture) {
  const { page, base } = context;
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    const child = await fixture.create(
        `Parent keyboard child ${viewport.width}`,
      ),
      parent = await fixture.create(`Parent keyboard target ${viewport.width}`);
    await page.goto(`${base}/app/issues/${child.identifier}`);
    await settled(page);
    const hierarchy = page.getByRole("region", {
      name: "Issue hierarchy",
      exact: true,
    });
    async function open(label) {
      const trigger = hierarchy.getByRole("button", {
        name: label,
        exact: true,
      });
      await trigger.focus();
      await page.keyboard.press("Enter");
      await expect(
        hierarchy.getByLabel("Search parent issues", { exact: true }),
      ).toBeFocused();
    }
    await open("Set parent");
    await hierarchy
      .getByRole("button", { name: "Cancel", exact: true })
      .click();
    await expect(
      hierarchy.getByRole("button", { name: "Set parent", exact: true }),
    ).toBeFocused();
    assert.equal(
      await page.locator(".issue-header .issue-parent__edit").count(),
      1,
      "cancel returns to compact mounted trigger",
    );
    await open("Set parent");
    await hierarchy
      .getByLabel("Search parent issues", { exact: true })
      .fill(parent.identifier);
    await hierarchy
      .getByRole("button", { name: "Search", exact: true })
      .click();
    await hierarchy
      .getByRole("button", { name: new RegExp(parent.identifier) })
      .click();
    const refresh = page.waitForResponse(
      (r) =>
        new URL(r.url()).pathname === `/api/issues/${child.identifier}` &&
        r.request().method() === "GET",
    );
    await hierarchy
      .getByRole("button", { name: "Save parent", exact: true })
      .click();
    assert.equal((await refresh).status(), 200);
    await settled(page);
    await expect(
      hierarchy.getByRole("button", { name: "Change parent", exact: true }),
    ).toBeFocused();
    assert.equal(
      (await fixture.api(`/api/issues/${child.identifier}`)).parent.identifier,
      parent.identifier,
    );
    await auditState(context, "parent-save-focus");
    await open("Change parent");
    await hierarchy
      .getByRole("button", { name: "Cancel", exact: true })
      .click();
    await expect(
      hierarchy.getByRole("button", { name: "Change parent", exact: true }),
    ).toBeFocused();
    await open("Change parent");
    const cleared = page.waitForResponse(
      (r) =>
        new URL(r.url()).pathname === `/api/issues/${child.identifier}` &&
        r.request().method() === "GET",
    );
    await hierarchy
      .getByRole("button", { name: "Clear parent", exact: true })
      .click();
    assert.equal((await cleared).status(), 200);
    await settled(page);
    await expect(
      hierarchy.getByRole("button", { name: "Set parent", exact: true }),
    ).toBeFocused();
    assert.equal(
      (await fixture.api(`/api/issues/${child.identifier}`)).parent,
      null,
    );
    await auditState(context, "parent-clear-focus");
  }
}
