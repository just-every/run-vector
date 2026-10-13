import { expect, it } from "vitest";
import { contractWith } from "../contract-tags";
import { projectRulesFixture, future, past } from "./project-rules-fixture";
import type { ProjectDetail, ProjectHealth } from "../../src/core/features/projects/service";

contractWith(it, "PROJ-003", "project attachment, movement, detachment and archive preserve the issue", async () => {
  const f = await projectRulesFixture();
  const first = await f.project("First membership"), second = await f.project("Second membership");
  const issue = await f.create({ title: "Membership survives" });
  await f.patch(issue.identifier, { projectId: first.id });
  expect((await f.detail(first.id)).issues.map((i) => i.id)).toEqual([issue.id]);
  await f.patch(issue.identifier, { projectId: second.id });
  expect((await f.detail(first.id)).issues).toEqual([]);
  expect((await f.detail(second.id)).issues.map((i) => i.id)).toEqual([issue.id]);
  await f.patch(issue.identifier, { projectId: null });
  expect((await f.detail(second.id)).issues).toEqual([]);
  expect(await f.issue(issue.identifier)).toMatchObject({ id: issue.id, title: "Membership survives", project: null });
  await f.patch(issue.identifier, { projectId: second.id });
  await f.mutate(`/settings/projects/${second.id}`, "PATCH", { archived: true });
  expect((await f.portfolio()).projects.map((p) => p.id)).not.toContain(second.id);
  expect((await f.portfolio(true)).projects.find((p) => p.id === second.id)?.archived).toBe(true);
  expect((await f.detail(second.id)).issues.map((i) => i.id)).toEqual([issue.id]);
  expect(await f.issue(issue.identifier)).toMatchObject({ id: issue.id, project: { id: second.id } });
});

contractWith(it, "PROJ-003", "deleting a project through settings detaches every member and preserves every issue", async () => {
  const f = await projectRulesFixture();
  const project = await f.project("Disposable project"), untouched = await f.project("Unrelated project");
  const members = [];
  for (const category of ["intake", "backlog", "unstarted", "started", "completed", "canceled", "duplicate"]) {
    members.push(await f.create({ title: `Retain ${category}`, projectId: project.id, statusId: f.status(category) }));
  }
  const outside = await f.create({ projectId: untouched.id });
  await f.mutate(`/settings/projects/${project.id}`, "PATCH", { archived: true });
  await f.mutate(`/settings/projects/${project.id}`, "DELETE");
  expect((await f.call(`/projects/${project.id}`)).status).toBe(404);
  expect((await f.portfolio(true)).projects.map((p) => p.id)).not.toContain(project.id);
  for (const member of members) {
    expect(await f.issue(member.identifier)).toMatchObject({ id: member.id, identifier: member.identifier, project: null });
  }
  expect(await f.issue(outside.identifier)).toMatchObject({ id: outside.id, project: { id: untouched.id } });
});

contractWith(it, "PROJ-004", "project progress counts completed issues and excludes canceled and duplicate issues, including an empty denominator", async () => {
  const f = await projectRulesFixture();
  const project = await f.project("Count the work");
  const read = async (completed: number, total: number, percentage: number | null) => {
    const [detail, portfolio] = await Promise.all([f.detail(project.id), f.portfolio()]);
    for (const result of [detail, portfolio.projects.find((p) => p.id === project.id)!]) {
      expect(result.progress).toEqual({ completed, total, percentage });
    }
  };
  await read(0, 0, null);
  for (const category of ["canceled", "duplicate"]) await f.create({ projectId: project.id, statusId: f.status(category) });
  await read(0, 0, null);
  const remaining = [];
  for (const category of ["intake", "backlog", "unstarted", "started"]) {
    remaining.push(await f.create({ projectId: project.id, statusId: f.status(category), estimate: 100 }));
  }
  await f.create({ projectId: project.id, statusId: f.status("completed"), estimate: 1 });
  await read(1, 5, 20);
  await f.patch(remaining[2].identifier, { statusId: f.status("completed") });
  await read(2, 5, 40);
  await f.patch(remaining[1].identifier, { statusId: f.status("canceled") });
  await read(2, 4, 50);
});

