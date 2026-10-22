// Settle native polling before replacing an authorized private document.
import {
  beforePrivateNavigation,
  navigate,
  settleReads,
} from "./collaboration-navigation.mjs";
import { roleScreens } from "./role-ui-support.mjs";
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

/** ROLE-001 in Settings → Members: an invitation names its role, an Owner
 * promotes and demotes a Member whose open session follows on its next
 * request, the last Owner stays, and a Member reads only what they may. The
 * returned Member's browser context is the caller's to close. */
export async function exerciseWorkspaceRoles({ page, browser, runtime, clause, evidence, refusals }) {
  const { base, sql } = runtime;
  const inspect = roleScreens(evidence);
  const owner = sql("SELECT o.id,o.name FROM operators o JOIN workspace_installation i ON i.setup_operator_id=o.id")[0];
  await navigate(page, base + "/app/settings");
  await openDisclosures(page);
  const members = page.getByRole("region", { name: "Members", exact: true });
  let context, peer;
  await clause("ROLE-001", "an invitation names its role, Member by default", async () => {
    const role = members.getByLabel("Role", { exact: true });
    assert.equal(await role.inputValue(), "member");
    assert.deepEqual(await role.locator("option").allTextContents(), ["Member", "Admin", "Owner"]);
    await members.getByLabel("Name", { exact: true }).fill("Role member");
    await members.getByLabel("Email", { exact: true }).fill("role-member@admin-runtime.test");
    const invited = page.waitForResponse((r) => new URL(r.url()).pathname === "/api/settings/operators/invite");
    await members.getByRole("button", { name: "Send invitation", exact: true }).click();
    assert.equal((await invited).status(), 202);
    const link = sql("SELECT json_extract(message,'$.text') AS text FROM rer_mail_development_outbox WHERE json_extract(message,'$.to[0]')='role-member@admin-runtime.test' ORDER BY created_at DESC,sequence DESC LIMIT 1")[0].text.match(/https?:\/\/[^\s]+/)[0];
    context = await browser.newContext({ viewport: page.viewportSize() });
    peer = await context.newPage();
    await peer.goto(link);
    await peer.getByRole("button", { name: "Confirm", exact: true }).click();
    await peer.waitForURL(base + "/app");
    assert.equal(sql("SELECT role FROM operators WHERE email='role-member@admin-runtime.test'")[0].role, "member");
  });
  const memberId = sql("SELECT id FROM operators WHERE email='role-member@admin-runtime.test'")[0].id;
  // The accepted member joins the directory on the Owner's next Settings visit.
  await navigate(page, base + "/app/settings");
  await openDisclosures(page);
  // A workspace settings write that saves the current timezone: only the role decides its answer.
  const settingsRequest = async () => (await peer.request.patch(base + "/api/settings", {
    headers: { Origin: base }, data: { timezone: sql("SELECT timezone FROM workspace_settings")[0].timezone } })).status();
  const changeRole = async (name, id, role, status) => {
    const form = members.getByRole("form", { name: `Role for ${name}`, exact: true });
    await form.getByRole("combobox", { name: `Role for ${name}`, exact: true }).selectOption(role);
    const path = `/api/settings/operators/${id}/role`;
    if (status !== 200) refusals.add(base + path);
    const changed = page.waitForResponse((r) => new URL(r.url()).pathname === path);
    await form.getByRole("button", { name: "Change role", exact: true }).click();
    assert.equal((await changed).status(), status);
  };
  await clause("ROLE-001", "an Owner promotes a Member at 1440 and demotes them at 390; the demoted member's next settings request returns 403", async () => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await changeRole("Role member", memberId, "admin", 200);
    await page.getByText("Role member is now an Admin.", { exact: true }).waitFor();
    assert.equal(await settingsRequest(), 200);
    await page.setViewportSize({ width: 390, height: 844 });
    await changeRole("Role member", memberId, "member", 200);
    await page.getByText("Role member is now a Member.", { exact: true }).waitFor();
    assert.equal(await settingsRequest(), 403);
    assert.equal((await peer.request.get(base + "/api/session")).status(), 200, "the session itself survives the role change");
    const audit = sql(`SELECT d.previous_value_json AS previous,d.next_value_json AS next FROM audit_records a JOIN administration_audit_details d ON d.audit_id=a.id WHERE a.action='operator.role_changed' AND a.subject_id='${memberId}' ORDER BY a.id`);
    assert.deepEqual(audit.map((row) => [JSON.parse(row.previous).role, JSON.parse(row.next).role]), [["member", "admin"], ["admin", "member"]]);
  });
  await inspect(page, members, "members-owner");
  await clause("ROLE-001", "the last Owner's demotion is refused and changes nothing", async () => {
    const before = sql("SELECT id,role FROM operators ORDER BY id");
    await changeRole(owner.name, owner.id, "admin", 409);
    await page.getByText("The last Owner cannot be demoted or removed. Make another member an Owner first.", { exact: true }).waitFor();
    assert.equal(await members.getByRole("combobox", { name: `Role for ${owner.name}`, exact: true }).inputValue(), "owner", "the refused choice gives way to the actual role");
    assert.deepEqual(sql("SELECT id,role FROM operators ORDER BY id"), before);
  });
  await inspect(page, members, "members-last-owner-refused");
  await clause("ROLE-001", "a Member reads the member directory without managing anyone and opens only their own Settings pages", async () => {
    await navigate(peer, base + "/app/settings");
    await openDisclosures(peer);
    const directory = peer.getByRole("region", { name: "Members", exact: true });
    await directory.getByText("Role member (you)", { exact: true }).waitFor();
    assert.equal(await directory.getByRole("button", { name: "Change role", exact: true }).count(), 0);
    assert.deepEqual(await directory.getByRole("button", { name: /^Remove / }).allTextContents(), ["Remove Role member"]);
    assert.equal(await directory.getByRole("form", { name: "Invite member", exact: true }).count(), 0);
    for (const name of ["Workspace time", "Labels", "Cycles", "Data / Move in"])
      assert.equal(await peer.getByRole("region", { name, exact: true }).count(), 0, name);
    await peer.getByRole("region", { name: "Integrations", exact: true }).getByRole("heading", { name: "API tokens", exact: true }).waitFor();
  });
  await inspect(peer, peer.getByRole("region", { name: "Members", exact: true }), "members-member-view");
  return { context, peer, memberId };
}
