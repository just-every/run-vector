// Settle native polling before replacing an authorized private document.
import { beforePrivateNavigation, navigate } from "./collaboration-navigation.mjs";
import assert from "node:assert/strict";
import { poll } from "./admin-runtime-support.mjs";
import { openAdministrationForm } from "./ui-administration-form.mjs";
import { openDisclosures } from "./ui-controls-checks.mjs";
import { roleScreens } from "./role-ui-support.mjs";
export async function createTeamWorkflow({ page, runtime, capture, clause }) {
  const { base, sql } = runtime;

  await beforePrivateNavigation(page, base + "/app/settings");
  await page.goto(base + "/app/settings");
  await page.getByRole("form", { name: "Create team", exact: true }).waitFor();
  await clause(
    "TEAM-001",
    "create team with uppercase prefix and seven categories",
    async () => {
      const form = page.getByRole("form", { name: "Create team", exact: true });
      await form.getByLabel("Team name", { exact: true }).fill("Research");
      await form.getByLabel("Identifier prefix", { exact: true }).fill("RND");
      const receipt = page.waitForResponse(
        (r) =>
          new URL(r.url()).pathname === "/api/settings/teams" &&
          r.request().method() === "POST",
      );
      await form
        .getByRole("button", { name: "Create team", exact: true })
        .click();
      assert.equal((await receipt).status(), 200);
      await poll(
        () => sql("SELECT * FROM teams WHERE name='Research'"),
        (rows) => rows.length === 1,
        "created team",
      );
    },
  );
  const team = sql("SELECT * FROM teams WHERE name='Research'")[0];
  const statuses = sql(
    `SELECT * FROM workflow_statuses WHERE team_id='${team.id}' ORDER BY position`,
  );
  assert.equal(team.identifier_prefix, "RND");
  assert.deepEqual(
    statuses.map((s) => s.category),
    [
      "intake",
      "backlog",
      "unstarted",
      "started",
      "completed",
      "canceled",
      "duplicate",
    ],
  );
  await openAdministrationForm(page, "Edit Research");
  await capture("team-seven-categories");
  await clause(
    "TEAM-002",
    "rename team; add rename and reorder workflow status",
    async () => {
      const edit = await openAdministrationForm(page, "Edit Research");
      await edit
        .getByLabel("Team name", { exact: true })
        .fill("Research delivery");
      await edit
        .getByRole("button", { name: "Save team", exact: true })
        .click();
      await poll(
        () => sql(`SELECT name FROM teams WHERE id='${team.id}'`),
        (rows) => rows[0]?.name === "Research delivery",
        "renamed team",
      );
      const add = await openAdministrationForm(
        page,
        "Add status to Research delivery",
      );
      await add.getByLabel("Status name", { exact: true }).fill("Review ready");
      await add
        .getByRole("combobox", { name: "Status category", exact: true })
        .selectOption("started");
      await add
        .getByRole("button", { name: "Add status", exact: true })
        .click();
      await poll(
        () =>
          sql(
            `SELECT * FROM workflow_statuses WHERE team_id='${team.id}' AND name='Review ready'`,
          ),
        (rows) => rows.length === 1,
        "added status",
      );
      const rename = await openAdministrationForm(page, "Rename Review ready");
      await rename.getByLabel("Status name", { exact: true }).fill("Reviewing");
      await rename
        .getByRole("button", { name: "Rename status", exact: true })
        .click();
      await poll(
        () =>
          sql(
            `SELECT * FROM workflow_statuses WHERE team_id='${team.id}' AND name='Reviewing'`,
          ),
        (rows) => rows.length === 1,
        "renamed status",
      );
      await openAdministrationForm(page, "Rename Reviewing");
      const status = sql(
        `SELECT * FROM workflow_statuses WHERE team_id='${team.id}' AND name='Reviewing'`,
      )[0];
      const before = status.position;
      await page
        .getByRole("group", { name: "Workflow status Reviewing", exact: true })
        .getByRole("button", { name: "Move up", exact: true })
        .click();
      await poll(
        () =>
          sql(`SELECT position FROM workflow_statuses WHERE id='${status.id}'`),
        (rows) => rows[0]?.position === before - 1,
        "reordered status",
      );
      const ordered = sql(
        `SELECT position FROM workflow_statuses WHERE team_id='${team.id}' ORDER BY position`,
      ).map((s) => s.position);
      assert.equal(new Set(ordered).size, 8, "collision-free full workflow");
    },
  );
  await openAdministrationForm(page, "Rename Reviewing");
  await capture("team-workflow-authored");
  return {
    ...team,
    name: "Research delivery",
    statuses: sql(
      `SELECT * FROM workflow_statuses WHERE team_id='${team.id}' ORDER BY position`,
    ),
  };
}
export async function removeUsedStatus({
  page,
  runtime,
  capture,
  clause,
  team,
  issue,
}) {
  const { base, sql } = runtime;
  const from = team.statuses.find((s) => s.name === "Reviewing");
  const to = team.statuses.find(
    (s) => s.category === "started" && s.id !== from.id,
  );

  await beforePrivateNavigation(page, base + "/app/settings");
  await page.goto(base + "/app/settings");
  await openAdministrationForm(page, "Edit " + team.name);
  await clause(
    "TEAM-001",
    "issued identifiers freeze the team prefix in administration",
    async () => {
      const edit = await openAdministrationForm(page, "Edit " + team.name);
      assert.equal(
        await edit.getByLabel("Identifier prefix", { exact: true }).count(),
        0,
      );
      await edit
        .getByText(
          `Identifier prefix ${team.identifier_prefix} is frozen because this team has issued an identifier.`,
          { exact: true },
        )
        .waitFor();
      assert.equal(
        sql(`SELECT identifier FROM issues WHERE id='${issue.id}'`)[0]
          .identifier,
        issue.identifier,
      );
    },
  );
  await clause(
    "TEAM-004",
    "used status remaps to same-category destination and protects last category status",
    async () => {
      const before = sql(`SELECT version FROM issues WHERE id='${issue.id}'`)[0]
        .version;
      await openAdministrationForm(page, "Rename Reviewing");
      const group = page.getByRole("group", {
        name: "Workflow status Reviewing",
        exact: true,
      });
      await group.waitFor({ state: "visible" });
      assert.deepEqual(
        await group
          .getByRole("combobox", { name: "Destination status", exact: true })
          .locator("option")
          .evaluateAll((options) =>
            options.map((option) => option.value).filter(Boolean),
          ),
        team.statuses
          .filter(
            (status) =>
              status.category === from.category && status.id !== from.id,
          )
          .map((status) => status.id),
        "only same-category destinations offered",
      );
      await group
        .getByRole("combobox", { name: "Destination status", exact: true })
        .selectOption(to.id);
      const receipt = page.waitForResponse(
        (r) =>
          new URL(r.url()).pathname.endsWith("/statuses/" + from.id) &&
          r.request().method() === "DELETE",
      );
      await group
        .getByRole("button", { name: "Remove status", exact: true })
        .click();
      assert.equal((await receipt).status(), 200);
      await poll(
        () =>
          sql(`SELECT status_id,version FROM issues WHERE id='${issue.id}'`),
        (rows) =>
          rows[0]?.status_id === to.id && rows[0].version === before + 1,
        "status remap",
      );
      assert.equal(
        sql(`SELECT count(*) n FROM workflow_statuses WHERE id='${from.id}'`)[0]
          .n,
        0,
      );
      await openAdministrationForm(page, "Rename " + to.name);
      const last = page.getByRole("group", {
        name: "Workflow status " + to.name,
        exact: true,
      });
      await last.waitFor({ state: "visible" });
      await last
        .getByText("This category’s last status cannot be removed.", {
          exact: true,
        })
        .waitFor();
      assert.equal(
        await last
          .getByRole("button", { name: "Remove status", exact: true })
          .count(),
        0,
        "last status has explicit refusal",
      );
      const audit = sql(
        `SELECT * FROM issue_activity WHERE issue_id='${issue.id}' AND previous_value_json LIKE '%${from.id}%' AND next_value_json LIKE '%${to.id}%'`,
      );
      assert.equal(audit.length, 1, "immutable status mapping receipt");
      assert.ok(audit[0].actor_operator_id);
      assert.ok(audit[0].created_at);
      const retained = sql(
        `SELECT a.*,d.previous_value_json,d.next_value_json FROM audit_records a JOIN administration_audit_details d ON d.audit_id=a.id WHERE action='workflow.status_removed' AND previous_value_json LIKE '%${from.id}%' AND next_value_json LIKE '%${to.id}%'`,
      );
      assert.equal(
        retained.length,
        1,
        "destructive audit independently retains old and destination IDs",
      );
    },
  );
  await capture("status-remap-last-category-refusal");
}

