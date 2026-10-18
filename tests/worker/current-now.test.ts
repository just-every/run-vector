import { expect, it } from "vitest";
import { setupAdministration } from "./administration-fixture";
import type { CurrentProjection } from "../../src/core/features/streams/projection";

it("[CURR-003] Now uses workspace midnight, includes overdue backlog and started work, and excludes intake, terminal and deferred work", async () => {
  const f = await setupAdministration();
  await f.mutate("/settings", "PATCH", { timezone: "America/Los_Angeles" });
  const team = f.initial.teams[0]!;
  const status = (category: string) => team.statuses.find(s => s.category === category)!.id;
  const started = await f.create({ title: "Investigate payment retries", statusId: status("started"), dueDate: "2026-03-20" });
  const backlog = await f.create({ title: "Reconcile overdue settlements", dueDate: "2026-03-07" });
  const unstarted = await f.create({ title: "Review payment failure alert", statusId: status("unstarted"), dueDate: "2026-03-07" });
  const canceled = await f.create({ statusId: status("canceled"), dueDate: "2026-03-01" });
  const completed = await f.create({ statusId: status("completed"), dueDate: "2026-03-01" });
  const duplicate = await f.create({ dueDate: "2026-03-01" });
  expect((await f.call(`/issues/${duplicate.identifier}/duplicate`, "POST", {
    expectedVersion: duplicate.version, canonicalIdentifier: started.identifier,
  })).status).toBe(200);
  const intakeResponse = await f.call("/intake", "POST", { teamId: team.id, title: "Awaiting provider evidence" });
  expect(intakeResponse.status).toBe(201);
  const intake = await intakeResponse.json() as { identifier: string; version: number };
  expect((await f.call(`/issues/${intake.identifier}/defer`, "POST", {
    expectedVersion: intake.version, returnAt: new Date(Date.now() + 600000).toISOString(),
  })).status).toBe(200);
  const read = async (at: string) => {
    const response = await f.call("/current?at=" + encodeURIComponent(at));
    expect(response.status).toBe(200);
    return response.json() as Promise<CurrentProjection>;
  };
  const before = await read("2026-03-08T07:59:59.000Z"); // March 7 in the workspace
  expect(before.sections.now.map(i => i.identifier)).toEqual([started.identifier]);
  expect(before.sections.now[0]!.primaryReason).toBe("started-work");
  const after = await read("2026-03-08T08:00:00.000Z"); // March 8, before the DST jump
  expect(after.sections.now.map(i => i.identifier).sort()).toEqual([started.identifier, backlog.identifier, unstarted.identifier].sort());
  for (const issue of [backlog, unstarted]) {
    expect(after.sections.now.find(i => i.identifier === issue.identifier)?.primaryReason).toBe("overdue");
    expect(after.sections.next.some(i => i.identifier === issue.identifier)).toBe(false);
  }
  const afterDst = await read("2026-03-08T10:00:00.000Z");
  expect(afterDst.sections.now).toEqual(after.sections.now);
  for (const issue of [canceled, completed, duplicate, intake])
    expect(after.sections.now.some(i => i.identifier === issue.identifier)).toBe(false);
  // Changing the workspace clock changes classification, never the stored due date.
  await f.mutate("/settings", "PATCH", { timezone: "Pacific/Honolulu" });
  expect((await read("2026-03-08T08:00:00.000Z")).sections.now.map(i => i.identifier)).toEqual([started.identifier]);
  expect((await (await f.call("/issues/" + backlog.identifier)).json() as { dueDate: string }).dueDate).toBe("2026-03-07");
});
