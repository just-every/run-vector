import assert from "node:assert/strict";
import { assertControlGap } from "./ui-detail-checks.mjs";
import { captureReviewState } from "./ui-review-capture.mjs";
import { assertBareLinkAffordance } from "./ui-link-affordance.mjs";
import { assertControls, openDisclosures } from "./ui-controls-checks.mjs";

function propertyValue(issue, field) {
  return {
    priority: issue.priority,
    assigneeOperatorId: issue.assignee?.id ?? "",
    projectId: issue.project?.id ?? "",
    cycleId: issue.cycle?.id ?? "",
    statusId: issue.status.id,
  }[field];
}

async function waitForPicker(page, label, value) {
  // A response can finish before React applies its receipt and clears busy.
  await page.waitForFunction(
    ({ label, value }) =>
      Array.from(document.querySelectorAll(".issue-property-bar select")).some(
        (select) =>
          select.getAttribute("aria-label") === label &&
          select.value === value &&
          !select.disabled,
      ),
    { label, value },
  );
}

export async function exerciseDiscussionProperties({
  page,
  base,
  projects,
  opts,
  req,
  intake,
  confirmation,
  headers,
}) {
  await assertBareLinkAffordance(
    confirmation.getByRole("link", { name: "My work →", exact: true }),
    "accepted work destination",
  );
  await page
    .getByLabel("Add a comment", { exact: true })
    .fill("A persistent comment");
  await page.getByRole("button", { name: "Add comment", exact: true }).click();
  await page
    .getByRole("button", { name: "Edit comment", exact: true })
    .waitFor();
  await assertControlGap(
    page.getByRole("button", { name: "Edit comment", exact: true }),
    page.getByRole("button", { name: "Delete comment", exact: true }),
    "comment edit/delete",
  );
  await captureReviewState(page, "discussion-display", true);
  await page.getByRole("button", { name: "Edit comment", exact: true }).click();
  await assertControls(page, "actual comment editor");
  await assertControlGap(
    page.getByRole("button", { name: "Save comment", exact: true }),
    page.getByRole("button", { name: "Cancel", exact: true }),
    "comment save/cancel",
  );
  await captureReviewState(page, "discussion-edit", true);
  await page
    .getByLabel("Edit comment", { exact: true })
    .fill("A revised persistent comment");
  await page.getByRole("button", { name: "Save comment" }).click();
  await page
    .getByText("A revised persistent comment", { exact: true })
    .waitFor();
  await page.getByLabel("Attach a file", { exact: true }).setInputFiles({
    name: "observation.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("Actual local upload"),
  });
  await page
    .getByRole("link", { name: "observation.txt", exact: true })
    .waitFor();
  await openDisclosures(page);
  await assertControls(page, "discussion files links removals");
  const attach = page.getByRole("button", { name: "Attach file", exact: true });
  await page.keyboard.press("Tab");
  await attach.focus();
  assert.ok(
    await attach.evaluate(
      (button) =>
        button.matches(":focus-visible") &&
        parseFloat(getComputedStyle(button).outlineWidth) >= 2,
    ),
    "file picker has a visible keyboard focus outline",
  );
  await captureReviewState(page, "discussion-file", true);
  assert.equal(
    await page.getByRole("button", { name: "Remove file" }).count(),
    1,
  );
  assert.equal(
    await page.getByRole("button", { name: "Delete comment" }).count(),
    1,
  );
  await page.getByRole("button", { name: "Edit issue", exact: true }).click();
  await openDisclosures(page);
  await assertControls(page, "actual issue editor");
  assert.deepEqual(
    await page
      .locator(
        ".issue-editor-controls input,.issue-editor-controls textarea,.issue-editor-controls select",
      )
      .evaluateAll((fields) => fields.map((field) => field.name)),
    ["title", "description"],
    "issue editor contains exactly the writing fields",
  );
  const beforeEdit = await (
    await req(`/api/issues/${intake.identifier}`, { headers })
  ).json();
  const editedTitle = "A clearer decision title";
  const editedDescription =
    "First authored paragraph.\n\nLast authored paragraph stays visible.";
  await page.locator('.issue-editor-controls [name="title"]').fill(editedTitle);
  await page
    .locator('.issue-editor-controls [name="description"]')
    .fill(editedDescription);
  const editResponse = page.waitForResponse(
    (response) =>
      response.url() === base + `/api/issues/${intake.identifier}` &&
      response.request().method() === "PATCH",
  );
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  const savedEdit = await editResponse;
  assert.equal(savedEdit.status(), 200);
  assert.deepEqual(
    savedEdit.request().postDataJSON(),
    {
      expectedVersion: beforeEdit.version,
      title: editedTitle,
      description: editedDescription,
    },
    "writing submits only title, description and optimistic version",
  );
  const persistedEdit = await (
    await req(`/api/issues/${intake.identifier}`, { headers })
  ).json();
  assert.equal(persistedEdit.title, editedTitle);
  assert.equal(persistedEdit.description, editedDescription);
  assert.equal(persistedEdit.version, beforeEdit.version + 1);
  for (const field of [
    "team",
    "status",
    "priority",
    "assignee",
    "project",
    "cycle",
    "labels",
    "dueDate",
    "estimate",
    "expectedOutcome",
    "customerImpact",
  ])
    assert.deepEqual(
      persistedEdit[field],
      beforeEdit[field],
      `writing preserves ${field}`,
    );
  await page.getByRole("heading", { name: editedTitle, exact: true }).waitFor();
  await page.getByRole("button", { name: "Edit issue", exact: true }).click();
  await page.getByRole("button", { name: "Cancel edit", exact: true }).click();
  const propertyBar = page.locator(".issue-property-bar");
  const readIssue = async () => {
    const response = await req(`/api/issues/${intake.identifier}`, { headers });
    assert.equal(response.status, 200);
    return response.json();
  };
  const checkPropertyReceipt = async (response, before, field, value) => {
    const saved = await response;
    assert.deepEqual(saved.request().postDataJSON(), {
      expectedVersion: before.version,
      [field]: value || null,
    });
    const receipt = await saved.json();
    assert.equal(receipt.identifier, intake.identifier);
    assert.equal(propertyValue(receipt, field), value);
    assert.equal(
      receipt.version,
      before.version + (propertyValue(before, field) === value ? 0 : 1),
    );
    const persisted = await readIssue();
    assert.equal(propertyValue(persisted, field), value);
    assert.equal(persisted.version, receipt.version);
  };
  for (const [label, value, field] of [
    ["Issue priority", "low", "priority"],
    ["Issue assignee", "", "assigneeOperatorId"],
    ["Issue project", projects[0].id, "projectId"],
    [
      "Issue cycle",
      opts.cycles.find((c) => c.teamId === intake.team.id)?.id ?? "",
      "cycleId",
    ],
    [
      "Issue status",
      opts.statuses.find(
        (s) => s.teamId === intake.team.id && s.category === "started",
      ).id,
      "statusId",
    ],
  ]) {
    const before = await readIssue();
    const response = page.waitForResponse(
      (r) =>
        r.url() === base + `/api/issues/${intake.identifier}` &&
        r.request().method() === "PATCH",
    );
    await propertyBar.getByLabel(label, { exact: true }).selectOption(value);
    assert.equal((await response).status(), 200);
    await checkPropertyReceipt(response, before, field, value);
    await page.waitForLoadState("networkidle");
    await waitForPicker(page, label, value);
    assert.equal(
      await propertyBar.getByLabel(label, { exact: true }).inputValue(),
      value,
    );
  }
  await confirmation
    .getByRole("link", { name: "Current · Now →", exact: true })
    .waitFor();
  const completed = opts.statuses.find(
    (s) => s.teamId === intake.team.id && s.category === "completed",
  );
  const beforeCompleted = await readIssue();
  const completedResponse = page.waitForResponse(
    (r) =>
      r.url() === base + `/api/issues/${intake.identifier}` &&
      r.request().method() === "PATCH",
  );
  await propertyBar
    .getByLabel("Issue status", { exact: true })
    .selectOption(completed.id);
  assert.equal((await completedResponse).status(), 200);
  await checkPropertyReceipt(
    completedResponse,
    beforeCompleted,
    "statusId",
    completed.id,
  );
  await page.waitForLoadState("networkidle");
  await waitForPicker(page, "Issue status", completed.id);
  assert.equal(
    await confirmation.getByRole("link", { name: "My work →" }).count(),
    0,
    "terminal work is absent from My work destination",
  );
  await confirmation
    .getByRole("link", { name: "Current · Recently done →", exact: true })
    .waitFor();
  const beforeConflict = await (
    await req(`/api/issues/${intake.identifier}`, { headers })
  ).json();
  assert.equal(
    (
      await req(`/api/issues/${intake.identifier}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          expectedVersion: beforeConflict.version,
          priority: "urgent",
        }),
      })
    ).status,
    200,
  );
  await propertyBar
    .getByLabel("Issue priority", { exact: true })
    .selectOption("medium");
  await propertyBar
    .getByRole("alert")
    .filter({ hasText: "changed elsewhere" })
    .waitFor();
  const reloadResponse = page.waitForResponse(
    (r) =>
      r.url() === base + `/api/issues/${intake.identifier}` &&
      r.request().method() === "GET",
  );
  await propertyBar.getByRole("button", { name: "Reload properties" }).click();
  assert.equal((await reloadResponse).status(), 200);
  await propertyBar
    .locator('select[aria-label="Issue priority"]:enabled')
    .waitFor();
  const reloaded = await (await reloadResponse).json();
  assert.equal(reloaded.identifier, intake.identifier);
  assert.equal(reloaded.priority, "urgent");
  const persistedReload = await readIssue();
  assert.equal(persistedReload.priority, "urgent");
  assert.equal(persistedReload.version, reloaded.version);
  await waitForPicker(page, "Issue priority", "urgent");
  assert.equal(
    await propertyBar
      .getByLabel("Issue priority", { exact: true })
      .inputValue(),
    "urgent",
  );
}
