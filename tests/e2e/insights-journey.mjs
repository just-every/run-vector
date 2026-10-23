import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { beforePrivateNavigation } from "./collaboration-navigation.mjs";
import { writeRuntimeD1 } from "./runtime-d1.mjs";
const require = createRequire(import.meta.url);
const axe = await readFile(require.resolve("axe-core/axe.min.js"), "utf8");

export async function insightsJourney(page, context, runtime, output) {
  const base = runtime.base, errors = [];
  const consoleError = message => { if (/hydrat|did not match|Minified React error #(418|423|425)/i.test(message.text())) errors.push(message.text()); };
  const pageError = error => errors.push(error.message);
  page.on("console", consoleError); page.on("pageerror", pageError);
  async function api(path, method = "GET", data) {
    const response = await context.request.fetch(base + "/api" + path, { method, headers: { Origin: base }, ...(data === undefined ? {} : { data }) });
    assert(response.ok(), `${method} ${path}: ${response.status()} ${await response.text()}`);
    return response.json();
  }
  await api("/settings", "PATCH", { timezone: "UTC" });
  const state = await api("/settings/teams", "POST", { name: "synthetic-vector-1", identifierPrefix: "SYNINS" });
  const team = state.teams.find(t => t.identifierPrefix === "SYNINS");
  const status = category => team.statuses.find(s => s.category === category).id;
  const labelState = await api("/settings/labels", "POST", { name: "Bug", color: "#2255aa" });
  const bug = labelState.labels.find(l => l.name === "Bug").id;
  const issues = [];
  for (const [index, days] of [1, 3, 5, 9].entries()) {
    const issue = await api("/issues", "POST", { title: (index === 0 ? "=" : "") + "synthetic-vector-" + (index + 2), teamId: team.id, statusId: status("started"), estimate: index + 1, labelIds: [bug] });
    const created = "2026-09-07T12:00:00.000Z";
    await writeRuntimeD1(base, [
      { sql: "UPDATE issues SET created_at=?,updated_at=? WHERE id=?", params: [created, created, issue.id] },
      { sql: "UPDATE issue_activity SET created_at=?,updated_at=? WHERE issue_id=? AND kind='issue.created'", params: [created, created, issue.id] },
    ]);
    const completed = new Date(Date.parse(created) + days * 86400000).toISOString();
    await api("/issues/" + issue.identifier, "PATCH", { expectedVersion: issue.version, statusId: status("completed") });
    await writeRuntimeD1(base, [
      { sql: "UPDATE issues SET completed_at=?,updated_at=? WHERE id=?", params: [completed, completed, issue.id] },
      { sql: "UPDATE issue_activity SET created_at=?,updated_at=? WHERE issue_id=? AND kind='issue.updated'", params: [completed, completed, issue.id] },
    ]);
    issues.push(issue);
  }
  await api("/issues", "POST", { title: "synthetic-vector-6", teamId: team.id, statusId: status("started"), labelIds: [bug] });
  const query = new URLSearchParams({ team: team.id, metric: "cycle-time" });
  const series = await api("/insights?" + query);
  assert.deepEqual(series.rows.map(r => [r.week, r.count, r.median, r.p75, r.p90]), [
    ["2026-09-07", 3, 3, 5, 5], ["2026-09-14", 1, 9, 9, 9],
  ]);
  assert.deepEqual((await api("/insights?" + new URLSearchParams({ team: team.id, metric: "throughput" }))).rows.map(r => r.count), [3, 1]);
  async function select(label, value) {
    await Promise.all([page.waitForResponse(r => new URL(r.url()).pathname === "/api/insights" && r.status() === 200), page.getByLabel(label, { exact: true }).selectOption(value)]);
    await page.locator('[data-insights-ready="true"]').waitFor();
  }
  for (const theme of ["light", "dark"]) for (const width of [1440, 390]) {
    await api("/settings/appearance", "PATCH", { theme });
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    await beforePrivateNavigation(page, base + "/app/insights");
    const document = await page.goto(base + "/app/insights");
    assert.equal(document.status(), 200);
    await page.locator('[data-insights-ready="true"]').waitFor();
    assert.equal(await page.locator("html").getAttribute("data-theme"), theme);
    await page.getByText("Filter issues", { exact: true }).click();
    await page.screenshot({ path: `${output}/insights-controls-${theme}-${width}.png` });
    await select("Team", team.id);
    for (const metric of ["cycle-time", "throughput", "lead-time", "status-time", "bug-inflow", "bug-age", "flow"]) {
      await select("Chart", metric);
      if (metric === "cycle-time") {
        const table = page.getByRole("region", { name: "Chart data", exact: true });
        const row = table.getByRole("row").filter({ hasText: "2026-09-07" });
        const values = await row.getByRole("cell").allTextContents();
        assert.deepEqual(values.slice(2, 7), ["3", "9", "3", "5", "5"]);
        const loaded = page.waitForResponse(r => new URL(r.url()).pathname === "/api/insights" && new URL(r.url()).searchParams.get("bucket"));
        await row.getByRole("button").click(); await loaded;
        const counted = page.getByRole("region", { name: "Counted issues", exact: true });
        await counted.getByRole("heading", { name: "Counted issues (3)", exact: true }).waitFor();
        assert.deepEqual((await counted.locator("li a").allTextContents()).map(text => text.split(" · ")[0]).sort(), issues.slice(0, 3).map(i => i.identifier).sort());
        const csvResponse = await context.request.get(base + await counted.getByText("Export counted issues CSV").getAttribute("href"));
        assert.equal(csvResponse.status(), 200);
        assert.match(await csvResponse.text(), /'=synthetic-vector-2/);
        await page.screenshot({ path: `${output}/insights-drill-${theme}-${width}.png` });
        await counted.getByRole("button", { name: "Close counted issues" }).click();
        await page.getByRole("region", { name: "Counted issues", exact: true }).waitFor({ state: "detached" });
      }
      await page.evaluate(source => {
        if (window.axe) return;
        const script = document.createElement("script");
        const nonce = document.querySelector("script[nonce]")?.nonce;
        if (nonce) script.nonce = nonce;
        script.textContent = source; document.head.append(script);
      }, axe);
      const violations = await page.evaluate(async () => (await window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] } })).violations.filter(v => ["serious", "critical"].includes(v.impact)).map(v => ({ id: v.id, targets: v.nodes.map(n => n.target) })));
      assert.deepEqual(violations, [], `${metric} ${theme} ${width} accessibility`);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, "no horizontal page overflow");
      await page.getByRole("region", { name: "Insight chart", exact: true }).scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${output}/insights-${metric}-${theme}-${width}.png` });
      console.log(`REPORT-001 ${metric} ${theme} ${width}: public read, chart, table, axe and overflow PASS`);
    }
  }
  await api("/settings/operators/invite", "POST", { email: "synthetic-vector-7@example.test", displayName: "synthetic-vector-7", role: "guest", teamIds: [team.id] });
  const mail = runtime.sql("SELECT json_extract(message,'$.text') text FROM rer_mail_development_outbox WHERE json_extract(message,'$.to[0]')='synthetic-vector-7@example.test' ORDER BY created_at DESC,sequence DESC LIMIT 1")[0].text;
  const token = new URL(mail.match(/https?:\/\/[^\s]+/)[0]).searchParams.get("token");
  const guest = await context.browser().newContext();
  try {
    const confirmation = await guest.request.post(base + "/auth/confirm", { headers: { Origin: base }, data: { token }, maxRedirects: 0 });
    assert.equal(confirmation.status(), 303);
    for (const path of ["/app/insights", "/api/insights", "/api/insights.csv", "/app/calendar", "/api/calendar/feeds"])
      assert.equal((await guest.request.get(base + path)).status(), 403, "Guest refused " + path);
  } finally { await guest.close(); }
  console.log("REPORT-001 Guest document, data and CSV doors: 403 PASS");
  assert.deepEqual(errors, [], "no hydration mismatch or page errors");
  page.off("console", consoleError); page.off("pageerror", pageError);
  await api("/settings/appearance", "PATCH", { theme: "system" });
}
