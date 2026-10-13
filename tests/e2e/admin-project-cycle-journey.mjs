// Settle native polling before replacing an authorized private document.
import { beforePrivateNavigation } from "./collaboration-navigation.mjs";
import assert from "node:assert/strict";
import { poll } from "./admin-runtime-support.mjs";
import {
  openDisclosures,
  openAdministrationForm,
} from "./ui-controls-checks.mjs";
export async function authorProject({ page, runtime, capture, clause }) {
  const { base, sql } = runtime;
  await beforePrivateNavigation(page, base + "/app/projects");
  await page.goto(base + "/app/projects");
  await page.getByRole("button", { name: "New project", exact: true }).click();
  await clause(
    "PROJ-001",
    "create project with lead Markdown optional target and Planned lifecycle",
    async () => {
      const create = page.getByRole("form", {
        name: "Create project",
        exact: true,
      });
      await create
        .getByLabel("Project name", { exact: true })
        .fill("Administration launch");
      await create
        .getByLabel("Project description", { exact: true })
        .fill(
          "## Delivery notes\n\n**Visible Markdown** and a [safe link](https://example.com).",
        );
      await create
        .getByRole("combobox", { name: "Project lead", exact: true })
        .selectOption(
          sql("SELECT id FROM operators WHERE removed_at IS NULL")[0].id,
        );
      await create
        .getByRole("button", { name: "Create project", exact: true })
        .click();
      await poll(
        () => sql("SELECT * FROM projects WHERE name='Administration launch'"),
        (rows) => rows.length === 1,
        "created project",
      );
      const project = sql(
        "SELECT * FROM projects WHERE name='Administration launch'",
      )[0];
      assert.equal(project.lifecycle, "planned");
      assert.equal(project.target_date, null);
      assert.ok(project.lead_operator_id);
    },
  );
  const created = sql(
    "SELECT * FROM projects WHERE name='Administration launch'",
  )[0];
  await page
    .getByRole("link", { name: "Open Administration launch", exact: true })
    .waitFor();
  await beforePrivateNavigation(page, base + "/app/projects/" + created.id);
  await page.goto(base + "/app/projects/" + created.id);
  await openAdministrationForm(page, "Edit project Administration launch");
  await capture("project-planned-no-target");
  await clause(
    "PROJ-002",
    "operator explicitly changes project lifecycle",
    async () => {
      const edit = page.getByRole("form", {
        name: "Edit project Administration launch",
        exact: true,
      });
      await edit
        .getByLabel("Project name", { exact: true })
        .fill("Administration delivery");
      await edit
        .getByLabel("Project target date", { exact: true })
        .fill("2027-02-28");
      await edit
        .getByRole("combobox", { name: "Project lifecycle", exact: true })
        .selectOption("active");
      await edit
        .getByRole("button", { name: "Save project", exact: true })
        .click();
      await poll(
        () =>
          sql("SELECT * FROM projects WHERE name='Administration delivery'"),
        (rows) =>
          rows[0]?.lifecycle === "active" &&
          rows[0].target_date === "2027-02-28",
        "project administration",
      );
    },
  );
  const project = sql(
    "SELECT * FROM projects WHERE name='Administration delivery'",
  )[0];

  await beforePrivateNavigation(page, base + "/app/projects/" + project.id);
  await page.goto(base + "/app/projects/" + project.id);
  await page
    .getByRole("heading", { name: project.name, exact: true })
    .waitFor();
  await page
    .getByRole("heading", { name: "Delivery notes", exact: true })
    .waitFor();
  assert.equal(
    await page
      .locator("strong")
      .filter({ hasText: "Visible Markdown" })
      .count(),
    1,
    "safe Markdown renderer",
  );
  await capture("project-markdown-detail");

  await beforePrivateNavigation(page, base + "/app/settings");
  await page.goto(base + "/app/settings");
  await openDisclosures(page);
  return project;
}
export async function authorCycles({ page, runtime, capture, clause, team }) {
  const { sql, base } = runtime;
  await beforePrivateNavigation(page, base + "/app/settings");
  await page.goto(base + "/app/settings");
  await page.getByRole("form", { name: "Create cycle", exact: true }).waitFor();
  await clause(
    "CYCLE-001",
    "manual nonoverlap cycles use workspace timezone and reject invalid end",
    async () => {
      const create = page.getByRole("form", {
        name: "Create cycle",
        exact: true,
      });
      await create
        .getByRole("combobox", { name: "Cycle team", exact: true })
        .selectOption(team.id);
      await create
        .getByLabel("Cycle name", { exact: true })
        .fill("Invalid end");
      await create
        .getByLabel("Cycle start", { exact: true })
        .fill("2026-10-01T09:00");
      await create
        .getByLabel("Cycle end", { exact: true })
        .fill("2026-10-01T08:00");
      await create
        .getByRole("button", { name: "Create cycle", exact: true })
        .click();
      await page
        .getByRole("alert")
        .filter({ hasText: /end|after/i })
        .waitFor();
      assert.equal(
        sql("SELECT count(*) n FROM cycles")[0].n,
        0,
        "invalid end creates nothing",
      );
      await capture("cycle-end-validation");
      for (const [name, start, end] of [
        ["First window", "2026-10-01T09:00", "2026-10-15T09:00"],
        ["Second window", "2026-10-15T09:00", "2026-10-29T09:00"],
      ]) {
        await create
          .getByRole("combobox", { name: "Cycle team", exact: true })
          .selectOption(team.id);
        await create.getByLabel("Cycle name", { exact: true }).fill(name);
        await create.getByLabel("Cycle start", { exact: true }).fill(start);
        await create.getByLabel("Cycle end", { exact: true }).fill(end);
        await create.getByLabel("Cycle capacity", { exact: true }).fill("10");
        await create
          .getByRole("button", { name: "Create cycle", exact: true })
          .click();
        await poll(
          () => sql(`SELECT * FROM cycles WHERE name='${name}'`),
          (rows) => rows.length === 1,
          "manual cycle",
        );
      }
      const cycles = sql("SELECT * FROM cycles ORDER BY starts_at");
      assert.equal(cycles.length, 2);
      assert.equal(
        cycles[0].ends_at,
        cycles[1].starts_at,
        "touching windows allowed",
      );
      assert.equal(
        cycles[0].starts_at,
        "2026-09-30T23:00:00.000Z",
        "Brisbane wall time converted to stored instant",
      );
    },
  );
  await capture("cycles-two-manual-windows");
  return sql("SELECT * FROM cycles ORDER BY starts_at");
}
export async function archiveProject({
  page,
  runtime,
  capture,
  clause,
  project,
  issue,
}) {
  const { base, sql } = runtime;

  await beforePrivateNavigation(page, base + "/app/projects/" + project.id);
  await page.goto(base + "/app/projects/" + project.id);
  await openAdministrationForm(page, "Edit project " + project.name);
  await clause(
    "PROJ-009",
    "archive excludes default portfolio retains members include archived and unarchive restore",
    async () => {
      const edit = page.getByRole("form", {
        name: "Edit project " + project.name,
        exact: true,
      });
      await edit
        .getByRole("button", { name: "Archive project", exact: true })
        .click();
      await poll(
        () => sql(`SELECT * FROM projects WHERE id='${project.id}'`),
        (rows) => Boolean(rows[0]?.archived_at),
        "archived project",
      );
      assert.equal(
        sql(`SELECT project_id FROM issues WHERE id='${issue.id}'`)[0]
          .project_id,
        project.id,
      );
      assert.equal(
        sql(`SELECT lifecycle FROM projects WHERE id='${project.id}'`)[0]
          .lifecycle,
        "active",
      );

      await beforePrivateNavigation(page, base + "/app/projects");
      await page.goto(base + "/app/projects");
      await page
        .getByRole("heading", { name: "Projects", exact: true })
        .waitFor();
      assert.equal(
        await page
          .getByRole("link", { name: "Open " + project.name, exact: true })
          .count(),
        0,
        "default excludes archived project",
      );
      assert.equal(
        (
          await page
            .locator(".project-metric")
            .first()
            .locator("strong")
            .textContent()
        ).trim(),
        "0",
        "default portfolio count excludes archived",
      );
      await page
        .getByLabel("Include archived projects", { exact: true })
        .check();
      await page
        .getByRole("link", { name: "Open " + project.name, exact: true })
        .waitFor();
      assert.equal(
        (
          await page
            .locator(".project-metric")
            .first()
            .locator("strong")
            .textContent()
        ).trim(),
        "1",
        "include archived rows and portfolio count agree",
      );
      await capture("projects-include-archived");
      await beforePrivateNavigation(
        page,
        base + "/app/issues/" + issue.identifier,
      );
      await page.goto(base + "/app/issues/" + issue.identifier);
      await page
        .getByRole("heading", { name: issue.title, exact: true })
        .waitFor();
      const beforeEdit = sql(
        `SELECT version FROM issues WHERE id='${issue.id}'`,
      )[0].version;
      await page
        .locator(".issue-property-bar")
        .getByLabel("Issue priority", { exact: true })
        .selectOption("low");
      await poll(
        () =>
          sql(
            `SELECT version,priority,project_id FROM issues WHERE id='${issue.id}'`,
          ),
        (rows) =>
          rows[0]?.version === beforeEdit + 1 &&
          rows[0].priority === "low" &&
          rows[0].project_id === project.id,
        "existing issue edit retains archived project",
      );
      await capture("archived-project-retained-issue-edit");

      await beforePrivateNavigation(page, base + "/app/projects/" + project.id);
      await page.goto(base + "/app/projects/" + project.id);
      await openAdministrationForm(page, "Edit project " + project.name);
      await page
        .getByRole("form", {
          name: "Edit project " + project.name,
          exact: true,
        })
        .getByRole("button", { name: "Unarchive project", exact: true })
        .click();
      await poll(
        () => sql(`SELECT archived_at FROM projects WHERE id='${project.id}'`),
        (rows) => rows[0]?.archived_at === null,
        "unarchived project",
      );
    },
  );
  await capture("project-unarchived");
}
