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


import { defaultParseSearch } from "@tanstack/react-router";
import { issueListQuerySchema } from "../../src/core/features/issues/list-schema";

it("[TEAM-006 REPORT-003] browser-parsed full-list links retain explicit sub-team inclusion and exclusion", async () => {
  const w = await roleWorkspace();
  const child = await team(w, "synthetic-vector-6253", "LINKSUB", w.team.id);
  const parentIssue = await w.create({ teamId: w.team.id, title: "synthetic-vector-6254" });
  const childIssue = await w.create({ teamId: child.id, title: "synthetic-vector-6255" });
  for (const include of ["false", "true"] as const) {
    // Dashboard links serialize the complete filter set. The browser router
    // decodes these boolean-looking query values before validating the route.
    const search = "?team=" + w.team.id + "&includeSubTeams=" + include;
    const query = issueListQuerySchema.parse(defaultParseSearch(search));
    expect(query.includeSubTeams).toBe(include);
    const response = await w.call("/issues?" + new URLSearchParams(
      Object.entries(query).map(([key, value]) => [key, String(value)]),
    ));
    expect(response.status).toBe(200);
    const list = await response.json() as { issues: Array<{ identifier: string }> };
    expect(list.issues.map(issue => issue.identifier).sort()).toEqual(
      (include === "true" ? [parentIssue.identifier, childIssue.identifier] : [parentIssue.identifier]).sort(),
    );
  }
});


it("[TEAM-006 ROLE-009] child permission door refuses ordinary Members for every permission key and admits owners", async () => {
  const w = await roleWorkspace();
  const child = await team(w, "synthetic-vector-6256", "PERMCHILD", w.team.id);
  const descendant = await team(w, "synthetic-vector-6257", "PERMDESC", child.id);
  for (const who of [w.member, w.lead]) {
    expect((await w.call(`/settings/teams/${child.id}/members/${who.id}`, "PUT", {
      role: who === w.lead ? "owner" : "member",
    })).status).toBe(200);
  }
  expect((await w.call(`/settings/teams/${w.team.id}/permissions`, "PUT", {
    settings: "all_members", planning: "team_owners",
  })).status).toBe(200);
  const tables = ["teams", "workflow_statuses", "audit_records", "administration_audit_details"];
  for (const key of ["planning", "settings"] as const) {
    await resetLimits();
    const initial = { settings: "all_members", planning: "team_owners" } as const;
    expect((await w.call(`/settings/teams/${child.id}/permissions`, "PUT", initial)).status).toBe(200);
    const next = { ...initial, [key]: key === "planning" ? "all_members" : "team_owners" };
    const before = await snapshot(tables);
    const root = await w.member.call(`/settings/teams/${w.team.id}/permissions`, "PUT", next);
    const hierarchy = await change(w, child.id, {
      [key === "planning" ? "planningPermission" : "settingsPermission"]: next[key],
    }, w.member);
    const member = await w.member.call(`/settings/teams/${child.id}/permissions`, "PUT", next);
    console.log(`PROBE ${key}: root=${root.status}; hierarchy=${hierarchy.status}; child Member=${member.status}`);
    expect(root.status).toBe(403);
    expect(hierarchy.status).toBe(403);
    expect(member.status).toBe(403);
    expect(await snapshot(tables)).toEqual(before);
    // A denied no-op must not disable inheritance or create an audit either.
    expect((await w.member.call(`/settings/teams/${child.id}/permissions`, "PUT", initial)).status).toBe(403);
    expect(await snapshot(tables)).toEqual(before);
    for (const who of [w.lead, w.admin, w.people.owner]) {
      const owner = await who.call(`/settings/teams/${child.id}/permissions`, "PUT", next);
      expect(owner.status).toBe(200);
      expect(await current(w, child.id)).toMatchObject({
        settingsPermission: next.settings, planningPermission: next.planning,
      });
      expect(await current(w, descendant.id)).toMatchObject({
        permissionsInherited: true, settingsPermission: next.settings, planningPermission: next.planning,
      });
      expect((await w.call(`/settings/teams/${child.id}/permissions`, "PUT", initial)).status).toBe(200);
      if (who === w.people.owner) console.log(`PROBE child permission door: Member -> ${member.status}; Owner -> ${owner.status}`);
    }
  }
});


it("[TEAM-006 ROLE-009] hierarchy inheritance cannot bypass permission authority", async () => {
  const w = await roleWorkspace();
  const child = await team(w, "synthetic-vector-6258", "PERMINH", w.team.id);
  const destination = await team(w, "synthetic-vector-6259", "PERMDEST");
  for (const id of [child.id, destination.id]) {
    expect((await w.call(`/settings/teams/${id}/members/${w.member.id}`, "PUT", { role: "member" })).status).toBe(200);
  }
  expect((await w.call(`/settings/teams/${w.team.id}/permissions`, "PUT", {
    settings: "all_members", planning: "team_owners",
  })).status).toBe(200);
  expect((await w.call(`/settings/teams/${destination.id}/permissions`, "PUT", {
    settings: "all_members", planning: "all_members",
  })).status).toBe(200);
  const tables = ["teams", "workflow_statuses", "audit_records", "administration_audit_details"];
  for (const surface of ["call", "api"] as const) {
    await resetLimits();
    const before = await snapshot(tables);
    const reparent = await change(w, child.id, { parentTeamId: destination.id }, w.member, surface);
    console.log(`AUDIT ${surface} inherited reparent Member=${reparent.status}`);
    expect(reparent.status).toBe(403);
    expect(await snapshot(tables)).toEqual(before);
    expect((await change(w, child.id, { parentTeamId: destination.id }, w.people.owner, surface)).status).toBe(200);
    expect((await current(w, child.id)).planningPermission).toBe("all_members");
    expect((await change(w, child.id, { permissionsInherited: false, planningPermission: "team_owners" })).status).toBe(200);
    const custom = await snapshot(tables);
    const inherit = await change(w, child.id, { permissionsInherited: true }, w.member, surface);
    console.log(`AUDIT ${surface} inherited permission switch Member=${inherit.status}`);
    expect(inherit.status).toBe(403);
    expect(await snapshot(tables)).toEqual(custom);
    expect((await change(w, child.id, { permissionsInherited: true }, w.people.owner, surface)).status).toBe(200);
    expect((await current(w, child.id)).planningPermission).toBe("all_members");
    expect((await change(w, child.id, { parentTeamId: w.team.id })).status).toBe(200);
  }
});
