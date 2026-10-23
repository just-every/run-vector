import { env } from "cloudflare:workers";
import { afterEach, expect, it, vi } from "vitest";
import { closureFixture } from "./cycle-closure-fixture";
import { invite, actor, request } from "./base-auth-fixture";
import { insightReportSchema } from "../../src/core/features/insights/schema";
import { bindings } from "./base-auth-fixture";
import { scheduled } from "../../src/core/app/scheduled";

afterEach(() => vi.useRealTimers());

it("[REPORT-001 REPORT-002 CYCLE-005] Insights and daily burn-up follows completion, reopening, removal and re-addition, then freezes outcomes and assignees at closure", async () => {
  const f = await closureFixture();
  vi.useFakeTimers({ toFake: ["Date"] });
  const at = async (day: string, capture = true) => {
    vi.setSystemTime(new Date(day + "T00:01:00Z"));
    if (capture) await scheduled({ scheduledTime: Date.now() },bindings);
    vi.setSystemTime(new Date(day + "T12:00:00Z"));
  };
  const status = (category: string) => f.team.statuses.find(s => s.category === category)!.id;
  const patch = async (identifier: string, changes: Record<string, unknown>) => {
    const current = await (await f.call("/issues/" + identifier)).json() as { version: number };
    const response = await f.call("/issues/" + identifier, "PATCH", { expectedVersion: current.version, ...changes });
    expect(response.status, await response.clone().text()).toBe(200);
  };
  await at("2026-08-31");
  const first = await f.create({ title: "Restore settlement receipts", cycleId: f.closing.id, statusId: status("started"), estimate: 3, assigneeOperatorId: f.owner });
  const removed = await f.create({ title: "Review duplicate charges", cycleId: f.closing.id, statusId: status("started"), estimate: 5 });
  const erased = await f.create({ title: "Retire obsolete receipts", cycleId: f.closing.id, statusId: status("started") });
  await at("2026-09-01");
  await patch(first.identifier, { statusId: status("completed") });
  await at("2026-09-02");
  const added = await f.create({ title: "Reconcile delayed provider callbacks", cycleId: f.closing.id, statusId: status("started"), assigneeOperatorId: f.owner });
  await patch(removed.identifier, { cycleId: null });
  await at("2026-09-03");
  await patch(added.identifier, { cycleId: null });
  await patch(removed.identifier, { cycleId: f.closing.id });
  await patch(first.identifier, { statusId: status("started") });
  await at("2026-09-04");
  await patch(added.identifier, { cycleId: f.closing.id });
  await patch(first.identifier, { statusId: status("completed") });
  await patch(removed.identifier, { statusId: status("canceled") });
  await at("2026-09-05");
  await patch(added.identifier, { statusId: status("completed") });
  await at("2026-09-06");
  await patch(added.identifier, { statusId: status("started") });
  await at("2026-09-07",false);
  const erasedCurrent = await (await f.call("/issues/"+erased.identifier)).json() as {version:number};
  expect((await f.call("/issues/"+erased.identifier,"DELETE",{expectedVersion:erasedCurrent.version,confirmed:true})).status).toBe(200);
  await scheduled({scheduledTime:Date.now()},bindings);
  const beforeClose = (await f.detail()).report;
  expect(beforeClose.days.find(day=>day.date==="2026-09-06")).toMatchObject({scope:3,completed:1});
  expect((await env.DB.prepare("SELECT count(*) AS n FROM issue_activity WHERE issue_id=?").bind(erased.id).first())?.n).toBe(0);
  await patch(added.identifier, { cycleId: null });
  vi.setSystemTime(new Date("2026-09-07T13:00:00Z"));
  await patch(added.identifier, { cycleId: f.closing.id });
  const live = (await f.detail()).report;
  expect(live.source).toBe("live");
  expect(live.days.map(d => [d.date, d.scope, d.completed])).toEqual([
    ["2026-09-01", 3, 1], ["2026-09-02", 3, 1], ["2026-09-03", 3, 0],
    ["2026-09-04", 3, 1], ["2026-09-05", 3, 2], ["2026-09-06", 3, 1], ["2026-09-07", 2, 1],
  ]);
  expect(live.days[1]).toMatchObject({ added: [added.identifier], removed: [removed.identifier] });
  expect(live.days[6]).toMatchObject({ added: [added.identifier], removed: [added.identifier,erased.identifier].sort() });
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
  // Four synthetic delivery durations: 1, 3, 5, 9 days. Nearest rank yields
  // median 3, p75 5 and p90 9. Completion weeks contain 3 and 1 issues.
  const insightIssues: {identifier:string}[] = [];
  for (const [index, days] of [1,3,5,9].entries()) {
    await at("2026-10-05", false);
    const issue = await f.create({ title: (index === 0 ? "=" : "") + "synthetic-vector-" + (index + 1), statusId: status("started"), estimate: index + 1 });
    await at("2026-10-" + String(5 + days).padStart(2,"0"), false);
    await patch(issue.identifier, { statusId: status("completed") });
    insightIssues.push(issue);
  }
  await at("2026-10-20", false);
  const params = new URLSearchParams({ q:"synthetic-vector-",team:f.team.id,metric:"cycle-time" });
  const read = async (extra: Record<string,string> = {}) => {
    const response = await f.call("/insights?" + new URLSearchParams({...Object.fromEntries(params),...extra}));
    expect(response.status, await response.clone().text()).toBe(200);
    return insightReportSchema.parse(await response.json());
  };
  const cycle = await read();
  expect(cycle.rows.map(r=>[r.week,r.count,r.median,r.p75,r.p90])).toEqual([
    ["2026-10-05",3,3,5,5],["2026-10-12",1,9,9,9],
  ]);
  const throughput = await read({metric:"throughput",unit:"estimate"});
  expect(throughput.rows.map(r=>[r.week,r.count,r.value])).toEqual([["2026-10-05",3,6],["2026-10-12",1,4]]);
  const drill = await read({bucket:cycle.rows[0].key});
  expect(drill.drill?.issues.map(i=>i.identifier).sort()).toEqual(insightIssues.slice(0,3).map(i=>i.identifier).sort());
  const csv = await f.call("/insights.csv?" + params + "&bucket=" + encodeURIComponent(cycle.rows[0].key));
  expect(csv.status).toBe(200);
  expect(await csv.text()).toContain("'=synthetic-vector-1");
  const memberCookie = await invite("synthetic-vector-5@example.test",f.cookie);
  const memberId = await actor(memberCookie);
  expect((await request("/api/insights?" + params,"GET",undefined,memberCookie)).status).toBe(200);
  expect((await f.call("/settings/operators/" + memberId + "/role","PATCH",{role:"guest",teamIds:[f.team.id]})).status).toBe(200);
  for (const path of ["/api/insights?","/api/insights.csv?"]) expect((await request(path + params,"GET",undefined,memberCookie)).status).toBe(403);

});
