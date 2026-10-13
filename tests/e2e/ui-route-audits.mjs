import assert from "node:assert/strict";
import { auditState } from "./ui-state-audit.mjs";
import { captureReviewState } from "./ui-review-capture.mjs";
import {
  assertPrimaryContent,
  assertPropertyTextFit,
  assertPinnedDecision,
  assertMobileNavigationTargets,
} from "./ui-detail-checks.mjs";
import { resolve } from "node:path";
import { assertUndecoratedLink } from "./ui-link-affordance.mjs";
import {
  assertControls,
  assertNavigationClearance,
  openDisclosures,
} from "./ui-controls-checks.mjs";
export async function auditRoutes({
  page,
  base,
  projects,
  evidence,
  results,
}) {
  const routes = [
    "/app",
    "/app/current",
    "/app/my-work",
    "/app/issues",
    "/app/board",
    "/app/search",
    "/app/new",
    "/app/new-issue",
    "/app/projects",
    "/app/settings",
    "/app/issues/FLW-842",
    "/app/current/FLW-842",
    "/app/my-work/FLW-842",
    ...projects.map((p) => `/app/projects/${p.id}`),
  ];
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    for (const route of routes) {
      const response = await page.goto(base + route);
      await page.waitForLoadState("networkidle");
      if (route === "/app/new") {
        assert.equal(new URL(page.url()).pathname, "/app/new-issue");
        const redirectedFrom = response?.request().redirectedFrom();
        assert.ok(
          redirectedFrom,
          `${viewport.width}: legacy new issue document redirects`,
        );
        assert.equal(
          new URL(redirectedFrom.url()).pathname,
          "/app/new",
          `${viewport.width}: legacy new issue document redirects`,
        );
        await assertNewIssueForm(page);
      }
      if (route.includes("FLW-842")) {
        await assertPrimaryContent(page, route);
        if (viewport.width === 1440) await assertPropertyTextFit(page);
        for (const selector of [
          ".secondary-section",
          ".issue-files",
          ".issue-history",
          ".named-links details",
        ]) {
          assert.equal(
            await page.locator(selector + "[open]").count(),
            0,
            `${route}: secondary content starts collapsed`,
          );
        }
      }
      if (route.includes("FLW-842") || ["/app", "/app/current"].includes(route))
        await captureReviewState(
          page,
          route.includes("FLW-842")
            ? route.includes("current")
              ? "current-detail"
              : route.includes("my-work")
                ? "work-detail"
                : "direct-detail"
            : route === "/app"
              ? "current"
              : "current-index",
        );
      if (route.includes("FLW-842")) {
        if (viewport.width === 390 && !route.includes("my-work")) {
          await page
            .locator(".issue-outcome")
            .evaluate((section) => section.scrollIntoView({ block: "start" }));
          await captureReviewState(
            page,
            route.includes("current") ? "current-reading" : "direct-reading",
          );
          await page.evaluate(() => window.scrollTo(0, 0));
        }
        await page
          .getByRole("button", { name: "Edit issue", exact: true })
          .click();
        if (viewport.width === 390)
          await page
            .locator(".issue-mutation-form:has(.issue-editor-controls)")
            .evaluate((form) =>
              form.parentElement.scrollIntoView({ block: "start" }),
            );
        await captureReviewState(
          page,
          route.includes("current")
            ? "current-editor"
            : route.includes("my-work")
              ? "work-editor"
              : "direct-editor",
        );
        await page
          .getByRole("button", { name: "Cancel edit", exact: true })
          .click();
      }
      await auditState({ page, evidence, results }, `resting-${route}`);
      await openDisclosures(page);
      if (
        await page
          .getByRole("button", { name: "Edit issue", exact: true })
          .count()
      ) {
        await page
          .getByRole("button", { name: "Edit issue", exact: true })
          .click();
        await openDisclosures(page);
      }
      const controls = await assertControls(page, `${viewport.width} ${route}`);
      await assertNavigationClearance(page, `${viewport.width} ${route}`);
      results.push({ viewport, route, controls });
      await auditState({ page, evidence, results }, `expanded-${route}`);
      if (route === "/app/issues") {
        const newIssue = page.locator(".issues-heading").getByRole("link", {
          name: "New issue",
          exact: true,
        });
        assert.equal(await newIssue.getAttribute("href"), "/app/new");
        await newIssue.click();
        await page.waitForURL(base + "/app/new-issue");
        await assertNewIssueForm(page);
        results.push({
          viewport,
          route: "issues-new-issue-link",
          redirectedTo: "/app/new-issue",
        });
      }
      if (route === "/app/new-issue") {
        await page.getByRole("radio", { name: /Intake/ }).check();
        await openDisclosures(page);
        await auditState({ page, evidence, results }, "new-intake");
        const intakeControls = await assertControls(
          page,
          `${viewport.width} new intake`,
        );
        results.push({
          viewport,
          route: "new-intake",
          controls: intakeControls,
        });
      }
      if (route === "/app") {
        await assertUndecoratedLink(
          page.locator(".app-nav-link:visible").first(),
          "app navigation",
        );
        await page
          .getByRole("button", { name: /Search/ })
          .filter({ visible: true })
          .click();
        await page.getByRole("dialog", { name: "Command palette" }).waitFor();
        results.push({
          viewport,
          route: "command-palette",
          controls: await assertControls(
            page,
            `${viewport.width} command palette`,
          ),
        });
        await auditState({ page, evidence, results }, "command-palette-resting");
        const palette = page.getByRole("dialog", { name: "Command palette" });
        const searchInput = palette.getByRole("textbox", {
          name: "Search issues, projects, and commands",
        });
        const searchReceipt = page.waitForResponse((response) => {
          const url = new URL(response.url());
          return (
            url.pathname === "/api/search" &&
            url.searchParams.get("q") === "FLW" &&
            response.request().method() === "GET"
          );
        });
        await searchInput.fill("FLW");
        const searchResponse = await searchReceipt;
        assert.equal(searchResponse.status(), 200);
        const search = await searchResponse.json();
        assert.ok(
          search.issues.length > 1,
          "genuine search has multiple issue results",
        );
        await palette.getByRole("option", { name: /^FLW-842 ·/ }).waitFor();
        await page.waitForFunction(
          () =>
            document
              .querySelector("#command-palette-results")
              ?.getAttribute("aria-busy") === "false",
        );
        assert.equal(
          await palette.getByRole("option").count(),
          search.issues.length,
        );
        const searchResults = palette.getByRole("listbox", {
          name: "Command palette results",
        });
        assert.equal(
          await searchResults
            .getByRole("group", { name: "Issues", exact: true })
            .count(),
          1,
          "issue results have a named group within their listbox",
        );
        assert.equal(
          await searchResults
            .getByRole("option")
            .evaluateAll((options) =>
              options.every(
                (option) =>
                  option.parentElement.getAttribute("role") === "group",
              ),
            ),
          true,
          "every search option has a group parent",
        );
        assert.equal(
          await palette.getByRole("option", { selected: true }).count(),
          1,
        );
        assert.equal(
          await searchInput.getAttribute("aria-activedescendant"),
          await palette
            .getByRole("option", { selected: true })
            .getAttribute("id"),
          "search input identifies its active result",
        );
        results.push({
          viewport,
          route: "command-palette-search",
          controls: await assertControls(
            page,
            `${viewport.width} command palette search results`,
          ),
        });
        await captureReviewState(page, "command-palette-results");
        await auditState({ page, evidence, results }, "command-palette-results");
        await page.keyboard.press("Escape");
      }
    }
    await page.goto(base + "/app/issues/FLW-842");
    await page.waitForLoadState("networkidle");
    const panel = page.locator(".decision-panel");
    await panel.waitFor();
    const rect = await panel.boundingBox();
    assert.ok(
      rect.y >= 0 && rect.y < viewport.height,
      "decision in first viewport",
    );
    const action = await panel
      .getByRole("button", { name: "Accept and route work" })
      .boundingBox();
    assert.ok(
      action.y + action.height <= viewport.height,
      "decision action in first viewport",
    );
    if (viewport.width === 390)
      await panel
        .getByRole("button", { name: "Adjust routing and reason" })
        .click();
    assert.equal(
      await panel.getByLabel("Assignee").inputValue(),
      "01J00000000000000000000003",
    );
    assert.equal(await panel.getByLabel("Priority").inputValue(), "high");
    assert.equal(
      await panel.getByLabel("Start status").inputValue(),
      "01J00000000000000000000023",
    );
    assert.equal(await panel.locator(".recommended-label").count(), 3);
    for (const recommended of await panel.locator(".recommended-label").all()) {
      assert.equal(
        await recommended.getAttribute("aria-hidden"),
        null,
        "recommendations are exposed to assistive technology",
      );
      assert.ok(
        await recommended.evaluate(
          (label) =>
            label
              .closest("label")
              .querySelector("select")
              .getAttribute("aria-describedby") === label.id,
        ),
        "recommendation describes its routing field",
      );
    }
    if (viewport.width === 390) {
      await captureReviewState(page, "routing-expanded", true);
      const pinned = await assertPinnedDecision(page);
      results.push({ viewport, route: "expanded-routing-action", ...pinned });
      await captureReviewState(page, "routing-scrolled", true);
      await panel
        .getByRole("button", { name: "Close routing and reason" })
        .click();
      results.push({
        viewport,
        route: "mobile-navigation-targets",
        navigation: await assertMobileNavigationTargets(page),
      });
      const nav = await page.locator(".app-mobile-nav").boundingBox();
      assert.ok(
        rect.y + rect.height <= nav.y,
        "decision sheet clears navigation",
      );
    }
    await page.screenshot({
      path: resolve(evidence, `ui-${viewport.width}.png`),
      fullPage: true,
    });
  }
}

async function assertNewIssueForm(page) {
  await page.getByRole("heading", { name: /^New (issue|intake)$/ }).waitFor();
  await page.getByRole("textbox", { name: /^Title/ }).waitFor();
  await page.getByRole("button", { name: /^Create (issue|intake)$/ }).waitFor();
}
