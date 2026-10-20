// Settle native polling before replacing an authorized private document.
import { beforePrivateNavigation } from "./collaboration-navigation.mjs";
import assert from "node:assert/strict";
import { poll } from "./admin-runtime-support.mjs";
import { openDisclosures } from "./ui-controls-checks.mjs";
export async function createAdministrationIssue({
  page,
  runtime,
  capture,
  clause,
  team,
  label,
  project,
}) {
  const { base, sql } = runtime;

  await beforePrivateNavigation(page, base + "/app/new-issue");
  await page.goto(base + "/app/new-issue");
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
export async function exerciseCycleCommitments({
  page,
  runtime,
  capture,
  clause,
  issue,
  cycles,
}) {
  const { base, sql } = runtime;
  const snapshots = [];
  await clause(
    "CYCLE-002",
    "inline cycle picker commits moves and uncommits with immutable receipts",
    async () => {
      await beforePrivateNavigation(page, base + "/app/issues/" + issue.identifier);
      await page.goto(base + "/app/issues/" + issue.identifier);
      await page
        .getByRole("heading", { name: issue.title, exact: true })
        .waitFor();
      const picker = page
        .locator(".issue-property-bar")
        .getByLabel("Issue cycle", { exact: true });
      for (const cycleId of [cycles[0].id, cycles[1].id, ""]) {
        const before = sql(`SELECT * FROM issues WHERE id='${issue.id}'`)[0];
        await picker.selectOption(cycleId);
        await poll(
          () => sql(`SELECT * FROM issues WHERE id='${issue.id}'`),
          (rows) =>
            rows[0]?.cycle_id === (cycleId || null) &&
            rows[0].version === before.version + 1,
          "cycle mutation",
        );
        await page.waitForFunction((value) => {
          const select = document.querySelector(
            '.issue-property-bar select[aria-label="Issue cycle"]',
          );
          return select?.value === value && !select.disabled;
        }, cycleId);
        const history = sql(
          `SELECT * FROM issue_activity WHERE issue_id='${issue.id}' ORDER BY created_at,id`,
        );
        const receipt = history.find(
          (row) =>
            row.previous_value_json &&
            row.next_value_json &&
            JSON.parse(row.previous_value_json).cycleId === before.cycle_id &&
            JSON.parse(row.next_value_json).cycleId === (cycleId || null),
        );
        assert.ok(receipt, "cycle before/after receipt");
        assert.ok(receipt.actor_operator_id);
        assert.ok(receipt.created_at);
        snapshots.push(receipt);
        for (const cycle of cycles) {
          const response = await page.request.get(
            base + "/api/cycles/" + cycle.id,
          );
          assert.equal(response.status(), 200);
          const data = await response.json();
          assert.equal(
            data.issues.some((row) => row.id === issue.id),
            cycle.id === cycleId,
            "both derived cycle populations",
          );
        }
        await capture(
          cycleId
            ? "inline-cycle-" + (cycleId === cycles[0].id ? "commit" : "move")
            : "inline-cycle-uncommit",
        );
      }
      for (const snapshot of snapshots)
        assert.deepEqual(
          sql(`SELECT * FROM issue_activity WHERE id='${snapshot.id}'`)[0],
          snapshot,
          "cycle history remains immutable",
        );
    },
  );
  return snapshots;
}
