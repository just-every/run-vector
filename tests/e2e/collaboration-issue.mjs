import { navigate } from "./collaboration-navigation.mjs";
import assert from "node:assert/strict";
import { poll } from "./admin-runtime-support.mjs";
import { openDisclosures } from "./ui-controls-checks.mjs";
export async function createCollaborationIssue({
  page,
  runtime,
  capture,
  clause,
  team,
  label,
  project,
}) {
  const { base, sql } = runtime;

  await navigate(page, base + "/app/new-issue");
  await page.getByRole("heading", { name: "New issue", exact: true }).waitFor();
  await page.getByLabel(/^Title/).fill("Administration authored work");
  await page.getByLabel(/^Team/).selectOption(team.id);
  await page
    .getByLabel(/^Description/)
    .fill("First authored paragraph.\n\nLast authored paragraph.");
  await openDisclosures(page);
  await page
    .getByLabel(/^Status/)
    .selectOption(team.statuses.find((s) => s.name === "Reviewing").id);
  await page
    .getByRole("combobox", { name: "Project", exact: true })
    .selectOption(project.id);
  await capture("issue-authoring");
  await page
    .getByLabel("Expected outcome", { exact: true })
    .fill("Operators see committed work.");
  await capture("issue-outcome-authoring");
  await clause("ISSUE-014", "label applied to an authored issue", async () => {
    const receipt = page.waitForResponse(
      (r) =>
        new URL(r.url()).pathname === "/api/issues" &&
        r.request().method() === "POST",
    );
    await page
      .getByRole("button", { name: "Create issue", exact: true })
      .click();
    assert.equal((await receipt).status(), 201);
    await page
      .getByRole("heading", {
        name: "Administration authored work",
        exact: true,
      })
      .waitFor();
  });
  const issue = await poll(
    () =>
      sql("SELECT * FROM issues WHERE title='Administration authored work'"),
    (rows) => rows.length === 1,
    "authored issue",
  );
  await clause(
    "ISSUE-014",
    "separate labelled section applies label without adding an inline property picker",
    async () => {
      await page.getByRole("button", { name: /^Labels(?: · \d+)?$/ }).click();
      const labels = page.getByRole("form", {
        name: "Apply issue labels",
        exact: true,
      });
      await labels.getByLabel(label.name, { exact: true }).check();
      await capture("issue-label-application");
      await labels
        .getByRole("button", { name: "Save labels", exact: true })
        .click();
      await poll(
        () =>
          sql(
            `SELECT count(*) n FROM issue_labels WHERE issue_id='${issue[0].id}' AND label_id='${label.id}'`,
          ),
        (rows) => rows[0].n === 1,
        "inline label application",
      );
      await page
        .getByRole("form", { name: "Apply issue labels", exact: true })
        .waitFor({ state: "hidden" });
    },
  );
  assert.equal(
    await page.locator(".issue-property-bar select").count(),
    5,
    "exactly five existing property pickers",
  );
  await page.getByRole("button", { name: "Edit issue", exact: true }).click();
  assert.deepEqual(
    await page
      .locator(
        ".issue-editor-controls input,.issue-editor-controls textarea,.issue-editor-controls select",
      )
      .evaluateAll((fields) => fields.map((field) => field.name)),
    ["title", "description"],
    "editor retains writing fields only",
  );
  await capture("issue-writing-only-editor");
  await page.getByRole("button", { name: "Cancel edit", exact: true }).click();
  await capture("issue-authored-detail");
  return issue[0];
}
