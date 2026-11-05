import { workspaceDate } from "../issues/browse-access";
import { deliveredAt } from "../insights/build";
import { categoryByStatus, isTerminalCategory } from "../projects/facts";
import type { WorkspaceSnapshot } from "../streams";
import { readWorkloadCapacities } from "../workload/service";
import { addDays, forecastDays } from "./calculate";
import { projectForecastSchema, type ProjectForecast } from "./schema";

/** Called with the project's current visibility database and its scoped graph.
 * No aggregate history, stored forecast, private edge or person ranking is used.
 */
export async function readProjectForecast(db: D1Database, snapshot: WorkspaceSnapshot, projectId: string, now: Date): Promise<ProjectForecast> {
  const project = snapshot.projects.find(p => p.id === projectId)!;
  const timezone = snapshot.workspace!.timezone, today = workspaceDate(now, timezone);
  const from = addDays(today, -28), to = addDays(today, -1), capacityTo = addDays(today, 27);
  const categories = categoryByStatus(snapshot);
  const issues = snapshot.issues.filter(i => snapshot.teams.some(t => t.id === i.teamId && t.workspaceId === project.workspaceId));
  const byId = new Map(issues.map(i => [i.id, i]));
  const open = (id: string) => byId.has(id) && !isTerminalCategory(categories.get(byId.get(id)!.statusId));
  const projectIssues = issues.filter(i => i.projectId === projectId && open(i.id));
  const required = new Set(projectIssues.map(i => i.id));
  const prerequisites = new Map<string, string[]>();
  for (const edge of snapshot.dependencies) {
    if (!open(edge.blockedIssueId) || !open(edge.blockingIssueId)) continue;
    prerequisites.set(edge.blockedIssueId, [...(prerequisites.get(edge.blockedIssueId) ?? []), edge.blockingIssueId]);
  }
  // Traverse once, including transitive external prerequisites exactly once.
  for (const id of required) for (const prerequisite of prerequisites.get(id) ?? []) required.add(prerequisite);
  const work = [...required].map(id => byId.get(id)!);
  const capacities = await readWorkloadCapacities(db, project.workspaceId, `dates:${today}:${capacityTo}`);
  const capacityByPerson = new Map(capacities.map(c => [c.operator_id, c.capacity]));
  const people = new Set(work.map(i => i.assigneeOperatorId));
  const competing = issues.filter(i => !required.has(i.id) && people.has(i.assigneeOperatorId)
    && i.dueDate && i.dueDate >= today && i.dueDate <= capacityTo
    && !["canceled", "duplicate"].includes(categories.get(i.statusId) ?? ""));
  const unestimatedCompeting = competing.filter(i => i.estimate === null).length;
  for (const issue of competing) if (issue.assigneeOperatorId) {
    const capacity = capacityByPerson.get(issue.assigneeOperatorId);
    if (capacity != null) capacityByPerson.set(issue.assigneeOperatorId, capacity - (issue.estimate ?? 0));
  }
  let unknownCapacity = 0, serialDays = 0;
  for (const issue of work) {
    const person = snapshot.operators.find(p => p.id === issue.assigneeOperatorId && p.removedAt === null);
    const capacity = person ? capacityByPerson.get(person.id) : null;
    if (capacity == null || capacity <= 0) unknownCapacity++;
    else serialDays += (issue.estimate ?? 0) * 28 / capacity;
  }
  const daily = Array.from({ length: 28 }, () => 0);
  for (const issue of issues) {
    if (issue.projectId !== projectId) continue;
    const completed = deliveredAt({ category: categories.get(issue.statusId) ?? "", completedAt: issue.completedAt });
    if (!completed || completed > now.toISOString()) continue;
    const date = workspaceDate(new Date(completed), timezone);
    if (date >= from && date <= to) daily[Math.round((Date.parse(date) - Date.parse(from)) / 86400000)]++;
  }
  const completions = daily.reduce((sum, n) => sum + n, 0);
  const unestimated = work.filter(i => i.estimate === null).length;
  const reasons: string[] = [];
  if (workspaceDate(new Date(project.createdAt), timezone) > from) reasons.push("less-than-28-closed-days");
  if (completions < 3) reasons.push("fewer-than-three-visible-completions");
  if (unestimated) reasons.push("unestimated-work");
  if (unknownCapacity) reasons.push("unknown-or-zero-capacity");
  if (unestimatedCompeting) reasons.push("unestimated-competing-work");
  let status: ProjectForecast["status"] = "insufficient-evidence";
  let dates: ProjectForecast["dates"] = { p50: null, p85: null };
  if (project.archivedAt || ["completed", "canceled"].includes(project.lifecycle)) status = "inactive";
  else if (!work.length) status = "nothing-remaining";
  else if (!reasons.length) {
    const days = forecastDays(daily, work.length, Math.ceil(serialDays), 28);
    // Day one ends on today's workspace date. The interval is inclusive.
    dates = { p50: days.p50 === null ? null : addDays(today, days.p50 - 1), p85: days.p85 === null ? null : addDays(today, days.p85 - 1) };
    if (dates.p50 && dates.p85) status = "forecast";
    else reasons.push("quantile-beyond-known-capacity-window");
  }
  return projectForecastSchema.parse({
    method: "daily-throughput-bootstrap-v1", through: now.toISOString(), timezone, status, dates,
    history: { from, to, dailyCompletions: daily, completions },
    capacityWindow: { from: today, to: capacityTo, serialDays: unknownCapacity || unestimated || unestimatedCompeting ? null : Math.ceil(serialDays),
      competingPoints: competing.reduce((sum, i) => sum + (i.estimate ?? 0), 0), unestimatedCompeting },
    scope: { projectIssues: projectIssues.length, prerequisiteIssues: work.length - projectIssues.length,
      estimatedPoints: work.reduce((sum, i) => sum + (i.estimate ?? 0), 0), unestimated, unknownCapacity },
    reasons,
    assumptions: [
      "Only currently visible project work and its visible, unresolved transitive prerequisites are included; hidden work is not inferred.",
      "Each of the last 28 closed workspace days is equally likely on each future day, independently. Zero days are retained. Currently Completed issues use their latest completion, as in Insights; reopening withdraws delivery. Today is excluded.",
      "Exact convolution gives the first calendar day with at least 50% or 85% modeled completion probability. These are conditional model quantiles, not calibrated guarantees.",
      "Known estimates and positive, active-assignee capacity for the exact upcoming 28-day Workload date range are required. Visible Workload commitments outside this scope consume capacity; unestimated commitments withhold dates. Work outside that date range and future scope changes are not assumed.",
      "Remaining capacity is spread uniformly. All required work is conservatively serialized, including prerequisites before dependents; shared prerequisites count once. No additional start-date or scheduling commitments are proposed.",
      "The result is the slower of modeled throughput and serial capacity time. No dates beyond that capacity interval, no individual ranking, no chosen plan, and no agent or provider production are claimed.",
    ],
  });
}
