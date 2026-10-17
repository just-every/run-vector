import { expect, it } from "vitest";
import { collaborationFixture } from "./collaboration-fixture";

async function result(response: Response, status = 200): Promise<any> {
  expect(response.status, await response.clone().text()).toBe(status);
  return response.json();
}

it("[CMD-004 ISSUE-012 VIEW-004 REL-004] selected team and duplicate commands preserve work and reject the entire stale selection", async () => {
  const f = await collaborationFixture();
  const team = f.initial.teams[0];
  const state = await result(await f.call("/settings/teams", "POST", { name: "Checkout platform", identifierPrefix: "PAY" }));
  const destination = state.teams.find((row: any) => row.identifierPrefix === "PAY");
  const status = (category: string) => destination.statuses.find((row: any) => row.category === category).id;
  await result(await f.call("/settings/cycles", "POST", {
    teamId: team.id, name: "Payment hardening", startsLocal: "2027-02-01T09:00", endsLocal: "2027-02-08T09:00", capacity: 20,
  }));
  const options = await f.data(f.cookie, "/options");
  const cycle = options.cycles.find((row: any) => row.name === "Payment hardening");
  const started = await f.create({ statusId: team.statuses.find(row => row.category === "started")!.id, cycleId: cycle.id,
    assigneeOperatorId: f.owner, description: "Keep payment reproduction steps" });
  expect(started.cycle?.id).toBe(cycle.id);
  const intake = await result(await f.call("/intake", "POST", { title: "Payment callback evidence", teamId: team.id }), 201);
  const read = (identifier: string) => f.data(f.cookie, "/issues/" + identifier);
  const selected = [started, intake];
  const request = { teamId: destination.id, issues: selected.map(row => ({ identifier: row.identifier, expectedVersion: row.version, statusId: status(row.status.category) })) };
  const moved = await result(await f.any(f.bobCookie, "/issues/bulk/team", "POST", request));
  expect(moved.changed).toBe(2);
  for (const original of selected) {
    const current = await read(original.identifier);
    expect(current.team.id).toBe(destination.id);
    expect(current.status.category).toBe(original.status.category);
    expect(current.version).toBe(original.version + 1);
    expect(current.cycle).toBeNull();
    expect(current.description).toBe(original.description);
    expect(current.assignee).toEqual(original.assignee);
    expect(current.project).toEqual(original.project);
    expect(current.labels).toEqual(original.labels);
    expect(current.activity.filter((row: any) => row.kind === "issue.team_moved")).toHaveLength(1);
  }
  const before = await Promise.all(selected.map(row => read(row.identifier)));
  await result(await f.any(f.bobCookie, "/issues/bulk/team", "POST", request), 409);
  expect(await Promise.all(selected.map(row => read(row.identifier)))).toEqual(before);
  const inbox = await f.data(f.cookie, "/notifications?limit=50");
  for (const issue of selected) expect(inbox.items.filter((row: any) => row.identifier === issue.identifier)).toMatchObject([{ causes: ["status"] }]);

  const canonical = await f.create();
  const a = await f.create({ description: "Retained diagnosis" });
  const b = await f.create();
  const incoming = await f.create();
  await result(await f.call(`/issues/${incoming.identifier}/duplicate`, "POST", { expectedVersion: incoming.version, canonicalIdentifier: a.identifier }));
  const commands = [a, b].map(row => ({ identifier: row.identifier, expectedVersion: row.version }));
  const decided = await result(await f.any(f.bobCookie, "/issues/bulk/duplicate", "POST", { issues: commands, canonicalIdentifier: canonical.identifier }));
  expect(decided.changed).toBe(2);
  const duplicates = await Promise.all([a, b, incoming].map(row => read(row.identifier)));
  for (const issue of duplicates) expect(issue.canonical.identifier).toBe(canonical.identifier);
  expect(duplicates[0].description).toBe(a.description);
  expect(duplicates[2].version).toBe(incoming.version + 2);
  expect((await read(canonical.identifier)).duplicates).toHaveLength(3);
  const unchanged = await Promise.all([a, b, incoming].map(row => read(row.identifier)));
  await result(await f.any(f.bobCookie, "/issues/bulk/duplicate", "POST", { issues: commands, canonicalIdentifier: null }), 409);
  expect(await Promise.all([a, b, incoming].map(row => read(row.identifier)))).toEqual(unchanged);
  const restore = duplicates.slice(0, 2).map(row => ({ identifier: row.identifier, expectedVersion: row.version }));
  await result(await f.any(f.bobCookie, "/issues/bulk/duplicate", "POST", { issues: restore, canonicalIdentifier: null }));
  for (const original of [a, b]) {
    const issue = await read(original.identifier);
    expect(issue.canonical).toBeNull();
    expect(issue.status.id).toBe(original.status.id);
  }
  expect((await read(incoming.identifier)).canonical.identifier).toBe(canonical.identifier);
});
