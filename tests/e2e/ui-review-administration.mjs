import assert from "node:assert/strict";
import { assertSetupGuidance } from "./setup-guidance-controls.mjs";

export async function auditReviewAdministration({ page, width, opts, check }) {
  await check("portfolio-first", "/app/projects", async () => {
    await page.locator(".project-list").waitFor();
    assert.equal(
      await page.getByRole("form", { name: "Create project" }).count(),
      0,
      "create form closed by default",
    );
    assert.equal(
      await page.locator("main summary").count(),
      0,
      "manage rows stay off portfolio",
    );
    assert.ok(
      (await page.locator(".project-row").first().boundingBox()).y +
        (await page.locator(".project-row").first().boundingBox()).height <=
        page.viewportSize().height - (width === 390 ? 60 : 0),
      "portfolio begins above fold",
    );
    assert.equal(
      await page
        .locator("main")
        .getByRole("link", { name: "New issue", exact: true })
        .count(),
      0,
    );
    const trigger = page.getByRole("button", {
      name: "New project",
      exact: true,
    });
    await trigger.click();
    const form = page.getByRole("form", {
      name: "Create project",
      exact: true,
    });
    await form.waitFor();
    await form
      .getByLabel("Project name", { exact: true })
      .fill("Unsent portfolio draft");
    await form.getByRole("button", { name: "Cancel", exact: true }).click();
    assert.equal(
      await trigger.evaluate((node) => node === document.activeElement),
      true,
      "cancel returns keyboard focus",
    );
    await trigger.click();
    await form.waitFor();
    assert.equal(
      await form.getByLabel("Project name", { exact: true }).inputValue(),
      "",
      "reopening creation starts a fresh form",
    );
    await form.getByRole("button", { name: "Cancel", exact: true }).click();
  });
  await check("admin-disclosures", "/app/settings", async () => {
    await page
      .locator(".administration-panel details > summary")
      .first()
      .waitFor();
    const summaries = page.locator(".administration-panel details > summary");
    assert.ok(
      (await summaries.count()) >= 3,
      "multiple team/status/label controls exist",
    );
    for (const summary of await summaries.all()) {
      await summary.evaluate((node) => {
        for (
          let ancestor = node.parentElement?.parentElement;
          ancestor;
          ancestor = ancestor.parentElement
        )
          if (ancestor.tagName === "DETAILS") ancestor.open = true;
      });
      await assertAdminSummary(page, summary);
    }
  });
  await check("settings-navigation", "/app/settings", async () => {
    const nav = page.getByRole("navigation", {
      name: "Settings sections",
      exact: true,
    });
    await nav.waitFor();
    const links = nav.getByRole("link");
    assert.ok(await links.count(), "Settings exposes section navigation");
    for (const link of await links.all()) {
      const href = await link.getAttribute("href");
      assert.ok(href?.startsWith("#"), "Section link targets this settings page");
      const section = page.locator(href);
      assert.equal(await section.count(), 1, "Section link has one live destination");
      await link.click();
      await section.waitFor({ state: "visible" });
      const rect = await section.boundingBox();
      assert.ok(
        rect.y >= 0 && rect.y < page.viewportSize().height,
        "Section navigation scrolls its destination into view",
      );
    }
    assert.equal(
      await page
        .getByRole("form", {
          name: "Create project",
          exact: true,
          includeHidden: true,
        })
        .count(),
      0,
      "Settings has no duplicate create form",
    );
  });
  await check("setup-guidance", "/app/settings", async () => {
    await assertSetupGuidance(page, { emailAvailable: true });
  });
  await check(
    "project-detail-layout",
    `/app/projects/${opts.projects[0].id}`,
    async () => {
      await page
        .getByRole("region", { name: "Project administration", exact: true })
        .locator("summary")
        .waitFor();
      const back = await page
        .locator(".project-detail__header .detail-back")
        .boundingBox();
      const kicker = await page
        .locator(".project-detail__header .stream-overline")
        .boundingBox();
      assert.ok(
        kicker.y - back.y - back.height >= 8,
        "Back has space above the project kicker",
      );
      const management = await page
        .getByRole("region", { name: "Project administration", exact: true })
        .boundingBox();
      const facts = await page.locator(".project-facts").boundingBox();
      assert.ok(
        management.y < facts.y,
        "management is next to header before facts",
      );
      const header = await page
        .locator(".project-detail__header")
        .boundingBox();
      assert.ok(
        management.y - header.y - header.height <= 40,
        "management is adjacent to project header",
      );
      assert.ok(
        management.y + management.height <=
          page.viewportSize().height - (width === 390 ? 60 : 0),
        "management is in the first viewport",
      );
      await assertAdminSummary(
        page,
        page
          .getByRole("region", { name: "Project administration", exact: true })
          .locator("summary"),
      );
    },
  );
}

async function assertAdminSummary(page, summary) {
  await summary.waitFor();
  await page.mouse.move(0, 0);
  const before = await summary.evaluate((node) => {
    const style = getComputedStyle(node),
      arrow = getComputedStyle(node, "::before");
    return {
      arrow: arrow.content,
      display: arrow.display,
      background: style.backgroundColor,
    };
  });
  assert.ok(
    before.arrow && !["none", "normal", '""'].includes(before.arrow),
    "admin summary has a visible chevron",
  );
  assert.notEqual(before.display, "none");
  await summary.hover();
  assert.notEqual(
    await summary.evaluate((node) => getComputedStyle(node).backgroundColor),
    before.background,
    "admin summary gains a hover surface",
  );
  await summary.focus();
  assert.ok(
    await summary.evaluate((node) => {
      const style = getComputedStyle(node);
      return (
        parseFloat(style.outlineWidth) >= 2 && style.outlineStyle !== "none"
      );
    }),
    "admin summary has a visible keyboard focus outline",
  );
  assert.equal(
    await summary.evaluate((node) => node === document.activeElement),
    true,
  );
  const wasOpen = await summary.evaluate((node) => node.parentElement.open);
  await summary.press("Enter");
  assert.equal(
    await summary.evaluate((node) => node.parentElement.open),
    !wasOpen,
    "native keyboard disclosure toggles",
  );
  await summary.press("Enter");
  assert.equal(
    await summary.evaluate((node) => node.parentElement.open),
    wasOpen,
    "native keyboard disclosure restores",
  );
}
