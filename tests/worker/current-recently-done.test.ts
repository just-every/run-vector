import { afterEach, expect, it, vi } from "vitest";
import { setupAdministration } from "./administration-fixture";
import type { CurrentProjection } from "../../src/core/features/streams/projection";

afterEach(() => vi.useRealTimers());

it("[CURR-005] Recently done includes the whole seventh workspace date, excludes future completions, and expires at local midnight across DST", async () => {
  const f = await setupAdministration();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-03-01T08:00:00.000Z"));
  await f.mutate("/settings", "PATCH", { timezone: "America/Los_Angeles" });
  const team = f.initial.teams[0]!;
  const completed = team.statuses.find(s => s.category === "completed")!.id;
  const first = await f.create({ title: "Restore settlement receipts", statusId: completed });
  vi.setSystemTime(new Date("2026-03-02T07:59:59.000Z")); // Still March 1 locally.
  const last = await f.create({ title: "Repair settlement retry counters", statusId: completed });
  const read = async (at: string) => {
    const response = await f.call("/current?at=" + encodeURIComponent(at));
    expect(response.status).toBe(200);
    return response.json() as Promise<CurrentProjection>;
  };
  const identifiers = (projection: CurrentProjection) => projection.sections["recently-done"].map(i => i.identifier);
  expect(identifiers(await read("2026-03-01T07:59:59.999Z"))).toEqual([]);
  expect(identifiers(await read("2026-03-01T08:00:00.000Z"))).toEqual([first.identifier]);
  // March 8 includes all of March 1, both before and after the DST jump.
  for (const at of ["2026-03-08T08:00:00.000Z", "2026-03-08T10:00:00.000Z", "2026-03-09T06:59:59.999Z"])
    expect(identifiers(await read(at))).toEqual([last.identifier, first.identifier]);
  expect(identifiers(await read("2026-03-09T07:00:00.000Z"))).toEqual([]);
  // The very same instant is still March 8 in Honolulu: membership uses the workspace date.
  await f.mutate("/settings", "PATCH", { timezone: "Pacific/Honolulu" });
  expect(identifiers(await read("2026-03-09T07:00:00.000Z"))).toEqual([last.identifier]);
});

it("[CURR-005] Recently done ranks by completion then identifier while Now keeps priority order; later edits and reopening do not fake completion", async () => {
  const f = await setupAdministration();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-19T12:00:00.000Z"));
  const team = f.initial.teams[0]!;
  const status = (category: string) => team.statuses.find(s => s.category === category)!.id;
  const older = await f.create({ title: "Repair duplicate charge detection", priority: "urgent", dueDate: "2026-10-01", statusId: status("completed") });
  const high = await f.create({ title: "Investigate checkout errors", priority: "high", statusId: status("started") });
  vi.setSystemTime(new Date("2026-10-19T12:01:00.000Z"));
  const newer = await f.create({ title: "Complete recovery runbook", priority: "none", statusId: status("completed") });
  const low = await f.create({ title: "Review retry telemetry", priority: "low", statusId: status("started") });
  const ties = [await f.create(), await f.create()];
  expect((await f.call("/issues/bulk", "POST", {
    issues: ties.map(i => ({ identifier: i.identifier, expectedVersion: i.version })),
    changes: { statusId: status("completed") },
  })).status).toBe(200);
  vi.setSystemTime(new Date("2026-10-19T12:02:00.000Z"));
  const editedResponse = await f.call("/issues/" + older.identifier, "PATCH", { expectedVersion: older.version, title: "Repair duplicate charge detection — documented" });
  expect(editedResponse.status).toBe(200);
  const edited = await editedResponse.json() as { version: number; completedAt: string; updatedAt: string };
  expect(edited.completedAt).toBe("2026-10-19T12:00:00.000Z");
  expect(edited.updatedAt > edited.completedAt).toBe(true);
  const read = async () => {
    const response = await f.call("/current");
    expect(response.status).toBe(200);
    return response.json() as Promise<CurrentProjection>;
  };
  const stream = await read();
  expect(stream.sections.now.map(i => i.identifier)).toEqual([high.identifier, low.identifier]);
  expect(stream.sections["recently-done"].map(i => i.identifier)).toEqual([newer, ...ties].map(i => i.identifier).sort().concat(older.identifier));
  expect(stream.sections["recently-done"].every(i => i.primaryReason === "completed-within-seven-days")).toBe(true);
  expect((await read()).sections).toEqual(stream.sections);
  expect((await f.call("/issues/" + older.identifier, "PATCH", { expectedVersion: edited.version, statusId: status("started") })).status).toBe(200);
  const reopened = await read();
  expect(reopened.sections["recently-done"].some(i => i.identifier === older.identifier)).toBe(false);
  expect(reopened.sections.now[0]!.identifier).toBe(older.identifier);
});
