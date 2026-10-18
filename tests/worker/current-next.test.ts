import { expect, it } from "vitest";
import { setupAdministration } from "./administration-fixture";
import type { CurrentProjection } from "../../src/core/features/streams/projection";

it("[CURR-004] Next uses seven workspace calendar days and each team's active or next cycle, with Now and Intake taking precedence", async () => {
  const f = await setupAdministration();
  await f.mutate("/settings", "PATCH", { timezone: "America/Los_Angeles" });
  const team = f.initial.teams[0]!;
  const status = (category: string) => team.statuses.find(s => s.category === category)!.id;
  const create = (extra: Record<string, unknown>) => f.create({ statusId: status("unstarted"), ...extra });
  const day = (date: string) => create({ title: "Due on " + date, dueDate: date });
  const yesterday = await day("2030-03-09");
  const today = await day("2030-03-10");
  const seventh = await day("2030-03-17");
  const eighth = await day("2030-03-18");
  const backlog = await create({ statusId: status("backlog"), dueDate: "2030-03-17" });
  const started = await create({ statusId: status("started"), dueDate: "2030-03-17" });
  const completed = await create({ statusId: status("completed"), dueDate: "2030-03-17" });
  const cycle = async (teamId: string, name: string, start: string, end: string) => {
    const state = await f.mutate("/settings/cycles", "POST", { teamId, name, startsLocal: start + "T00:00", endsLocal: end + "T00:00" });
    return state.cycles.find(c => c.name === name)!;
  };
  const active = await cycle(team.id, "Settlement recovery", "2030-03-09", "2030-03-11");
  const next = await cycle(team.id, "Settlement hardening", "2030-03-11", "2030-03-18");
  const later = await cycle(team.id, "Provider migration", "2030-03-18", "2030-03-25");
  const activeIssue = await create({ cycleId: active.id });
  const nextIssue = await create({ cycleId: next.id });
  const laterIssue = await create({ cycleId: later.id });
  const overdueCycle = await create({ cycleId: active.id, dueDate: "2030-03-09" });
  const backlogCycle = await create({ cycleId: active.id, statusId: status("backlog") });
  const teams = await f.mutate("/settings/teams", "POST", { name: "Infrastructure", identifierPrefix: "INFRA" });
  const other = teams.teams.find(t => t.identifierPrefix === "INFRA")!;
  await cycle(other.id, "Infrastructure active", "2030-03-01", "2030-03-15");
  const otherNext = await cycle(other.id, "Infrastructure next", "2030-03-15", "2030-03-22");
  const otherIssue = await f.create({ teamId: other.id, statusId: other.statuses.find(s => s.category === "unstarted")!.id, cycleId: otherNext.id });
  const intakeResponse = await f.call("/intake", "POST", { teamId: team.id, title: "Assess provider retry evidence" });
  expect(intakeResponse.status).toBe(201);
  const intake = await intakeResponse.json() as { identifier: string; version: number };
  expect((await f.call("/issues/" + intake.identifier, "PATCH", { expectedVersion: intake.version, dueDate: "2030-03-10" })).status).toBe(200);
  const read = async (at: string) => {
    const response = await f.call("/current?at=" + encodeURIComponent(at));
    expect(response.status).toBe(200);
    return response.json() as Promise<CurrentProjection>;
  };
  const before = await read("2030-03-10T07:59:59.000Z"); // Still March 9 in Los Angeles
  expect(before.sections.next.some(i => i.identifier === seventh.identifier)).toBe(false);
  const atMidnight = await read("2030-03-10T08:00:00.000Z");
  const afterDst = await read("2030-03-10T10:00:00.000Z");
  expect(afterDst.sections.next).toEqual(atMidnight.sections.next);
  expect(atMidnight.sections.next.map(i => i.identifier).sort()).toEqual([today, seventh, activeIssue, nextIssue, otherIssue].map(i => i.identifier).sort());
  for (const issue of [today, seventh])
    expect(atMidnight.sections.next.find(i => i.identifier === issue.identifier)?.primaryReason).toBe("due-within-seven-days");
  for (const issue of [activeIssue, nextIssue, otherIssue])
    expect(atMidnight.sections.next.find(i => i.identifier === issue.identifier)?.primaryReason).toBe("cycle-commitment");
  for (const issue of [yesterday, eighth, backlog, started, completed, laterIssue, overdueCycle, backlogCycle, intake])
    expect(atMidnight.sections.next.some(i => i.identifier === issue.identifier)).toBe(false);
  expect(atMidnight.sections["needs-decision"].some(i => i.identifier === intake.identifier)).toBe(true);
  expect(atMidnight.sections.now.some(i => i.identifier === overdueCycle.identifier)).toBe(true);
  // At the exact end instant, the old next cycle is active and the later one becomes next.
  const rolled = await read("2030-03-11T07:00:00.000Z");
  expect(rolled.sections.next.some(i => i.identifier === activeIssue.identifier)).toBe(false);
  expect(rolled.sections.next.some(i => i.identifier === nextIssue.identifier)).toBe(true);
  expect(rolled.sections.next.some(i => i.identifier === laterIssue.identifier)).toBe(true);
});
