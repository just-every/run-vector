import { env } from "cloudflare:workers";
import { afterEach, expect, it, vi } from "vitest";
import { closureFixture } from "./cycle-closure-fixture";
import { bindings } from "./base-auth-fixture";
import { scheduled } from "../../src/core/app/scheduled";

afterEach(() => vi.useRealTimers());

it("[REPORT-002 CYCLE-005] daily burn-up follows completion, reopening, removal and re-addition, then freezes outcomes and assignees at closure", async () => {
  const f = await closureFixture();
  vi.useFakeTimers({ toFake: ["Date"] });
  const at = (day: string) => vi.setSystemTime(new Date(day + "T12:00:00Z"));
  const status = (category: string) => f.team.statuses.find(s => s.category === category)!.id;
  const patch = async (identifier: string, changes: Record<string, unknown>) => {
    const current = await (await f.call("/issues/" + identifier)).json() as { version: number };
    const response = await f.call("/issues/" + identifier, "PATCH", { expectedVersion: current.version, ...changes });
    expect(response.status, await response.clone().text()).toBe(200);
  };
  at("2026-08-31");
  const first = await f.create({ title: "Restore settlement receipts", cycleId: f.closing.id, statusId: status("started"), estimate: 3, assigneeOperatorId: f.owner });
  const removed = await f.create({ title: "Review duplicate charges", cycleId: f.closing.id, statusId: status("started"), estimate: 5 });
  at("2026-09-01");
  await patch(first.identifier, { statusId: status("completed") });
  at("2026-09-02");
  const added = await f.create({ title: "Reconcile delayed provider callbacks", cycleId: f.closing.id, statusId: status("started"), assigneeOperatorId: f.owner });
  await patch(removed.identifier, { cycleId: null });
  at("2026-09-03");
  await patch(added.identifier, { cycleId: null });
  await patch(removed.identifier, { cycleId: f.closing.id });
  await patch(first.identifier, { statusId: status("started") });
  at("2026-09-04");
  await patch(added.identifier, { cycleId: f.closing.id });
  await patch(first.identifier, { statusId: status("completed") });
  await patch(removed.identifier, { statusId: status("canceled") });
  at("2026-09-05");
  await patch(added.identifier, { statusId: status("completed") });
  at("2026-09-06");
  await patch(added.identifier, { statusId: status("started") });
  at("2026-09-07");
  await patch(added.identifier, { cycleId: null });
  vi.setSystemTime(new Date("2026-09-07T13:00:00Z"));
  await patch(added.identifier, { cycleId: f.closing.id });
  const live = (await f.detail()).report;
  expect(live.source).toBe("live");
  expect(live.days.map(d => [d.date, d.scope, d.completed])).toEqual([
    ["2026-09-01", 2, 1], ["2026-09-02", 2, 1], ["2026-09-03", 2, 0],
    ["2026-09-04", 2, 1], ["2026-09-05", 2, 2], ["2026-09-06", 2, 1], ["2026-09-07", 2, 1],
  ]);
  expect(live.days[1]).toMatchObject({ added: [added.identifier], removed: [removed.identifier] });
  expect(live.days[6]).toMatchObject({ added: [added.identifier], removed: [added.identifier] });
  vi.setSystemTime(new Date("2026-09-08T00:01:00Z"));
  await scheduled({ scheduledTime: Date.now() }, bindings);
  const detail = await f.detail(), frozen = detail.report, snapshot = detail.snapshot!;
  expect(frozen.source).toBe("snapshot");
  expect(frozen.days).toEqual(live.days);
  expect(frozen.completed).toEqual(snapshot.completed);
  expect(frozen.carried).toEqual([added.identifier]);
  expect(frozen.other).toEqual([removed.identifier]);
  expect(frozen.addedMidcycle).toEqual([removed.identifier, added.identifier].sort());
  expect(frozen.days.at(-1)).toMatchObject({ scope: snapshot.progress.total, completed: snapshot.progress.completed });
  expect(frozen.byAssignee).toEqual(expect.arrayContaining([
    { id: f.owner, name: "Owner", completed: 1, carried: 1, other: 0, addedMidcycle: 1 },
    { id: null, name: "Unassigned", completed: 0, carried: 0, other: 1, addedMidcycle: 1 },
  ]));
  expect(frozen.limitations).toEqual([]);
  await patch(added.identifier, { assigneeOperatorId: null, estimate: 100, statusId: status("completed") });
  const current = await (await f.call("/issues/" + first.identifier)).json() as { version: number };
  expect((await f.call("/issues/" + first.identifier, "DELETE", { expectedVersion: current.version, confirmed: true })).status).toBe(200);
  await env.DB.prepare("UPDATE operators SET name='Changed after closure' WHERE id=?").bind(f.owner).run();
  expect((await f.detail()).snapshot).toEqual(snapshot);
  expect((await f.detail()).report).toEqual(frozen);
});