contractWith(it, "PROJ-005 PROJ-006", "project health matrix applies precedence, exact capacity boundaries and concrete risk explanations", async () => {
  const f = await projectRulesFixture();
  const cycle = await f.cycle("Delivery window", 8);
  const state = await f.mutate("/settings/teams", "POST", { name: "Other delivery", identifierPrefix: "OTH" });
  const otherTeam = state.teams.find((t) => t.identifierPrefix === "OTH")!;
  const unknownCycle = await f.cycle("Unknown capacity window", null, otherTeam.id);
  const cases: Array<{ id: string; health: ProjectHealth }> = [];
  async function project(name: string, health: ProjectHealth, date: string | null = future, lifecycle = "active") {
    const p = await f.project(name, date, lifecycle);
    cases.push({ id: p.id, health });
    return p;
  }
  const create = (projectId: string, extra: Record<string, unknown> = {}) => f.create({
    projectId, statusId: f.status("unstarted"), assigneeOperatorId: f.owner, ...extra,
  });
  const blocker = await f.create({ title: "Release dependency", statusId: f.status("unstarted") });
  const urgent = await project("Urgent blocker takes precedence", "blocked", past);
  const urgentIssue = await create(urgent.id, { priority: "urgent", assigneeOperatorId: null, cycleId: cycle.id, estimate: 9 });
  await create(urgent.id);
  await f.block(urgentIssue.identifier, blocker.identifier);
  const all = await project("All remaining blocked", "blocked");
  const blockedIssues = [await create(all.id), await create(all.id)];
  for (const issue of blockedIssues) await f.block(issue.identifier, blocker.identifier);
  for (const category of ["completed", "canceled", "duplicate"]) await create(all.id, { statusId: f.status(category) });
  const some = await project("Only some nonurgent blocked", "on-track");
  const partial = await create(some.id);
  await create(some.id);
  await f.block(partial.identifier, blocker.identifier);

  const exposed = await project("Every measurable exposure", "at-risk", past);
  const unowned = await create(exposed.id, { priority: "urgent", assigneeOperatorId: null, cycleId: cycle.id, estimate: 5 });
  const overflow = await create(exposed.id, { cycleId: cycle.id, estimate: 4 });
  const overdue = await project("Target alone is exposed", "at-risk", past);
  await create(overdue.id);
  const unassigned = await project("Urgency alone is exposed", "at-risk", null);
  await create(unassigned.id, { priority: "urgent", assigneeOperatorId: null });
  const capacity = await project("Capacity alone is exposed", "at-risk");
  await create(capacity.id, { cycleId: cycle.id, estimate: 9 });
  const knownOverflow = await project("Known overflow remains exposed with missing estimates", "at-risk");
  await create(knownOverflow.id, { cycleId: cycle.id, estimate: 9 });
  await create(knownOverflow.id, { cycleId: cycle.id, estimate: null });
  const equal = await project("Exact capacity is on track", "on-track");
  await create(equal.id, { cycleId: cycle.id, estimate: 3 });
  await create(equal.id, { cycleId: cycle.id, estimate: 5 });
  // Terminal work contributes neither blockers, urgency nor committed remaining points.
  for (const category of ["completed", "canceled", "duplicate"]) {
    const terminal = await create(equal.id, { statusId: f.status(category), priority: "urgent", assigneeOperatorId: null, cycleId: cycle.id, estimate: 100 });
    await f.block(terminal.identifier, blocker.identifier);
  }
  await project("No target", "unknown", null);
  await project("Target today is not future", "unknown", "2030-06-04");
  const missingEstimate = await project("Missing active estimate", "unknown");
  await create(missingEstimate.id, { cycleId: cycle.id });
  const missingCapacity = await project("Missing applicable capacity", "unknown");
  await create(missingCapacity.id, { teamId: otherTeam.id, statusId: otherTeam.statuses.find((s) => s.category === "unstarted")!.id, cycleId: unknownCycle.id, estimate: 2 });
  await project("Empty active future project", "on-track");
  for (const lifecycle of ["planned", "completed", "canceled"]) {
    const inactive = await project(`Inactive ${lifecycle}`, "none", past, lifecycle);
    const issue = await create(inactive.id, { priority: "urgent", assigneeOperatorId: null, cycleId: cycle.id, estimate: 100 });
    await f.block(issue.identifier, blocker.identifier);
  }

  const portfolio = await f.portfolio();
  const details = new Map<string, ProjectDetail>();
  for (const row of cases) {
    const detail = await f.detail(row.id);
    details.set(row.id, detail);
    expect.soft(detail.health, detail.name).toBe(row.health);
    expect.soft(portfolio.projects.find((p) => p.id === row.id)?.health, detail.name).toBe(row.health);
    if (["none", "unknown", "on-track"].includes(row.health)) expect(detail.risks).toEqual([]);
  }
  for (const health of ["blocked", "at-risk", "on-track", "unknown"]) {
    expect.soft(portfolio.counts[health]).toBe(cases.filter((p) => p.health === health).length);
  }
  expect.soft(portfolio.counts.none).toBeUndefined();
  for (const [p, issues] of [[urgent, [urgentIssue]], [all, blockedIssues]] as const) {
    const detail = details.get(p.id)!;
    const risk = detail.risks.find((r) => r.kind === "unresolved-dependency")!;
    expect(risk.issueIdentifiers?.slice().sort()).toEqual(issues.map((i) => i.identifier).sort());
    for (const issue of issues) expect(detail.dependencies).toContainEqual(expect.objectContaining({
      blockedIssue: expect.objectContaining({ identifier: issue.identifier }),
      blockingIssue: expect.objectContaining({ identifier: blocker.identifier }), unresolved: true,
    }));
    expect(detail.risks.every((r) => r.kind === "unresolved-dependency")).toBe(true);
  }
  const risks = details.get(exposed.id)!.risks;
  expect(risks.find((r) => r.kind === "target-date")?.message).toContain(past);
  expect(risks.find((r) => r.kind === "unassigned-urgent")?.issueIdentifiers).toEqual([unowned.identifier]);
  const capacityRisk = risks.find((r) => r.kind === "capacity")!;
  expect(capacityRisk.issueIdentifiers?.slice().sort()).toEqual([unowned.identifier, overflow.identifier].sort());
  expect(capacityRisk.message).toContain(cycle.name);
  // Pin the evidence values, not prose: the user can identify the cycle, scope and limit.
  expect(capacityRisk.message.match(/\b\d+\b/g)?.map(Number)).toEqual(expect.arrayContaining([9, cycle.capacity!]));
  expect(details.get(exposed.id)!.cycles).toContainEqual(expect.objectContaining({ id: cycle.id, remainingEstimatedPoints: 9, capacity: 8 }));
});
