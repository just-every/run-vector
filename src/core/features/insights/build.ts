import { workspaceDate } from "../issues/browse-access";
import type { Fact, InsightIssue, InsightQuery, InsightReport, InsightRow } from "./schema";
const day = 86_400_000;
const terminal = new Set(["completed", "canceled", "duplicate"]);
/** Monday buckets use the workspace's civil date, including across DST. */
export function weekOf(at: string, timezone: string) {
  const date = new Date(workspaceDate(new Date(at), timezone) + "T12:00:00Z");
  date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7);
  return date.toISOString().slice(0, 10);
}
function percentile(values: number[], percent: number) {
  if (!values.length) return null;
  const ordered = [...values].sort((a, b) => a - b);
  return ordered[Math.ceil(percent * ordered.length) - 1];
}
function groups(f: Fact, group: InsightQuery["group"]): [string, string][] {
  switch (group) {
    case "team": return [[f.teamId, f.teamName]];
    case "project": return [[f.projectId ?? "none", f.projectName ?? "No project"]];
    case "assignee": return [[f.assigneeId ?? "none", f.assigneeName ?? "Unassigned"]];
    case "priority": return [[f.priority, f.priority]];
    case "label": return f.labels.length ? f.labels.map(l => [l.id, l.name]) : [["none", "No label"]];
    default: return [["all", "All issues"]];
  }
}
export function buildInsights(facts: Fact[], query: InsightQuery, timezone: string, now = new Date()): InsightReport {
  const buckets = new Map<string, { row: InsightRow; values: number[]; issues: Map<string, InsightIssue> }>();
  const limitations = new Set<string>();
  const duration = ["cycle-time", "lead-time", "status-time", "bug-age"].includes(query.metric);
  const add = (f: Fact, at: string, series: string, value?: number) => {
    if (!Number.isFinite(Date.parse(at)) || Date.parse(at) > now.getTime()) return;
    const date = workspaceDate(new Date(at), timezone);
    if (query.from && date < query.from || query.to && date > query.to) return;
    const week = weekOf(at, timezone);
    for (const [id, name] of groups(f, query.group)) {
      const key = JSON.stringify([week, id, series]);
      let bucket = buckets.get(key);
      if (!bucket) {
        bucket = { row: { key, week, group: name, series, count: 0, value: 0, median: null, p75: null, p90: null }, values: [], issues: new Map() };
        buckets.set(key, bucket);
      }
      if (bucket.issues.has(f.identifier)) continue;
      bucket.issues.set(f.identifier, { identifier: f.identifier, title: f.title, estimate: f.estimate });
      bucket.row.count++;
      bucket.row.value += duration ? value! : query.unit === "estimate" ? f.estimate ?? 0 : 1;
      if (value !== undefined) bucket.values.push(value);
    }
  };
  for (const f of facts) {
    if (Date.parse(f.createdAt) > now.getTime()) continue;
    const transitions = [...f.transitions].filter(t => Date.parse(t.at) <= now.getTime())
      .sort((a, b) => Date.parse(a.at) - Date.parse(b.at) || a.id.localeCompare(b.id));
    // Only currently completed issues count as delivery. Reopening withdraws delivery
    // until the next completion; the original Started transition is retained.
    const completed = f.category === "completed" ? f.completedAt : null;
    const started = transitions.find(t => t.nextCategory === "started");
    const bug = f.labels.some(l => l.name.toLocaleLowerCase("en-US") === "bug");
    if (query.metric === "flow") { add(f, f.createdAt, "Created"); if (completed) add(f, completed, "Completed"); }
    if (query.metric === "throughput" && completed) add(f, completed, "Completed");
    if (query.metric === "lead-time" && completed) add(f, completed, "Lead time", Math.max(0, (Date.parse(completed) - Date.parse(f.createdAt)) / day));
    if (query.metric === "cycle-time" && completed) {
      if (started && Date.parse(started.at) <= Date.parse(completed)) add(f, completed, "Cycle time", (Date.parse(completed) - Date.parse(started.at)) / day);
      else limitations.add("Completed issues without a recorded Started transition are excluded from cycle time.");
    }
    if (query.metric === "bug-inflow" && bug) add(f, f.createdAt, "Bug inflow");
    if (query.metric === "bug-age" && bug && !terminal.has(f.category)) add(f, now.toISOString(), "Open bug age", (now.getTime() - Date.parse(f.createdAt)) / day);
    if (query.metric === "status-time") {
      const times = new Map<string, { name: string; value: number }>();
      for (let i = 0; i < transitions.length; i++) {
        const t = transitions[i], end = transitions[i + 1]?.at ?? now.toISOString();
        if (!t.nextName) { limitations.add("Removed historical statuses have no reliable name and are excluded from time in status."); continue; }
        const prior = times.get(t.nextId) ?? { name: t.nextName, value: 0 };
        prior.value += Math.max(0, (Date.parse(end) - Date.parse(t.at)) / day);
        times.set(t.nextId, prior);
      }
      if (!transitions.length || Date.parse(transitions[0].at) > Date.parse(f.createdAt))
        limitations.add("Time before the first recorded status is unknown and excluded.");
      for (const [id, time] of times) add(f, now.toISOString(), time.name + " · " + id, time.value);
    }
  }
  if (query.metric.startsWith("bug")) limitations.add('Bugs are issues currently carrying a label named "Bug" (case insensitive). Issue types are not stored.');
  if (query.unit === "estimate") limitations.add("Missing estimates contribute zero points and remain in the issue count. Duration percentiles are per issue, never weighted by estimate.");
  for (const bucket of buckets.values()) {
    bucket.row.median = percentile(bucket.values, .5);
    bucket.row.p75 = percentile(bucket.values, .75);
    bucket.row.p90 = percentile(bucket.values, .9);
  }
  const selected = buckets.get(query.bucket);
  return {
    timezone, through: now.toISOString(), total: facts.length,
    unestimated: facts.filter(f => f.estimate === null).length, duration,
    rows: [...buckets.values()].map(b => b.row).sort((a, b) => a.week.localeCompare(b.week) || a.group.localeCompare(b.group) || a.series.localeCompare(b.series)),
    limitations: [...limitations],
    drill: query.bucket ? { key: query.bucket, issues: selected ? [...selected.issues.values()].sort((a, b) => a.identifier.localeCompare(b.identifier)) : [] } : null,
  };
}
