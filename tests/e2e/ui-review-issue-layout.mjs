import assert from "node:assert/strict";
import {
  assertPropertyTextFit,
  assertControlGap,
  assertMobileNavigationTargets,
} from "./ui-detail-checks.mjs";

export async function auditReviewIssueLayout({ page, width, opts, check }) {
  for (const surface of ["issues", "current"])
    await check(
      `decision-tab-row-${surface}`,
      `/app/${surface}/FLW-842`,
      async () => {
        await page.locator(".decision-tabs button").first().waitFor();
        const boxes = await page
          .locator(".decision-tabs button")
          .evaluateAll((nodes) =>
            nodes.map((node) => {
              const r = node.getBoundingClientRect();
              return { top: r.top, bottom: r.bottom };
            }),
          );
        assert.equal(boxes.length, 3);
        assert.ok(
          Math.max(...boxes.map((box) => box.top)) -
            Math.min(...boxes.map((box) => box.top)) <
            1,
          "all three decision tabs occupy one row",
        );
      },
    );
  await check("routing-alignment", "/app/issues/FLW-842", async () => {
    await page.locator(".decision-panel").waitFor();
    if (width === 390)
      await page
        .getByRole("button", {
          name: "Adjust routing and reason",
          exact: true,
        })
        .click();
    const boxes = await page
      .locator(".decision-routing select")
      .evaluateAll((nodes) =>
        nodes.map((node) => {
          const r = node.getBoundingClientRect();
          return { top: r.top, left: r.left };
        }),
      );
    assert.equal(boxes.length, 4, "all routing fields measured");
    assert.ok(
      Math.abs(boxes[0].top - boxes[1].top) <= 1,
      "assignee and priority align",
    );
    assert.ok(
      Math.abs(boxes[2].top - boxes[3].top) <= 1,
      "status and cycle align",
    );
  });
  await check("picker-text-fit", "/app/issues/FLW-842", async () => {
    await page.locator(".issue-property-bar select").first().waitFor();
    assert.equal(await page.locator(".issue-property-bar select").count(), 5);
    await assertPropertyTextFit(page);
    const project = page.getByLabel("Issue project", { exact: true });
    const original = await project.inputValue();
    for (const name of ["Customer Reliability", "Platform Hardening"]) {
      const choice = opts.projects.find((project) => project.name === name);
      assert.ok(choice, `${name} project fixture exists`);
      if ((await project.inputValue()) !== choice.id) {
        const saved = page.waitForResponse(
          (response) =>
            new URL(response.url()).pathname === "/api/issues/FLW-842" &&
            response.request().method() === "PATCH",
        );
        await project.selectOption(choice.id);
        assert.equal((await saved).status(), 200);
        await page.reload();
        await project.waitFor();
      }
      assert.equal(await project.inputValue(), choice.id);
      await assertPropertyTextFit(page);
    }
    if ((await project.inputValue()) !== original) {
      const saved = page.waitForResponse(
        (response) =>
          new URL(response.url()).pathname === "/api/issues/FLW-842" &&
          response.request().method() === "PATCH",
      );
      await project.selectOption(original);
      assert.equal((await saved).status(), 200);
    }
    if (width === 390) {
      const layout = await page
        .locator(".issue-property-bar")
        .evaluate((bar) => ({
          columns: getComputedStyle(bar).gridTemplateColumns.split(" ").length,
          rows: [...bar.querySelectorAll("select")].map((select) =>
            Math.round(select.getBoundingClientRect().top),
          ),
        }));
      assert.equal(layout.columns, 2, "phone property grid has two columns");
      assert.ok(
        layout.rows.every(
          (top) => layout.rows.filter((value) => value === top).length <= 2,
        ),
        "no phone row puts three pickers side by side",
      );
      const boxes = await page
        .locator(".issue-property-bar select")
        .evaluateAll((nodes) =>
          nodes.map((node) => node.getBoundingClientRect().width),
        );
      assert.ok(
        boxes.every((value) => value >= 145),
        "phone pickers have full two-column cells",
      );
    }
  });
  if (width === 390)
    await check("phone-search-keyboard", "/app", async () => {
      const search = page
        .locator(".app-mobile-nav")
        .getByRole("button", { name: "Search", exact: true });
      await search.waitFor();
      await page.locator(".stream-row").first().waitFor();
      await assertMobileNavigationTargets(page);
      const nav = page.locator(".app-mobile-nav");
      const active = nav.locator('a[aria-current="page"]');
      assert.equal(
        await active.count(),
        1,
        "one current destination is selected",
      );
      const peer = nav.getByRole("link", { name: "Issues", exact: true });
      assert.notEqual(
        await active.evaluate((node) => getComputedStyle(node).backgroundColor),
        await peer.evaluate((node) => getComputedStyle(node).backgroundColor),
        "active destination is distinct from inactive destinations",
      );
      await search.focus();
      await search.press("Enter");
      await page
        .getByRole("dialog", { name: "Command palette", exact: true })
        .waitFor();
      await page.keyboard.press("Escape");
      await page
        .getByRole("dialog", { name: "Command palette", exact: true })
        .waitFor({ state: "hidden" });
      await page.waitForFunction(() =>
        document.activeElement?.matches(".app-mobile-nav button"),
      );
      assert.equal(
        await search.evaluate((node) => node === document.activeElement),
        true,
        "Search keyboard action restores focus",
      );
    });
  await check("issue-controls", "/app/issues/FLW-842", async () => {
    const edit = page.getByRole("button", {
      name: "Edit issue",
      exact: true,
    });
    await edit.waitFor();
    const editBox = await edit.boundingBox(),
      titleBox = await page.locator("#issue-title").boundingBox();
    assert.ok(
      editBox.y >= titleBox.y,
      "Edit issue is adjacent to its title",
    );
    const dependencies = await page
      .locator(".secondary-section > summary", { hasText: /^Dependencies/ })
      .boundingBox();
    assert.ok(
      dependencies.y > editBox.y + editBox.height,
      "Edit issue is separate from dependency disclosure",
    );
    assert.equal(
      await edit.evaluate((node) => !!node.closest(".issue-header")),
      true,
      "Edit issue belongs with header actions",
    );
    await page
      .locator(".issue-label-summary")
      .getByRole("button", { name: /^Labels/ })
      .click();
    const labels = page.getByRole("form", {
      name: "Apply issue labels",
      exact: true,
    });
    await assertControlGap(
      labels.getByRole("button", { name: "Save labels", exact: true }),
      labels.getByRole("button", { name: "Cancel", exact: true }),
      "label actions",
    );
    const sizes = await page
      .locator(
        ".issue-header-actions button,.issue-label-control button,.issue-property-bar select,.secondary-section > summary,.issue-files > summary,.named-links summary",
      )
      .evaluateAll((nodes) =>
        nodes
          .filter((node) => node.getClientRects().length)
          .map((node) => parseFloat(getComputedStyle(node).fontSize)),
      );
    assert.ok(sizes.length >= 8, "control size comparison is non-vacuous");
    assert.ok(
      Math.max(...sizes) - Math.min(...sizes) <= 1,
      `consistent issue control size ${sizes}`,
    );
    const legend = labels.locator("legend");
    assert.equal(
      await labels
        .locator("fieldset")
        .evaluate((node) => parseFloat(getComputedStyle(node).borderTopWidth)),
      0,
      "label legend no longer crosses a fieldset border",
    );
    assert.equal(
      await legend.evaluate((node) => getComputedStyle(node).cssFloat),
      "left",
      "legend uses the authored in-flow heading treatment",
    );
    const legendBox = await legend.boundingBox(),
      choiceBox = await labels
        .locator(".issue-label-choices label")
        .first()
        .boundingBox();
    assert.ok(
      choiceBox.y > legendBox.y + legendBox.height,
      "label choices have space below their legend",
    );
  });
  await check("mobile-decision-sheet", "/app/issues/FLW-842", async () => {
    await page.locator(".decision-panel").waitFor();
    // The suggestion renders once workspace options load; wait for it.
    await page
      .locator(".decision-mobile-summary")
      .getByText(/^Suggested routing:/)
      .waitFor({ state: "attached" });
    assert.match(
      await page.locator(".decision-panel").textContent(),
      /Suggested(?: routing)?: assign .*priority.*start /,
      "recommendation names its purpose",
    );
    if (width === 390) {
      const initial = await page.locator(".decision-panel").boundingBox();
      await page.evaluate(() =>
        window.scrollTo(0, document.documentElement.scrollHeight),
      );
      await page.waitForFunction(() =>
        document
          .querySelector(".decision-panel")
          ?.classList.contains("is-compact"),
      );
      const compact = await page.locator(".decision-panel").boundingBox();
      assert.ok(
        compact.height < initial.height,
        "scroll collapses sheet to one action row",
      );
      const action = page.getByRole("button", {
        name: "Accept and route work",
        exact: true,
      });
      assert.equal(await action.isVisible(), true);
      const actionBox = await action.boundingBox();
      const navigationBox = await page.locator(".app-mobile-nav").boundingBox();
      assert.ok(
        actionBox.y + actionBox.height <= navigationBox.y,
        `compact action clears navigation ${JSON.stringify({ action: actionBox, navigation: navigationBox })}`,
      );
      assert.equal(
        await action.evaluate((node) => {
          const rect = node.getBoundingClientRect();
          return node.contains(
            document.elementFromPoint(
              rect.x + rect.width / 2,
              rect.y + rect.height / 2,
            ),
          );
        }),
        true,
        "compact Accept is hit-testable",
      );
      await page
        .getByRole("button", { name: "Adjust routing and reason", exact: true })
        .click();
      await page.getByRole("tab", { name: "Defer", exact: true }).focus();
      await page
        .getByRole("tab", { name: "Defer", exact: true })
        .press("Enter");
      await page.getByLabel("Return for decision", { exact: true }).waitFor();
      await page.getByRole("tab", { name: "Decline", exact: true }).click();
      await page
        .getByRole("button", { name: "Decline issue", exact: true })
        .waitFor();
      assert.equal(
        await page.locator(".decision-form textarea").getAttribute("required"),
        "",
      );
      await page.getByRole("tab", { name: "Accept", exact: true }).click();
      await page.getByLabel("Assignee", { exact: true }).waitFor();
      return {
        expanded: initial,
        compact,
        compactAction: actionBox,
        mobileNavigation: navigationBox,
      };
    }
  });
}
