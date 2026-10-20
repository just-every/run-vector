import type { DailyReportCount, ProjectFinalCounts, ProjectReport, ProjectReportFacts } from "./schema";
import { excluded, shiftDay, workspaceDays } from "./chronology";
import { projectProjection } from "./projection";

export function buildProjectReport(facts: ProjectReportFacts, recorded: DailyReportCount[],
  final: ProjectFinalCounts | null, now = new Date()): ProjectReport {
  const through = final?.throughAt ?? now.toISOString(), timezone = final?.timezone ?? facts.timezone;
  const dayOf = workspaceDays(timezone), lastDay = dayOf(through);
  const available = recorded.filter(d => d.date < lastDay);
  const daily = new Map(available.map(d => [d.date,d]));
  const limitations: string[] = [];
  const liveIssues = facts.issues.filter(i => i.member && !excluded(i.category));
  const scope = final?.scope ?? liveIssues.length;
  const completed = final?.completed ?? liveIssues.filter(i => i.category === "completed").length;
  const changes = facts.memberships.filter(e => Date.parse(e.at) <= Date.parse(through));
  const days: ProjectReport["days"] = [];
  for (let date = dayOf(facts.createdAt); date <= lastDay; date = shiftDay(date, 1)) {
    const captured = daily.get(date), terminal = date === lastDay;
    const identifiers = (direction: "added" | "removed") => [...new Set(changes
      .filter(e => e.direction === direction && dayOf(e.at) === date).map(e => e.identifier))].sort();
    days.push({ date, scope: terminal ? scope : captured?.scope ?? null,
      completed: terminal ? completed : captured?.completed ?? null,
      added: identifiers("added"), removed: identifiers("removed") });
  }
  if (days.some(d => d.scope === null || d.completed === null)) limitations.push("History not recorded for days without a daily snapshot. Recording starts at the first scheduled workspace day close; days before recording are not reconstructed.");
  if (available.some(d => d.completions === null)) limitations.push("Some daily completion counts were not recorded because source status history had already been erased at capture. They do not contribute to the projection.");
  if (available.some(d => d.timezone !== timezone)) limitations.push("Some daily snapshots were recorded in an earlier workspace time zone; each keeps its original closing balance.");
  return { source: final ? "snapshot" : "live", timezone, through, finalState: final?.finalState ?? null,
    recoveredAt: available[0]?.recordedAt ?? null, days,
    projection: projectProjection(available,timezone,through,scope-completed,final !== null), limitations };
}
