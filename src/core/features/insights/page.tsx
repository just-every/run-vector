import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useApiResource } from "../../app/api-client";
import { workspaceOptionsSchema } from "../../shared/workspace-options";
import { issueListQuerySchema, type IssueListQuery } from "../issues/list-schema";
import { changeIssueListFilters } from "../issues/ui/issue-list-controls";
import { insightQuerySchema, insightReportSchema, metrics, metricNames, type InsightQuery, type InsightReport } from "./schema";
import "./insights.css";
import "../settings/ui/settings.css";

const number = (n: number | null) => n === null ? "—" : new Intl.NumberFormat("en", { maximumFractionDigits: 2 }).format(n);
export function InsightsPage() {
  const [filters, setFilters] = useState(() => issueListQuerySchema.parse({}));
  const [chart, setChart] = useState(() => insightQuerySchema.parse({}));
  const [bucket, setBucket] = useState("");
  const [parent, setParent] = useState("");
  const [filterError, setFilterError] = useState("");
  const options = useApiResource("/api/options", workspaceOptionsSchema);
  const search = new URLSearchParams(Object.entries({ ...filters, ...chart, bucket }).map(([key, value]) => [key, String(value)])).toString();
  const report = useApiResource("/api/insights?" + search, insightReportSchema);
  const change = (values: Partial<IssueListQuery>) => { try { const next = changeIssueListFilters(filters, values); setFilterError(""); setBucket(""); setFilters(next); } catch { setFilterError("Choose valid filters and dates in order."); } };
  const configure = (values: Partial<InsightQuery>) => { setBucket(""); setChart(q => ({ ...q, ...values })); };
  function choice(key: keyof IssueListQuery, label: string, values: { id: string; name: string }[], none?: string) {
    return <label>{label}<select value={String(filters[key])} onChange={e => change({ [key]: e.target.value })}>
      <option value="all">All</option>{none && <option value={key === "assignee" ? "unassigned" : "none"}>{none}</option>}
      {values.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
    </select></label>;
  }
  const names = (values: string[]) => values.map(id => ({ id, name: id.charAt(0).toUpperCase() + id.slice(1) }));
  return <main className="settings-page insights-page" aria-labelledby="insights-title" data-insights-ready={report.data && !report.loading && !report.error ? "true" : "false"}>
    <header><p className="insights-eyebrow">Workspace reports</p><h1 id="insights-title">Insights</h1>
      <p>Understand delivery over time. Every result uses the issues you can read.</p></header>
    <section aria-label="Chart controls" className="insights-card">
      <div className="insights-controls">
        <label>Chart<select value={chart.metric} onChange={e => configure({ metric: e.target.value as InsightQuery["metric"] })}>
          {metrics.map(m => <option key={m} value={m}>{metricNames[m]}</option>)}</select></label>
        <label>Group by<select value={chart.group} onChange={e => configure({ group: e.target.value as InsightQuery["group"] })}>
          {names(["none", "team", "project", "label", "assignee", "priority"]).map(v => <option key={v.id} value={v.id}>{v.name}</option>)}</select></label>
        <label>Measure<select value={chart.unit} onChange={e => configure({ unit: e.target.value as InsightQuery["unit"] })}>
          <option value="count">Issue count</option><option value="estimate">Estimate points</option></select></label>
        <label>From<input type="date" value={chart.from} onChange={e => configure({ from: e.target.value })} /></label>
        <label>Through<input type="date" value={chart.to} onChange={e => configure({ to: e.target.value })} /></label>
      </div>
      <details><summary>Filter issues</summary><div className="insights-controls">
        <label>Title or identifier<input type="search" value={filters.q} maxLength={200} onChange={e => change({ q: e.target.value })} /></label>
        {choice("team", "Team", options.data?.teams ?? [])}
        {choice("project", "Project", options.data?.projects ?? [], "No project")}
        {choice("label", "Label", options.data?.labels ?? [], "No labels")}
        {choice("assignee", "Assignee", options.data?.operators ?? [], "Unassigned")}
        {choice("priority", "Priority", names(["urgent", "high", "medium", "low", "none"]))}
        {choice("category", "Status category", names(["intake", "backlog", "unstarted", "started", "completed", "canceled", "duplicate"]))}
        {choice("status", "Status", (options.data?.statuses ?? []).filter(s => filters.team === "all" || s.teamId === filters.team))}
        {choice("cycle", "Cycle", (options.data?.cycles ?? []).filter(c => filters.team === "all" || c.teamId === filters.team), "No cycle")}
        {choice("blocked", "Blocked state", names(["blocked", "unblocked"]))}
        {choice("due", "Due date", names(["overdue", "range", "none"]))}
        {filters.due === "range" && <><label>Due from<input type="date" value={filters.dueFrom} onChange={e => change({ dueFrom: e.target.value })} /></label>
          <label>Due through<input type="date" value={filters.dueTo} onChange={e => change({ dueTo: e.target.value })} /></label></>}
        <label>Scope<select value={filters.scope} onChange={e => change({ scope: e.target.value as IssueListQuery["scope"] })}>
          <option value="all">All visible issues</option><option value="created">Created by me</option><option value="subscribed">Followed by me</option></select></label>
        <label>Parent<input value={parent} placeholder="All, none or identifier" onChange={e => setParent(e.target.value)} /><button type="button" onClick={() => change({ parent: parent || "all" })}>Apply parent</button></label>
        <label>Completed issues<select value={chart.includeCompleted} onChange={e => configure({ includeCompleted: e.target.value as "true" | "false" })}>
          <option value="true">Include when category is All</option><option value="false">Use issue list default</option></select></label>
      </div><button type="button" onClick={() => { setFilters(issueListQuerySchema.parse({})); setBucket(""); }}>Reset filters</button></details>
      {filterError && <p role="alert">{filterError}</p>}
      {options.error && <p role="alert">{options.error.message} <button onClick={options.reload}>Retry filter choices</button></p>}
    </section>
    {report.error && <p role="alert">{report.error.message} <button onClick={report.reload}>Retry report</button></p>}
    {!report.data && !report.error && <p role="status">Loading Insights…</p>}
    {report.data && !report.error && <>
      <section className="insights-card" aria-label="Insight chart">
        <header className="insights-heading"><div><h2>{metricNames[chart.metric]}</h2><p>{report.data.total} filtered issues · {report.data.timezone} · weeks start Monday</p></div>
          <a className="insights-export" href={"/api/insights.csv?" + search} download>Export CSV</a></header>
        <p>{report.data.duration ? "Bars show median days per issue. The table includes total days and the 75th and 90th percentiles." : chart.unit === "estimate" ? "Bars show current estimate points; unestimated issues contribute zero." : "Bars show issue counts."}</p>
        <InsightChart report={report.data} select={setBucket} />
        <div className="insights-table" role="region" aria-label="Chart data" tabIndex={0}>
          <table><caption>{metricNames[chart.metric]} · text equivalent</caption><thead><tr><th>Week</th><th>Group</th><th>Series</th><th>Issues</th><th>{report.data.duration ? "Total days" : chart.unit === "estimate" ? "Points" : "Count"}</th>
            {report.data.duration && <><th>Median days</th><th>75th percentile</th><th>90th percentile</th></>}<th>Drill down</th></tr></thead>
          <tbody>{report.data.rows.map(row => <tr key={row.key}><th scope="row">{row.week}</th><td>{row.group}</td><td>{row.series.split(" · ")[0]}</td><td>{row.count}</td><td>{number(row.value)}</td>
            {report.data?.duration && <><td>{number(row.median)}</td><td>{number(row.p75)}</td><td>{number(row.p90)}</td></>}
            <td><button onClick={() => setBucket(row.key)} aria-label={`View ${row.count} issues for ${row.week} ${row.group} ${row.series}`}>View issues</button></td></tr>)}</tbody></table>
        </div>
        {!report.data.rows.length && <p>No issues match this chart and date range.</p>}
        {report.data.limitations.map(text => <p key={text} className="insights-note">{text}</p>)}
        <p className="insights-note">Percentiles use nearest rank. Delivery counts currently completed work at its latest completion; cycle time starts at the first recorded Started transition. Grouping uses current fields. Triage time, SLA breaches and customer tier await their source features.</p>
      </section>
      {report.data.drill && <section className="insights-card" aria-label="Counted issues">
        <h2>Counted issues ({report.data.drill.issues.length})</h2><p>This list uses this chart’s filters, week, group and series.</p>
        <a href={"/api/insights.csv?" + search} download>Export counted issues CSV</a>
        <ul>{report.data.drill.issues.map(issue => <li key={issue.identifier}><Link to="/app/issues/$identifier" params={{ identifier: issue.identifier }}>{issue.identifier} · {issue.title}</Link></li>)}</ul>
        <button onClick={() => setBucket("")}>Close counted issues</button>
      </section>}
    </>}
  </main>;
}
function InsightChart({ report, select }: { report: InsightReport; select: (key: string) => void }) {
  const max = Math.max(1, ...report.rows.map(r => report.duration ? r.median ?? 0 : r.value));
  return <div className="insights-bars" aria-label="Weekly chart">
    {report.rows.map(row => {
      const value = report.duration ? row.median ?? 0 : row.value;
      return <button key={row.key} className="insights-bar" onClick={() => select(row.key)}
        aria-label={`${row.week}, ${row.group}, ${row.series.split(" · ")[0]}: ${number(value)}${report.duration ? " days" : ""}. View ${row.count} issues.`}>
        <span>{row.week} · {row.group} · {row.series.split(" · ")[0]}</span>
        <svg viewBox="0 0 400 24" aria-hidden="true" focusable="false">
          <rect x="1" y="4" width={Math.max(1, 395 * value / max)} height="16" className={row.series === "Completed" ? "insights-mark-outline" : "insights-mark"} />
        </svg><strong>{number(value)}</strong>
      </button>;
    })}
  </div>;
}