/** ROLE-007 and ROLE-009 in Settings → Teams: a Member joins and leaves a
 * public team from the directory and finds its settings locked, the last team
 * owner stays, and a team owner adds members, names owners and sets the two
 * permissions. */
export async function exerciseTeamRoles({ page, runtime, clause, evidence, refusals, peer, memberId }) {
  const { base, sql } = runtime;
  const inspect = roleScreens(evidence);
  const team = sql("SELECT id,name FROM teams WHERE name='Research delivery'")[0];
  const membership = () => sql(`SELECT role FROM team_members WHERE team_id='${team.id}' AND operator_id='${memberId}'`)[0]?.role;
  const peerTeams = peer.getByRole("region", { name: "Teams", exact: true });
  const toggle = async (actor, region, action, status) => {
    const path = `/api/teams/${team.id}/${action}`;
    if (status !== 200) refusals.add(base + path);
    const done = actor.waitForResponse((r) => new URL(r.url()).pathname === path);
    await region.getByRole("button", { name: `${action === "join" ? "Join" : "Leave"} ${team.name}`, exact: true }).click();
    assert.equal((await done).status(), status);
  };
  await navigate(peer, base + "/app/settings");
  for (const width of [1440, 390]) {
    await peer.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    await clause("ROLE-007", `a Member joins a public team from the directory at ${width} and finds its settings, members and permissions locked`, async () => {
      await toggle(peer, peerTeams, "join", 200);
      await peerTeams.getByRole("button", { name: `Leave ${team.name}`, exact: true }).waitFor();
      assert.equal(membership(), "member");
      await openDisclosures(peer);
      assert.equal(await peer.getByRole("form", { name: `Edit ${team.name}`, exact: true }).locator("fieldset").isDisabled(), true);
      assert.equal(await peer.getByRole("form", { name: `Permissions for ${team.name}`, exact: true }).locator("fieldset").isDisabled(), true);
      assert.equal(await peer.getByRole("form", { name: `Add member to ${team.name}`, exact: true }).count(), 0);
      await peerTeams.getByText("Only this team's owners and Admins change its settings.", { exact: true }).first().waitFor();
    });
    if (width === 1440) {
      await inspect(peer, peerTeams, "team-member-view");
      await peer.setViewportSize({ width, height: 1000 });
    }
    await clause("ROLE-007", `the Member leaves the team from the directory at ${width}`, async () => {
      await toggle(peer, peerTeams, "leave", 200);
      await peerTeams.getByRole("button", { name: `Join ${team.name}`, exact: true }).waitFor();
      assert.equal(membership(), undefined);
    });
  }
  await navigate(page, base + "/app/settings");
  const teams = page.getByRole("region", { name: "Teams", exact: true });
  await clause("ROLE-007", "the last team owner cannot leave until another is named", async () => {
    await toggle(page, teams, "leave", 409);
    await teams.getByRole("alert").filter({ hasText: "Name another team owner before the last one leaves." }).waitFor();
  });
  await inspect(page, teams, "team-last-owner-refused");
  await clause("ROLE-007 ROLE-009", "a team owner adds a member, names a team owner and sets the two permissions, each audited once", async () => {
    await openDisclosures(page);
    const add = page.getByRole("form", { name: `Add member to ${team.name}`, exact: true });
    await add.getByRole("combobox", { name: "Member to add", exact: true }).selectOption({ label: "Role member" });
    await add.getByRole("combobox", { name: "Team role", exact: true }).selectOption("member");
    await add.getByRole("button", { name: "Add member", exact: true }).click();
    await poll(() => [membership()], ([role]) => role === "member", "member added");
    await page.getByRole("button", { name: "Make Role member a team owner", exact: true }).click();
    await poll(() => [membership()], ([role]) => role === "owner", "team owner named");
    const permissions = page.getByRole("form", { name: `Permissions for ${team.name}`, exact: true });
    await permissions.getByRole("combobox", { name: "Who manages team settings", exact: true }).selectOption("all_members");
    await permissions.getByRole("button", { name: "Save permissions", exact: true }).click();
    await poll(() => sql(`SELECT settings_permission AS value FROM teams WHERE id='${team.id}'`), (rows) => rows[0]?.value === "all_members", "settings permission");
    assert.equal(sql(`SELECT count(*) AS n FROM audit_records WHERE action='team.permission_changed' AND subject_id='${team.id}'`)[0].n, 1);
  });
  await inspect(page, teams, "team-owner-controls");
  await clause("ROLE-007", "once another team owner is named, the former last owner leaves", async () => {
    await toggle(page, teams, "leave", 200);
    assert.equal(sql(`SELECT count(*) AS n FROM team_members WHERE team_id='${team.id}' AND role='owner'`)[0].n, 1);
  });
}
