import { expect, it } from "vitest";
import { setupAdministration } from "./administration-fixture";
import type { CurrentProjection } from "../../src/core/features/streams/projection";

it("[CURR-001] Current assigns overlapping work to one section and excludes canceled, duplicate, deferred and deleted issues", async () => {
  const f = await setupAdministration();
  const team = f.initial.teams[0]!;
  const status = (category: string) => team.statuses.find(row => row.category === category)!.id;
  const day = (offset: number) => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);
  const state = await f.mutate("/settings/cycles", "POST", {
    teamId: team.id, name: "Payment recovery", startsLocal: day(-2) + "T00:00", endsLocal: day(10) + "T00:00",
  });
  const cycleId = state.cycles.find(row => row.name === "Payment recovery")!.id;
  type Issue = { identifier: string; version: number };
  const write = async (path: string, method: string, input: unknown, expected = 200) => {
    const response = await f.call(path, method, input);
    expect(response.status, await response.clone().text()).toBe(expected);
    return response.json() as Promise<Issue>;
  };
  const intake = async (title: string) => {
    const issue = await write("/intake", "POST", { teamId: team.id, title }, 201);
    return write("/issues/" + issue.identifier, "PATCH", {
      expectedVersion: issue.version, dueDate: day(-1), cycleId,
    });
  };
  const [decision, started, overdue, next, done, canceled, duplicate, deferred, deleted, backlog] = await Promise.all([
    intake("Assess provider settlement evidence"),
    f.create({ title: "Investigate missing payment acknowledgements", statusId: status("started"), dueDate: day(2), cycleId }),
    f.create({ title: "Reconcile overdue settlements", statusId: status("unstarted"), dueDate: day(-1), cycleId }),
    f.create({ title: "Document settlement recovery", statusId: status("unstarted"), dueDate: day(2), cycleId }),
    f.create({ title: "Ship corrected receipt matching", statusId: status("completed"), dueDate: day(-1) }),
    f.create({ title: "Retire obsolete provider alert", statusId: status("canceled"), dueDate: day(-1) }),
    f.create({ title: "Repeated report of missing acknowledgements", statusId: status("started"), dueDate: day(-1) }),
    intake("Wait for the provider reconciliation file"),
    f.create({ title: "Remove an accidentally logged incident", statusId: status("started"), dueDate: day(-1) }),
    f.create({ title: "Explore a future provider migration", statusId: status("backlog") }),
  ]);
  await Promise.all([
    write(`/issues/${duplicate.identifier}/duplicate`, "POST", {
      expectedVersion: duplicate.version, canonicalIdentifier: started.identifier,
    }),
    write(`/issues/${deferred.identifier}/defer`, "POST", {
      expectedVersion: deferred.version, returnAt: new Date(Date.now() + 3600000).toISOString(), reason: "Wait for the provider file",
    }),
    write(`/issues/${deleted.identifier}`, "DELETE", { expectedVersion: deleted.version, confirmed: true }),
  ]);
  const response = await f.call("/current");
  expect(response.status).toBe(200);
  const stream = await response.json() as CurrentProjection;
  const expected = {
    "needs-decision": [decision], now: [started, overdue], next: [next], "recently-done": [done],
  };
  for (const [section, issues] of Object.entries(expected)) {
    expect(stream.sections[section as keyof typeof stream.sections].map(row => row.identifier).sort())
      .toEqual(issues.map(row => row.identifier).sort());
  }
  const identifiers = Object.values(stream.sections).flat().map(row => row.identifier);
  expect(new Set(identifiers).size).toBe(identifiers.length);
  for (const issue of [canceled, duplicate, deferred, deleted, backlog])
    expect(identifiers).not.toContain(issue.identifier);
  expect((await f.call("/issues/" + deleted.identifier)).status).toBe(404);
});
