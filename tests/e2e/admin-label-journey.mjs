// Settle native polling before replacing an authorized private document.
import { beforePrivateNavigation } from "./collaboration-navigation.mjs";
import assert from "node:assert/strict";
import { poll } from "./admin-runtime-support.mjs";
import { openAdministrationForm } from "./ui-controls-checks.mjs";
import { insertPrivateViewFixture } from "./admin-saved-view-fixture.mjs";
export async function authorLabel({ page, runtime, capture, clause }) {
  const { sql } = runtime;
  await clause(
    "ISSUE-014",
    "create rename recolour readable workspace label",
    async () => {
      const create = page.getByRole("form", {
        name: "Create label",
        exact: true,
      });
      await create.getByLabel("Label name", { exact: true }).fill("Evidence");
      await create.getByLabel("Label colour", { exact: true }).fill("#224466");
      await create
        .getByRole("button", { name: "Create label", exact: true })
        .click();
      await poll(
        () => sql("SELECT * FROM labels WHERE name='Evidence'"),
        (rows) => rows.length === 1,
        "created label",
      );
      await openAdministrationForm(page, "Edit label Evidence");
      await capture("label-created");
      const edit = page.getByRole("form", {
        name: "Edit label Evidence",
        exact: true,
      });
      await edit
        .getByLabel("Label name", { exact: true })
        .fill("Verified evidence");
      await edit.getByLabel("Label colour", { exact: true }).fill("#f5dd44");
      await edit
        .getByRole("button", { name: "Save label", exact: true })
        .click();
      await poll(
        () => sql("SELECT * FROM labels WHERE name='Verified evidence'"),
        (rows) => rows[0]?.color === "#f5dd44",
        "renamed recoloured label",
      );
    },
  );
  await openAdministrationForm(page, "Edit label Verified evidence");
  await capture("label-renamed-recoloured");
  return sql("SELECT * FROM labels WHERE name='Verified evidence'")[0];
}
export async function deleteAppliedLabel({
  page,
  runtime,
  capture,
  clause,
  label,
  issue,
}) {
  const { base, sql } = runtime;
  const view = await insertPrivateViewFixture(runtime, label);

  await beforePrivateNavigation(page, base + "/app/settings");
  await page.goto(base + "/app/settings");
  await openAdministrationForm(page, "Edit label " + label.name);
  await clause(
    "ISSUE-007",
    "label delete cascades issue selections with immutable before/after history",
    async () => {
      const before = sql(`SELECT version FROM issues WHERE id='${issue.id}'`)[0]
        .version;
      assert.equal(
        sql(
          `SELECT count(*) n FROM issue_labels WHERE issue_id='${issue.id}' AND label_id='${label.id}'`,
        )[0].n,
        1,
      );
      await page
        .getByRole("form", { name: "Edit label " + label.name, exact: true })
        .getByRole("button", { name: "Delete label", exact: true })
        .click();
      await capture("label-delete-confirmation");
      const receipt = page.waitForResponse(
        (r) =>
          new URL(r.url()).pathname === "/api/settings/labels/" + label.id &&
          r.request().method() === "DELETE",
      );
      await page
        .getByRole("button", { name: "Confirm delete label", exact: true })
        .click();
      assert.equal((await receipt).status(), 200);
      await poll(
        () => sql(`SELECT version FROM issues WHERE id='${issue.id}'`),
        (rows) => rows[0]?.version === before + 1,
        "label cascade version",
      );
      assert.equal(
        sql(`SELECT count(*) n FROM labels WHERE id='${label.id}'`)[0].n,
        0,
      );
      assert.equal(
        sql(
          `SELECT count(*) n FROM issue_labels WHERE label_id='${label.id}'`,
        )[0].n,
        0,
      );
      const filters = JSON.parse(
        sql(`SELECT filters_json FROM saved_views WHERE id='${view.id}'`)[0]
          .filters_json,
      );
      assert.deepEqual(
        filters,
        { ...view.filters, labelIds: [] },
        "private saved-view cascade preserves custom and other predicates",
      );
      const activities = sql(
        `SELECT * FROM issue_activity WHERE issue_id='${issue.id}' AND previous_value_json LIKE '%${label.id}%'`,
      );
      assert.ok(
        activities.length > 0,
        "label before/after remains in activity",
      );
      assert.ok(
        activities.every((row) => row.actor_operator_id && row.created_at),
      );
    },
  );

  await beforePrivateNavigation(page, base + "/app/issues/" + issue.identifier);
  await page.goto(base + "/app/issues/" + issue.identifier);
  await page.getByRole("heading", { name: issue.title, exact: true }).waitFor();
  await capture("label-cascade-issue-history");
}
