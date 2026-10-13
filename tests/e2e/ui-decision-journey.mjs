import assert from "node:assert/strict";
import { captureReviewState } from "./ui-review-capture.mjs";
import { assertControls } from "./ui-controls-checks.mjs";
export async function exerciseDecision({ page, base, cookie, opts, req, writeFixture }) {
  // Genuine persisted discussion records exercise controls absent from the sample.
  await page.setViewportSize({ width: 390, height: 844 });
  const headers = {
    Cookie: cookie,
    Origin: base,
    "Content-Type": "application/json",
  };
  const create = await req("/api/intake", {
    method: "POST",
    headers,
    body: JSON.stringify({
      title: "UI decision journey",
      teamId: opts.teams[0].id,
      description: "- First observation\n- Second observation",
      summary: "A recorded operator observation",
    }),
  });
  assert.equal(create.status, 201);
  const intake = await create.json();
  await page.goto(base + `/app/issues/${intake.identifier}`);
  await page.waitForLoadState("networkidle");
  const triage = page.locator(".decision-panel");
  await triage
    .getByRole("button", { name: "Adjust routing and reason" })
    .click();
  assert.equal(
    await triage.getByLabel("Priority", { exact: true }).inputValue(),
    "none",
  );
  assert.equal(
    await triage.getByLabel("Assignee", { exact: true }).inputValue(),
    "",
  );
  assert.equal(
    await triage.getByLabel("Start status", { exact: true }).inputValue(),
    "",
  );
  assert.equal(
    await triage.getByLabel("Cycle", { exact: true }).inputValue(),
    "",
  );
  if ((await page.locator(".issue-description").getAttribute("open")) === null)
    await page.locator(".issue-description summary").click();
  assert.equal(
    await page.locator(".issue-description .safe-markdown").isVisible(),
    true,
  );
  assert.equal(
    await page
      .locator(".safe-markdown ul")
      .evaluate((e) => getComputedStyle(e).listStyleType),
    "disc",
  );
  await writeFixture(
    `UPDATE evidence_revisions SET assertions_json='{"recommendation":{"source":"policy","priority":"medium"}}' WHERE issue_id='${intake.id}'`,
  );
  await page.reload();
  await page.waitForLoadState("networkidle");
  await triage
    .getByRole("button", { name: "Adjust routing and reason" })
    .click();
  assert.equal(
    await triage.getByLabel("Priority", { exact: true }).inputValue(),
    "medium",
  );
  assert.equal(await triage.locator(".recommended-label").count(), 1);
  await triage.getByLabel("Priority", { exact: true }).selectOption("low");
  assert.equal(
    await triage.locator(".recommended-label").count(),
    0,
    "override no longer labelled recommended",
  );
  await triage.getByRole("tab", { name: "Defer", exact: true }).click();
  const returnAt = new Date(Date.now() + 86400000).toISOString().slice(0, 16);
  await triage.getByLabel("Return for decision").fill(returnAt);
  await triage
    .getByLabel(/^Reason/)
    .fill("Waiting for an independent measurement");
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    const widths = await triage
      .locator('.decision-form__wide input[type="datetime-local"]')
      .evaluate((field) => ({
        input: field.getBoundingClientRect().width,
        form: field.closest("fieldset").getBoundingClientRect().width,
      }));
    assert.ok(
      Math.abs(widths.input - widths.form) <= 2,
      `return datetime uses the full form width ${JSON.stringify(widths)}`,
    );
  }
  await captureReviewState(page, "defer-before", true);
  const deferReceipt = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname ===
        `/api/issues/${intake.identifier}/defer` &&
      response.request().method() === "POST",
  );
  await triage.getByRole("button", { name: "Defer decision" }).click();
  const deferredResponse = await deferReceipt;
  assert.equal(deferredResponse.status(), 200);
  const deferred = await deferredResponse.json();
  assert.equal(deferred.version, intake.version + 1);
  await page
    .getByRole("status", { name: "Saved triage decision" })
    .filter({ hasText: "Waiting for an independent measurement" })
    .waitFor();
  await captureReviewState(page, "defer-success", true);
  assert.equal(
    await triage
      .getByRole("button", { name: "Defer decision", exact: true })
      .count(),
    0,
    "submitted deferral form closes",
  );
  assert.equal(
    await triage
      .getByRole("tab", { name: "Accept", exact: true })
      .getAttribute("aria-selected"),
    "true",
  );
  await page.reload();
  await page.waitForLoadState("networkidle");
  await page
    .getByRole("status", { name: "Saved triage decision" })
    .filter({ hasText: "Deferred" })
    .waitFor();
  await captureReviewState(page, "defer-reload", true);
  await page
    .locator(".decision-panel")
    .getByRole("tab", { name: "End deferral", exact: true })
    .click();
  await assertControls(page, "end deferral");
  await page.setViewportSize({ width: 1440, height: 900 });
  const endTab = triage.getByRole("tab", { name: "End deferral", exact: true });
  assert.equal(
    await endTab.evaluate((tab) => getComputedStyle(tab).whiteSpace),
    "nowrap",
    "desktop End deferral remains on one line",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await captureReviewState(page, "end-deferral", true);
  const returnReceipt = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname ===
        `/api/issues/${intake.identifier}/return` &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "End deferral now" }).click();
  const returnedResponse = await returnReceipt;
  assert.equal(returnedResponse.status(), 200);
  const returned = await returnedResponse.json();
  assert.equal(returned.version, deferred.version + 1);
  assert.equal(returned.deferredUntil, null);
  // Network idleness may still describe the state before this mutation's
  // refresh. The ended confirmation proves the new issue reached the DOM.
  await page
    .locator(".decision-confirmation--ended")
    .getByText("Deferral ended · awaiting decision", { exact: true })
    .waitFor();
  await page.waitForLoadState("networkidle");
  const endedResponse = await req(`/api/issues/${intake.identifier}`, {
    headers,
  });
  assert.equal(endedResponse.status, 200);
  const ended = await endedResponse.json();
  assert.equal(ended.version, returned.version);
  assert.equal(
    ended.deferredUntil,
    null,
    "ended deferral is persisted before Accept",
  );
  assert.equal(
    await triage.getByRole("button", { name: "End deferral now" }).count(),
    0,
    "ended deferral form closes",
  );
  await captureReviewState(page, "end-deferral-success", true);
  await page
    .locator(".decision-panel")
    .getByRole("tab", { name: "Accept", exact: true })
    .click();
  await triage
    .getByRole("button", { name: "Adjust routing and reason" })
    .click();
  await page
    .locator(".decision-panel")
    .getByLabel("Assignee", { exact: true })
    .selectOption(opts.operator.id);
  await page
    .locator(".decision-panel")
    .getByLabel(/^Reason/)
    .fill("Start with a clearly owned next step");
  const acceptReceipt = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname ===
        `/api/issues/${intake.identifier}/accept` &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Accept and route work" }).click();
  const acceptedResponse = await acceptReceipt;
  assert.equal(
    acceptedResponse.request().postDataJSON().expectedVersion,
    returned.version,
    "accept submits the version rendered after ending the deferral",
  );
  assert.equal(acceptedResponse.status(), 200);
  const accepted = await acceptedResponse.json();
  assert.equal(accepted.version, returned.version + 1);
  assert.equal(accepted.assignee.id, opts.operator.id);
  assert.equal(accepted.priority, "medium");
  await page
    .getByRole("status", { name: "Saved triage decision" })
    .filter({ hasText: "Accepted" })
    .waitFor();
  await page.reload();
  await page.waitForLoadState("networkidle");
  const confirmation = page.getByRole("status", {
    name: "Saved triage decision",
  });
  await confirmation
    .filter({ hasText: "Start with a clearly owned next step" })
    .waitFor();
  assert.equal(
    await confirmation
      .getByRole("link", { name: "My work →" })
      .getAttribute("href"),
    "/app/my-work",
  );
  assert.equal(
    await confirmation.getByRole("link", { name: /^Current/ }).count(),
    0,
  );
  return { intake, confirmation, headers };
}
