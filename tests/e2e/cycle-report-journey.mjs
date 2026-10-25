import { withOperatorClient } from './operator-request.mjs';
import assert from "node:assert/strict";
import { beforePrivateNavigation } from "./collaboration-navigation.mjs";
import { writeRuntimeD1 } from "./runtime-d1.mjs";

/** Run inside an authenticated emitted-Worker runtime; the caller owns its browser/server.
 * Only test chronology is backdated. Every issue mutation and closure uses the public door. */
export async function cycleReportJourney(page, context, base, record = async () => {}) {
  async function api(path, method = "GET", data) {
    return withOperatorClient(context, async client => {
const response = await client.fetch(base + "/api" + path, {
      method, headers: { Origin: base }, ...(data === undefined ? {} : { data }),
    });
    assert(response.ok(), `${method} ${path}: ${response.status()}`);
    return await response.json();
});
  }
  const original = await api("/settings/administration");
  const { operatorId } = await api("/session");
  const suffix = String(Date.now());
  const prefix = "BR" + suffix.slice(-6).replaceAll(/\d/g, d => String.fromCharCode(65 + Number(d)));
  const administration = await api("/settings/teams", "POST", { name: "Payments reliability " + suffix, identifierPrefix: prefix });
  const team = administration.teams.find(t => t.identifierPrefix === prefix);
  const status = category => team.statuses.find(s => s.category === category).id;
  await api("/settings", "PATCH", { timezone: "UTC" });
  for (const [name, startsLocal, endsLocal] of [
    ["Checkout recovery", "2026-09-01T00:00", "2026-09-08T00:00"],
    ["Settlement follow-through", "2026-09-08T00:00", "2026-09-15T00:00"],
  ]) await api("/settings/cycles", "POST", { teamId: team.id, name, startsLocal, endsLocal, capacity: 15 });
  const cycle = (await api("/settings/administration")).cycles.find(c => c.teamId === team.id && c.name === "Checkout recovery");
  const fixtureAt = async (issue, at, created = false) => {
    await writeRuntimeD1(base, [
      { sql: `UPDATE issues SET updated_at=?${created ? ",created_at=?" : ""} WHERE id=?`, params: created ? [at, at, issue.id] : [at, issue.id] },
      { sql: "UPDATE issue_activity SET created_at=?,updated_at=? WHERE id=(SELECT id FROM issue_activity WHERE issue_id=? ORDER BY julianday(created_at) DESC,id DESC LIMIT 1)", params: [at, at, issue.id] },
      { sql: "UPDATE cycle_membership_events SET occurred_at=? WHERE identifier=? AND julianday(occurred_at)>julianday('2026-09-08T00:00:00Z')", params: [at, issue.identifier] },
    ]);
  };
  const create = async (title, assigneeOperatorId, at) => {
    const issue = await api("/issues", "POST", { title, teamId: team.id, cycleId: cycle.id, statusId: status("started"), assigneeOperatorId });
    await fixtureAt(issue, at, true);
    return issue;
  };
  const patch = async (issue, changes, at) => {
    const current = await api("/issues/" + issue.identifier);
    const updated = await api("/issues/" + issue.identifier, "PATCH", { expectedVersion: current.version, ...changes });
    await fixtureAt(issue, at);
    return updated;
  };
  const completed = await create("Recover interrupted checkout receipts", operatorId, "2026-08-31T12:00:00Z");
  const removed = await create("Audit duplicate settlement warnings", null, "2026-08-31T13:00:00Z");
  await patch(completed, { statusId: status("completed") }, "2026-09-01T12:00:00Z");
  const carried = await create("Reconcile delayed payment callbacks", operatorId, "2026-09-02T12:00:00Z");
  await patch(removed, { cycleId: null }, "2026-09-02T13:00:00Z");
  await patch(carried, { cycleId: null }, "2026-09-03T12:00:00Z");
  await patch(carried, { cycleId: cycle.id }, "2026-09-04T12:00:00Z");
  await patch(completed, { statusId: status("started") }, "2026-09-05T12:00:00Z");
  await patch(completed, { statusId: status("completed") }, "2026-09-06T12:00:00Z");
  for (let day = 2; day <= 7; day++) {
    const daily = await context.request.get(base + "/cdn-cgi/local/scheduled?cron=" + encodeURIComponent("* * * * *") + "&time=" + Date.parse(`2026-09-0${day}T00:01:00Z`));
    assert.equal(daily.status(), 200);
    await daily.body();
  }
  const live = await api("/cycles/" + cycle.id);
  assert.equal(live.report.source, "live");
  assert.deepEqual(live.report.days.map(d=>[d.scope,d.completed]), [[2,1],[2,1],[1,1],[2,1],[2,0],[2,1],[2,1]]);
  for(const width of [1440,390]) {
    await page.setViewportSize({width,height:width===390?844:1000});
    await beforePrivateNavigation(page,base+"/app/cycles/"+cycle.id);await page.goto(base+"/app/cycles/"+cycle.id);
    const panel=page.getByRole("region",{name:"Cycle report",exact:true});
    await panel.getByRole("heading",{name:"Current scope report",exact:true}).waitFor();
    await panel.getByText("Daily data and scope changes",{exact:true}).click();
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    await record("REPORT-002",`live-cycle-report-${width}`,page);
  }
  const tick = await context.request.get(base + "/cdn-cgi/local/scheduled?cron=" + encodeURIComponent("* * * * *"));
  assert.equal(tick.status(), 200);
  await tick.body();
  const frozen = await api("/cycles/" + cycle.id);
  assert(frozen.snapshot);
  assert.equal(frozen.report.source, "snapshot");
  assert.deepEqual(frozen.report.days.map(d => [d.scope, d.completed]), [[2, 1], [2, 1], [1, 1], [2, 1], [2, 0], [2, 1], [2, 1]]);
  assert.deepEqual(frozen.report.completed, frozen.snapshot.completed);
  assert.deepEqual(frozen.report.carried, [carried.identifier]);
  assert.deepEqual(frozen.report.addedMidcycle, [carried.identifier]);
  assert.deepEqual(frozen.report.days[1].removed, [removed.identifier]);
  assert.deepEqual(frozen.report.days[3].added, [carried.identifier]);
  assert.equal(frozen.report.byAssignee.find(a => a.id === operatorId).completed, 1);
  assert.equal(frozen.report.byAssignee.find(a => a.id === operatorId).carried, 1);
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    await beforePrivateNavigation(page, base + "/app/cycles/" + cycle.id);
    await page.goto(base + "/app/cycles/" + cycle.id);
    const panel = page.getByRole("region", { name: "Cycle report", exact: true });
    await panel.getByRole("heading", { name: "Final report", exact: true }).waitFor();
    await panel.getByRole("img", { name: "Cycle burn-up of issue scope and completion by day" }).waitFor();
    await panel.getByText("Daily data and scope changes", { exact: true }).click();
    const daily = panel.getByRole("region", { name: "Daily burn-up data", exact: true });
    const row = daily.getByRole("row").filter({ has: page.locator('time[datetime="2026-09-02"]') });
    assert.equal(await row.getByRole("cell").nth(0).innerText(), "2");
    assert.equal(await row.getByRole("cell").nth(1).innerText(), "1");
    assert((await row.innerText()).includes(carried.identifier));
    assert((await row.innerText()).includes(removed.identifier));
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await panel.scrollIntoViewIfNeeded();
    await record("REPORT-002", `frozen-cycle-report-${width}`, page);
  }
  await patch(carried, { assigneeOperatorId: null, estimate: 100 }, "2026-10-18T12:00:00Z");
  const current = await api("/issues/" + completed.identifier);
  const deletion = await context.request.delete(base + "/api/issues/" + completed.identifier, {
    headers: { Origin: base }, data: { expectedVersion: current.version, confirmed: true },
  });
  assert.equal(deletion.status(), 200);
  await deletion.body();
  await api("/settings", "PATCH", { timezone: original.workspace.timezone });
  assert.deepEqual((await api("/cycles/" + cycle.id)).report, frozen.report);
  return { cycleId: cycle.id, report: frozen.report };
}
