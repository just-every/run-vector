import assert from "node:assert/strict";
import { assertControlGap } from "./ui-detail-checks.mjs";
import { captureReviewState } from "./ui-review-capture.mjs";
import {
  assertBareLinkAffordance,
  assertUndecoratedLink,
} from "./ui-link-affordance.mjs";
import { assertControls } from "./ui-controls-checks.mjs";
export async function auditEdges({ page, base, writeFixture, req, email }) {
  // An empty unfiltered stream invites creation; active filters explain absence.
  await writeFixture(
    "UPDATE issues SET status_id=(SELECT id FROM workflow_statuses WHERE category='canceled' AND team_id=issues.team_id ORDER BY position LIMIT 1)",
  );
  await page.goto(base + "/app");
  await page.waitForLoadState("networkidle");
  await page
    .getByRole("heading", { name: "No work needs attention" })
    .waitFor();
  await page.getByRole("link", { name: "Create issue →" }).waitFor();
  await captureReviewState(page, "current-empty", true);
  await page.goto(base + "/app/my-work");
  await page.waitForLoadState("networkidle");
  await captureReviewState(page, "work-empty", true);
  await page.goto(base + "/app");
  await page.waitForLoadState("networkidle");
  // Stream filters are saved per operator, so this one is saved, shown, then
  // reset before the next state: nothing depends on a navigation racing the save.
  const saved = (method) => page.waitForResponse((response) => new URL(response.url()).pathname === "/api/preferences/current" && response.request().method() === method && response.ok());
  const urgent = saved("PUT");
  await page
    .locator(".stream-filters")
    .getByLabel("Priority", { exact: true })
    .selectOption("urgent");
  await urgent;
  await page
    .getByRole("heading", { name: "No issues match these filters" })
    .waitFor();
  const reset = saved("DELETE");
  await page.getByRole("button", { name: "Reset filters", exact: true }).click();
  await reset;
  await writeFixture(
    "UPDATE issues SET status_id=(SELECT id FROM workflow_statuses WHERE category='completed' AND team_id=issues.team_id ORDER BY position LIMIT 1),completed_at='2020-01-01T00:00:00.000Z'",
  );
  await page.goto(base + "/app");
  await page.waitForLoadState("networkidle");
  await page
    .getByRole("heading", { name: "No work needs attention" })
    .waitFor();
  assert.equal(
    await page
      .getByRole("heading", { name: "Create your first issue" })
      .count(),
    0,
    "completed records remain existing work",
  );
  await writeFixture(
    "DELETE FROM issue_links; DELETE FROM issue_files; DELETE FROM issue_comments; DELETE FROM issues;",
  );
  await page.goto(base + "/app");
  await page.waitForLoadState("networkidle");
  await page
    .getByRole("heading", { name: "Create your first issue" })
    .waitFor();
  await page.getByRole("link", { name: "Create issue →" }).waitFor();

  await page.goto(base + "/");
  await captureReviewState(page, "welcome", true);
  await page.goto(base + "/signin");
  await page.waitForLoadState("networkidle");
  await captureReviewState(page, "signin", true);
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByRole("button", { name: "Send sign-in link" }).click();
  await page
    .getByRole("status")
    .filter({ hasText: "Check your inbox" })
    .waitFor();
  await page.goto(base + "/not-a-route");
  await page
    .getByRole("heading", { name: "This page is out of reach" })
    .waitFor();
  const svgIcon = page.locator("link[rel=icon][type='image/svg+xml']");
  assert.equal(await svgIcon.getAttribute("href"), "/favicon.svg");
  const smallIcon = page.locator("link[rel=icon][type='image/png'][sizes='16x16']");
  const touchIcon = page.locator("link[rel=apple-touch-icon]");
  assert.equal(await smallIcon.count(), 1, "one 16px PNG icon link");
  assert.equal(await touchIcon.count(), 1, "one apple-touch-icon link");
  for (const link of [svgIcon, smallIcon, touchIcon]) {
    const href = await link.getAttribute("href");
    const response = await req(href);
    assert.equal(response.status, 200, `icon ${href}`);
    assert.match(response.headers.get("content-type") ?? "", /^image\//, `icon ${href} type`);
  }
  await assertBareLinkAffordance(
    page.getByRole("link", { name: "Return to welcome", exact: true }),
    "404 return link",
  );
  await assertUndecoratedLink(
    page.getByRole("link", { name: "Back to workspace", exact: true }),
    "404 primary action",
  );
  await assertControlGap(
    page.getByRole("link", { name: "Back to workspace", exact: true }),
    page.getByRole("link", { name: "Return to welcome", exact: true }),
    "404 destinations",
  );
  await captureReviewState(page, "404-signed-in", true);
  await assertControls(page, "404");
  await page.setViewportSize({ width: 1440, height: 900 });
  await assertControls(page, "desktop 404");
  await page.goto(base + "/signin");
  await page.waitForLoadState("networkidle");
  await assertBareLinkAffordance(
    page.getByRole("link", { name: "← Return to welcome", exact: true }),
    "signin return link",
  );
  await assertControls(page, "desktop signin");
  await page.setViewportSize({ width: 390, height: 844 });
  await assertControls(page, "mobile signin");
  const anonymous = await page.context().browser().newContext();
  try {
    const signedOut = await anonymous.newPage();
    await signedOut.goto(base + "/not-a-route");
    await captureReviewState(signedOut, "404-signed-out", true);
  } finally {
    await anonymous.close();
  }
}
