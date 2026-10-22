// Settle native polling before replacing an authorized private document.
import {
  beforePrivateNavigation,
  settleReads,
} from "./collaboration-navigation.mjs";
import assert from "node:assert/strict";
import { poll } from "./admin-runtime-support.mjs";
import { saveWorkspaceTime } from "./admin-workspace-time-journey.mjs";
import {
  openDisclosures,
  openAdministrationForm,
  assertSettingsSections,
} from "./ui-controls-checks.mjs";
export async function auditEmptyWorkspace({ page, runtime, capture, clause }) {
  const { base } = runtime;

  await beforePrivateNavigation(page, base + "/app/projects");
  await page.goto(base + "/app/projects");
  await page.getByRole("heading", { name: "Projects", exact: true }).waitFor();
  await page
    .getByRole("heading", { name: "Create your first project", exact: true })
    .waitFor();
  await clause(
    "PROJ-007",
    "empty portfolio invites a first project with creation closed",
    async () => {
      assert.equal(
        await page
          .getByRole("heading", {
            name: "Create your first project",
            exact: true,
          })
          .isVisible(),
        true,
        "empty-project invitation is visible before opening creation",
      );
      await page
        .getByText("Choose New project to start planning your work.", {
          exact: true,
        })
        .waitFor();
      assert.equal(
        await page.getByText("No projects match these filters.").count(),
        0,
        "empty portfolio does not imply a filtered result",
      );
      const trigger = page.getByRole("button", {
        name: "New project",
        exact: true,
      });
      assert.equal(await trigger.isVisible(), true);
      assert.equal(await trigger.getAttribute("aria-expanded"), "false");
      assert.equal(
        await page
          .getByRole("form", {
            name: "Create project",
            exact: true,
            includeHidden: true,
          })
          .count(),
        0,
        "creation form is absent before New project is clicked",
      );
      assert.equal(await page.locator("#project-create-panel").count(), 0);
    },
  );
  await capture("empty-projects-invitation");
  await page.getByRole("button", { name: "New project", exact: true }).click();
  await page
    .getByRole("button", { name: "Create project", exact: true })
    .waitFor();
  await capture("empty-projects-create-cta");

  await beforePrivateNavigation(page, base + "/app/cycles");
  await page.goto(base + "/app/cycles");
  await page
    .getByRole("heading", { name: "Cycles", exact: true, level: 1 })
    .waitFor();
  await page
    .getByRole("button", { name: "Create cycle", exact: true })
    .waitFor();
  await page
    .getByText("No cycles yet. Create your first cycle below.", { exact: true })
    .waitFor();
  await capture("empty-cycles-create-cta");
  await page
    .getByRole("link", { name: "Settings", exact: true })
    .filter({ visible: true })
    .first()
    .click();
  await page.waitForURL(base + "/app/settings");
  await openAdministrationForm(
    page,
    "Edit " + runtime.config.DEFAULT_TEAM_NAME,
  );
  await openDisclosures(page);
  await assertSettingsSections(page, "empty workspace Settings");
  await clause(
    "OPS-003",
    "responsive signed operator settings access",
    async () => {
      await page
        .getByRole("link", { name: "Settings", exact: true })
        .filter({ visible: true })
        .first()
        .waitFor();
      await page
        .getByRole("button", { name: "Sign out", exact: true })
        .filter({ visible: true })
        .waitFor();
      await page
        .getByText(runtime.config.FIRST_OWNER_NAME, { exact: true })
        .filter({ visible: true })
        .first()
        .waitFor();
    },
  );
  await capture("empty-settings-six-sections");
  await saveWorkspaceTime({ page, runtime, capture, clause });
}
export async function inviteProjectLead({
  page,
  browser,
  runtime,
  capture,
  clause,
  project,
}) {
  const { base, sql } = runtime;

  await beforePrivateNavigation(page, base + "/app/settings");
  await page.goto(base + "/app/settings");
  await openDisclosures(page);
  await clause(
    "PROJ-002",
    "project lead transfers to a genuinely invited Member",
    async () => {
      const operators = page.getByRole("region", {
        name: "Members",
        exact: true,
      });
      await operators.getByLabel("Name", { exact: true }).fill("Delivery lead");
      await operators
        .getByLabel("Email", { exact: true })
        .fill("lead@admin-runtime.test");
      const invited = page.waitForResponse(
        (r) => new URL(r.url()).pathname === "/api/settings/operators/invite",
      );
      await operators
        .getByRole("button", { name: "Send invitation", exact: true })
        .click();
      assert.equal((await invited).status(), 202);
      const link = sql(
        "SELECT json_extract(message,'$.text') AS sign_in_url FROM rer_mail_development_outbox WHERE json_extract(message,'$.to[0]')='lead@admin-runtime.test' ORDER BY created_at DESC,sequence DESC LIMIT 1",
      )[0].sign_in_url.match(/https?:\/\/[^\s]+/)[0];
      const context = await browser.newContext({
        viewport: page.viewportSize(),
      });
      try {
        const peer = await context.newPage();
        await peer.goto(link);
        await peer
          .getByRole("button", { name: "Confirm", exact: true })
          .click();
        await peer.waitForURL(base + "/app");
      } finally {
        await context.close();
      }
      const lead = sql(
        "SELECT * FROM operators WHERE email='lead@admin-runtime.test'",
      )[0];
      assert.ok(lead && !lead.removed_at);
      await beforePrivateNavigation(page, base + "/app/projects/" + project.id);
      await page.goto(base + "/app/projects/" + project.id);
      await openAdministrationForm(page, "Edit project " + project.name);
      const edit = page.getByRole("form", {
        name: "Edit project " + project.name,
        exact: true,
      });
      await edit
        .getByRole("combobox", { name: "Project lead", exact: true })
        .selectOption(lead.id);
      await edit
        .getByRole("button", { name: "Save project", exact: true })
        .click();
      await poll(
        () =>
          sql(`SELECT lead_operator_id FROM projects WHERE id='${project.id}'`),
        (rows) => rows[0]?.lead_operator_id === lead.id,
        "lead transfer",
      );
      const audit = sql(
        `SELECT * FROM project_activity WHERE project_id='${project.id}'`,
      );
      assert.ok(
        audit.some(
          (row) =>
            row.actor_operator_id &&
            row.created_at &&
            JSON.parse(row.previous_value_json ?? "null")?.leadOperatorId ===
              project.lead_operator_id &&
            JSON.parse(row.next_value_json ?? "null")?.leadOperatorId ===
              lead.id,
        ),
        "lead actor old/new audit",
      );
    },
  );
  await capture("project-invited-lead-transfer");
}
export async function assertSignOut({ page, runtime, capture }) {
  await beforePrivateNavigation(page, runtime.base + "/app/settings");
  await page.goto(runtime.base + "/app/settings");
  await openAdministrationForm(
    page,
    "Edit " + runtime.config.DEFAULT_TEAM_NAME,
  );
  await openDisclosures(page);
  await assertSettingsSections(page, "final Settings");
  await capture("settings-final-signout-reachable");
  await settleReads(page);
  await page
    .getByRole("button", { name: "Sign out", exact: true })
    .filter({ visible: true })
    .click();
  await page.waitForURL(runtime.base + "/signin");
  assert.equal(
    (await page.request.get(runtime.base + "/api/session")).status(),
    401,
    "signout revokes browser admission",
  );
}
