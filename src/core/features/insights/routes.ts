import type { Hono } from "hono";
import type { AppEnvironment } from "../../app/bindings";
import { SettingsError } from "../settings/repository";
import { IssueAccessError } from "../issues/access";
import { parseInsightQuery, type InsightReport } from "./schema";
import { readInsights } from "./read";
// Same neutralization as the Jira import report, including tab and carriage return.
const cell = (value: unknown) => {
  const raw = value == null ? "" : String(value), text = /^[=+@\-\t\r]/.test(raw) ? "'" + raw : raw;
  return /[",\r\n]/.test(text) ? '"' + text.replaceAll('"', '""') + '"' : text;
};
export function insightCsv(report: InsightReport) {
  const rows = report.drill
    ? [["identifier", "title", "estimate"], ...report.drill.issues.map(i => [i.identifier, i.title, i.estimate])]
    : [["week", "group", "series", "issue_count", "value", "median_days", "p75_days", "p90_days"],
      ...report.rows.map(r => [r.week, r.group, r.series, r.count, r.value, r.median, r.p75, r.p90])];
  return rows.map(r => r.map(cell).join(",")).join("\r\n") + "\r\n";
}
export function addInsightRoutes(app: Hono<AppEnvironment>) {
  for (const path of ["/insights", "/insights.csv"] as const) app.get(path, async c => {
    let query;
    try { query = parseInsightQuery(c.req.query()); }
    catch { return c.json({ error: "invalid_request", message: "Choose valid filters and an ordered date range." }, 400); }
    try {
      const report = await readInsights(c.env.DB, c.get("operatorId"), query.filters, query.chart);
      if (path.endsWith(".csv")) return new Response(insightCsv(report), { headers: {
        "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="insights.csv"', "Cache-Control": "no-store",
      } });
      return c.json(report);
    } catch (error) {
      if (error instanceof SettingsError || error instanceof IssueAccessError) return c.json({ error: error.code, message: error.message }, error.status);
      throw error;
    }
  });
}
