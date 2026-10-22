import { env } from "cloudflare:workers";
import { expect, it } from "vitest";
import type { Administration } from "../../src/core/features/administration/schema";
import { roleWorkspace, snapshot } from "./role-fixture";

const teams = async (response: Response) => ((await response.json()) as Administration).teams;
const audits = (action: string) =>
  env.DB.prepare("SELECT a.actor_operator_id AS actor,d.previous_value_json AS previous,d.next_value_json AS next FROM audit_records a JOIN administration_audit_details d ON d.audit_id=a.id WHERE a.action=? ORDER BY a.id")
    .bind(action).all().then((rows) => rows.results);

it("[ROLE-007 OPS-001] a Member joins and leaves a public team from the directory, a Guest cannot join, a team keeps an owner, and leaving keeps assigned work listed for its owners", async () => {
  const w = await roleWorkspace();
  const platform = (await w.mutate("/settings/teams", "POST", { name: "Platform", identifierPrefix: "PLAT" })).teams.find((t) => t.name === "Platform")!;
  // Owners and Admins create teams and become their first team owner.
  expect(platform.members).toEqual([{ operatorId: w.owner, role: "owner" }]);
  const member = w.as(w.member), lead = w.as(w.lead), guest = w.as(w.guest);

  const joined = await member(`/teams/${platform.id}/join`, "POST", {});
  expect(joined.status).toBe(200);
  expect((await teams(joined)).find((t) => t.id === platform.id)!.members).toContainEqual({ operatorId: w.member.id, role: "member" });
  const left = await member(`/teams/${platform.id}/leave`, "POST", {});
  expect(left.status).toBe(200);
  expect((await teams(left)).find((t) => t.id === platform.id)!.members).toEqual([{ operatorId: w.owner, role: "owner" }]);

  // A Guest joins nothing by themselves, and only a team owner or Admin manages
  // members; refusals change nothing.
  const tables = ["team_members", "team_departures", "audit_records"];
  const before = await snapshot(tables);
  expect((await guest(`/teams/${platform.id}/join`, "POST", {})).status).toBe(403);
  expect((await member(`/settings/teams/${platform.id}/members/${w.member.id}`, "PUT", { role: "owner" })).status).toBe(403);
  expect(await snapshot(tables)).toEqual(before);
  // A team owner removes members, but only an Owner or Admin adds a Guest (ROLE-003).
  expect((await lead(`/settings/teams/${w.team.id}/members/${w.guest.id}`, "DELETE")).status).toBe(200);
  expect((await lead(`/settings/teams/${w.team.id}/members/${w.guest.id}`, "PUT", { role: "member" })).status).toBe(403);
  expect((await w.as(w.admin)(`/settings/teams/${w.team.id}/members/${w.guest.id}`, "PUT", { role: "member" })).status).toBe(200);

  // The last team owner stays until another is named; an Admin always may act.
  expect(await (await w.call(`/teams/${platform.id}/leave`, "POST", {})).json()).toMatchObject({ error: "last_team_owner" });
  expect((await w.as(w.admin)(`/settings/teams/${platform.id}/members/${w.lead.id}`, "PUT", { role: "owner" })).status).toBe(200);
  expect((await w.call(`/teams/${platform.id}/leave`, "POST", {})).status).toBe(200);
  expect((await lead(`/teams/${platform.id}/leave`, "POST", {})).status).toBe(409);

  // Leaving keeps assigned work assigned and listed for the team's owners.
  expect((await member(`/teams/${platform.id}/join`, "POST", {})).status).toBe(200);
  const started = platform.statuses.find((status) => status.category === "started")!.id;
  const assigned = await w.call("/issues", "POST", { title: "Rotate the platform keys", teamId: platform.id, statusId: started, assigneeOperatorId: w.member.id });
  expect(assigned.status).toBe(201);
  const issue = (await assigned.json()) as { identifier: string };
  expect((await member(`/teams/${platform.id}/leave`, "POST", {})).status).toBe(200);
  const listed = (await teams(await lead("/settings/administration"))).find((t) => t.id === platform.id)!;
  expect(listed.departedAssignments).toEqual([{ identifier: issue.identifier, title: "Rotate the platform keys", assigneeOperatorId: w.member.id }]);
  // A public team's membership never narrows what a member sees.
  expect(((await (await member(`/issues/${issue.identifier}`)).json()) as { assignee: { id: string } | null }).assignee?.id).toBe(w.member.id);
  const work = JSON.stringify(await (await member("/my-work")).json());
  expect(work).toContain(issue.identifier);
  expect(JSON.stringify(await (await member("/current")).json())).toContain(issue.identifier);
  expect(JSON.stringify(await (await member("/search?q=" + encodeURIComponent("platform keys"))).json())).toContain(issue.identifier);
  expect(JSON.stringify(await (await member("/notifications")).json())).toContain(issue.identifier);

  // Every change is audited once, with its actor and the membership before and after.
  expect((await audits("team.member_joined")).map((row) => row.actor)).toEqual([w.member.id, w.member.id]);
  expect((await audits("team.member_left")).map((row) => row.actor)).toEqual([w.member.id, w.owner, w.member.id]);
  expect((await audits("team.member_removed")).map((row) => [row.actor, JSON.parse(String(row.previous))])).toEqual([[w.lead.id, { operatorId: w.guest.id, role: "member" }]]);
  expect(await audits("team.member_role_changed")).toEqual([]);
  expect((await audits("team.member_added")).map((row) => JSON.parse(String(row.next)))).toContainEqual({ operatorId: w.lead.id, role: "owner" });
});
