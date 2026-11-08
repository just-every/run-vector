import { expect, it } from "vitest";
import { teamMembershipJourney } from "./team-membership-journey";
import {subTeamHierarchy} from "./sub-team-workflow-journey";
import {subTeamList} from "./sub-team-list-journey";

// This is the existing membership journey, extended with hierarchy and list
// outcomes. Its original assertions remain unconditional and unchanged.
it("[TEAM-006 TEAM-007 TEAM-008 ROLE-007 OPS-001] team hierarchy, membership, workflow and paged visible issues retain identity and current access", async () => {
  await teamMembershipJourney();
  await subTeamHierarchy();
  await subTeamList();
}, 120_000);


import { env } from "cloudflare:workers";
import { roleWorkspace, resetLimits, snapshot } from "./role-fixture";
import { team, current, change } from "./sub-team-fixture";

it("[TEAM-006 ROLE-009] hierarchy permission values require the same team-owner authority as the permission door", async () => {
  const w = await roleWorkspace();
  expect((await w.call(`/settings/teams/${w.team.id}/permissions`, "PUT", {
    settings: "all_members", planning: "all_members",
  })).status).toBe(200);
  for (const surface of ["call", "api"] as const) {
    await resetLimits();
    const before = await snapshot(["teams", "workflow_statuses", "audit_records", "administration_audit_details"]);
    expect((await w.member.call(`/settings/teams/${w.team.id}/permissions`, "PUT", {
      settings: "all_members", planning: "team_owners",
    })).status).toBe(403);
    expect((await change(w, w.team.id, { planningPermission: "team_owners" }, w.member, surface)).status).toBe(403);
    expect(await snapshot(["teams", "workflow_statuses", "audit_records", "administration_audit_details"])).toEqual(before);
  }
  for (const who of [w.lead, w.admin, w.people.owner]) {
    expect((await change(w, w.team.id, { planningPermission: "team_owners" }, who)).status).toBe(200);
    expect((await current(w, w.team.id)).planningPermission).toBe("team_owners");
  }
});

it("[TEAM-006 GITHUB-003] reparenting preserves configured Git automation targets and rule custody", async () => {
  const w = await roleWorkspace();
  const child = await team(w, "synthetic-vector-6250", "GITSUB", w.team.id);
  const destination = await team(w, "synthetic-vector-6251", "GITDEST");
  const descendant = await team(w, "synthetic-vector-6252", "GITDESC", child.id);
  for (const selected of [child, descendant]) {
    const status = selected.statuses.find(s => s.category === "started")!;
    expect((await w.call(`/settings/teams/${selected.id}`, "PATCH", {
      githubAutomation: { trigger: "review", statusId: status.id, allowReopen: true, expectedVersion: 0 },
    })).status).toBe(200);
  }
  expect((await change(w, child.id, { parentTeamId: destination.id })).status).toBe(200);
  for (const selected of [child, descendant]) {
    const effective = await current(w, selected.id);
    const rule = await env.DB.prepare("SELECT status_id,allow_reopen,version,production_environment FROM github_automation_rules WHERE team_id=? AND trigger='review'").bind(selected.id).first();
    expect(rule).toMatchObject({
      status_id: effective.statuses.find(s => s.category === "started")!.id,
      allow_reopen: 1, version: 2, production_environment: "production",
    });
    // An editor holding the old target cannot overwrite the remapped rule.
    expect((await w.call(`/settings/teams/${selected.id}`, "PATCH", {
      githubAutomation: { trigger: "review", statusId: effective.statuses.find(s => s.category === "backlog")!.id, allowReopen: false, expectedVersion: 1 },
    })).status).toBe(409);
  }
  expect((await env.DB.prepare("PRAGMA foreign_key_check").all()).results).toEqual([]);
});
