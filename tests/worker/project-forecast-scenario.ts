import { expect, vi } from "vitest";
import { collaborationFixture } from "./collaboration-fixture";
import { request } from "./base-auth-fixture";
import { projectDetailSchema } from "../../src/core/features/projects/ui/data";

// This fixture has only zero or one completion per closed day. Its independent
// reference is a binomial tail, rather than the production convolution.
function reference(remaining: number, probability: number, capacityDays: number) {
  const dayFor = (quantile: number) => {
    for (let days = Math.max(1, capacityDays); days <= 28; days++) {
      let incomplete = 0;
      for (let count = 0; count < Math.min(remaining, days + 1); count++) {
        let choose = 1;
        for (let i = 1; i <= count; i++) choose *= (days - i + 1) / i;
        incomplete += choose * probability ** count * (1 - probability) ** (days - count);
      }
      if (1 - incomplete + 1e-12 >= quantile) return `2026-09-${String(days).padStart(2, "0")}`;
    }
    return null;
  };
  return { p50: dayFor(.5), p85: dayFor(.85) };
}

export async function projectForecastJourney() {
  const f = await collaborationFixture();
  vi.useFakeTimers({ toFake: ["Date"] });
  const at = (date: string) => vi.setSystemTime(new Date(date));
  at("2026-08-01T01:00:00Z");
  await f.mutate("/settings", "PATCH", { timezone: "Australia/Brisbane" });
  const team = f.initial.teams[0];
  const status = (category: string) => team.statuses.find(s => s.category === category)!.id;
  const project = (await f.mutate("/settings/projects", "POST", { name: "synthetic-vector-185", leadOperatorId: f.owner })).projects.find(p => p.name === "synthetic-vector-185")!;
  const create = (extra = {}) => f.create({ title: "synthetic-vector-186", projectId: project.id, statusId: status("started"), assigneeOperatorId: f.owner, estimate: 2, ...extra });
  const current = async (identifier: string) => {
    const response = await f.call("/issues/" + identifier);
    expect(response.status).toBe(200);
    return response.json() as Promise<{ version: number }>;
  };
  const patch = async (identifier: string, changes: Record<string, unknown>) => {
    const response = await f.call("/issues/" + identifier, "PATCH", { expectedVersion: (await current(identifier)).version, ...changes });
    expect(response.status, await response.clone().text()).toBe(200);
  };
  const history = [];
  for (let day = 4; day <= 30; day += 2) {
    at(`2026-08-${String(day).padStart(2, "0")}T01:00:00Z`);
    const issue = await create();
    await patch(issue.identifier, { statusId: status("completed") });
    history.push(issue);
  }
  at("2026-08-31T14:30:00Z"); // September 1 in the workspace, August 31 in UTC.
  const work = [await create(), await create(), await create()];
  const query = "?from=2026-09-01&to=2026-09-28";
  let capacityVersion = 0;
  const capacity = async (value: number | null) => {
    const response = await f.call("/workload" + query, "PUT", { capacity: value, expectedVersion: capacityVersion++ });
    expect(response.status, await response.clone().text()).toBe(200);
  };
  const detail = async (cookie = f.cookie) => {
    const response = await f.any(cookie, "/projects/" + project.id);
    expect(response.status, await response.clone().text()).toBe(200);
    return projectDetailSchema.parse(await response.json());
  };
  await capacity(28);
  let forecast = (await detail()).forecast;
  expect(forecast.history).toMatchObject({ from: "2026-08-04", to: "2026-08-31", completions: 14 });
  expect(forecast.history.dailyCompletions).toEqual(Array.from({ length: 28 }, (_, day) => day % 2 === 0 ? 1 : 0));
  expect(forecast.dates).toEqual({ p50: "2026-09-06", p85: "2026-09-08" });
  expect(forecast.dates).toEqual(reference(3, .5, 6));
  expect(forecast).toMatchObject({ status: "forecast", timezone: "Australia/Brisbane", scope: { projectIssues: 3, prerequisiteIssues: 0, estimatedPoints: 6, unestimated: 0, unknownCapacity: 0 } });
  expect(forecast.assumptions.length).toBeGreaterThan(0);
  expect((await detail()).forecast).toEqual(forecast); // Stateless, deterministic read.

  const added = await create();
  expect((await detail()).forecast.dates).toEqual(reference(4, .5, 8));
  await patch(added.identifier, { projectId: null });
  expect((await detail()).forecast.dates).toEqual(reference(3, .5, 6));
  await patch(history[0].identifier, { statusId: status("started") });
  forecast = (await detail()).forecast;
  expect(forecast.history.completions).toBe(13);
  expect(forecast.scope.projectIssues).toBe(4);
  expect(forecast.dates).toEqual(reference(4, 13 / 28, 8));
  await patch(history[0].identifier, { statusId: status("completed") });
  // Today's completion does not enter the closed-day distribution.
  expect((await detail()).forecast.dates).toEqual(reference(3, 13 / 28, 6));

  const prerequisite = await create({ projectId: null });
  const dependency = async (identifier: string, operation: string) => {
    const response = await f.call(`/issues/${identifier}/dependencies`, operation, {
      expectedVersion: (await current(identifier)).version, relatedIdentifier: prerequisite.identifier,
      relatedVersion: (await current(prerequisite.identifier)).version, direction: "blocked-by",
    });
    expect(response.status, await response.clone().text()).toBe(200);
  };
  await dependency(work[0].identifier, "POST");
  await dependency(work[1].identifier, "POST");
  forecast = (await detail()).forecast;
  expect(forecast.scope).toMatchObject({ projectIssues: 3, prerequisiteIssues: 1, estimatedPoints: 8 });
  expect(forecast.dates).toEqual(reference(4, 13 / 28, 8));
  await patch(prerequisite.identifier, { statusId: status("completed") });
  expect((await detail()).forecast.scope.prerequisiteIssues).toBe(0);

  await capacity(14);
  expect((await detail()).forecast.dates).toEqual(reference(3, 13 / 28, 12));
  await capacity(28);
  const competing = await create({ projectId: null, dueDate: "2026-09-14", estimate: 14 });
  forecast = (await detail()).forecast;
  expect(forecast.capacityWindow).toMatchObject({ competingPoints: 14, serialDays: 12 });
  expect(forecast.dates).toEqual(reference(3, 13 / 28, 12));
  await patch(competing.identifier, { estimate: null });
  expect((await detail()).forecast).toMatchObject({ status: "insufficient-evidence", dates: { p50: null, p85: null }, reasons: expect.arrayContaining(["unestimated-competing-work"]) });
  await patch(competing.identifier, { statusId: status("canceled") });
  for (const value of [0, null]) {
    await capacity(value);
    expect((await detail()).forecast).toMatchObject({ status: "insufficient-evidence", dates: { p50: null, p85: null }, scope: { unknownCapacity: 3 } });
  }
  expect((await f.call("/workload?from=2026-09-02&to=2026-09-29", "PUT", { capacity: 1000, expectedVersion: 0 })).status).toBe(200);
  expect((await detail()).forecast.scope.unknownCapacity).toBe(3); // Never borrow another period.
  await capacity(28);
  await patch(work[0].identifier, { estimate: null });
  expect((await detail()).forecast).toMatchObject({ status: "insufficient-evidence", dates: { p50: null, p85: null }, scope: { unestimated: 1 } });
  await patch(work[0].identifier, { estimate: 2, assigneeOperatorId: null });
  expect((await detail()).forecast.scope.unknownCapacity).toBe(1);
  await patch(work[0].identifier, { assigneeOperatorId: f.owner });
  await capacity(1);
  expect((await detail()).forecast).toMatchObject({ status: "insufficient-evidence", dates: { p50: null, p85: null }, reasons: expect.arrayContaining(["quantile-beyond-known-capacity-window"]) });
  await capacity(28);

  const publicTeam = (await f.mutate("/settings/teams", "POST", { name: "synthetic-vector-187", identifierPrefix: "SYNFOR" })).teams.find(t => t.name === "synthetic-vector-187")!;
  const publicWork = await create({ teamId: publicTeam.id, statusId: publicTeam.statuses.find(s => s.category === "started")!.id });
  const allowed = (await detail(f.bobCookie)).forecast;
  expect(allowed.dates).toEqual(reference(4, 13 / 28, 8));
  expect((await f.call(`/settings/teams/${team.id}/privacy`, "PUT", { isPrivate: true })).status).toBe(200);
  expect((await f.call(`/settings/teams/${team.id}/members/${f.bob}`, "PUT", { role: "member" })).status).toBe(200);
  expect((await detail(f.bobCookie)).forecast).toEqual((await detail()).forecast);
  expect((await f.call(`/settings/teams/${team.id}/members/${f.bob}`, "DELETE")).status).toBe(200);
  const withdrawn = (await detail(f.bobCookie)).forecast;
  expect(withdrawn).toMatchObject({ status: "insufficient-evidence", history: { completions: 0 }, scope: { projectIssues: 1, prerequisiteIssues: 0, estimatedPoints: 2 }, dates: { p50: null, p85: null } });
  expect(withdrawn.history.dailyCompletions).toEqual(Array(28).fill(0));
  expect(JSON.stringify(withdrawn)).not.toContain(work[0].identifier);
  expect((await request("/api/projects/" + project.id)).status).toBe(401);
  expect((await detail()).forecast.history.completions).toBe(13);
  expect((await f.call(`/settings/teams/${team.id}/privacy`, "PUT", { isPrivate: false })).status).toBe(200);

  const young = (await f.mutate("/settings/projects", "POST", { name: "synthetic-vector-188", leadOperatorId: f.owner })).projects.find(p => p.name === "synthetic-vector-188")!;
  await create({ projectId: young.id });
  const youngResponse = await f.call("/projects/" + young.id);
  expect(youngResponse.status).toBe(200);
  expect(projectDetailSchema.parse(await youngResponse.json()).forecast).toMatchObject({ status: "insufficient-evidence", dates: { p50: null, p85: null }, reasons: expect.arrayContaining(["less-than-28-closed-days", "fewer-than-three-visible-completions"]) });
  await f.mutate("/settings/projects/" + project.id, "PATCH", { archived: true });
  expect((await detail()).forecast).toMatchObject({ status: "inactive", dates: { p50: null, p85: null } });
  await f.mutate("/settings/projects/" + project.id, "PATCH", { archived: false });
  for (const issue of work) await patch(issue.identifier, { statusId: status("completed") });
  await patch(publicWork.identifier, { statusId: publicTeam.statuses.find(s => s.category === "completed")!.id });
  expect((await detail()).forecast).toMatchObject({ status: "nothing-remaining", dates: { p50: null, p85: null }, scope: { projectIssues: 0 } });
}
