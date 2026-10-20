import { excluded, reportChronology, workspaceDays } from "./chronology";
import type { ProjectReportFacts } from "./schema";

/** Identities are used only in memory while source rows still exist. The caller
 * persists these three scalar counts, never the underlying issue/status facts. */
export function countReportDay(facts: ProjectReportFacts, date: string) {
  const chronology = reportChronology(facts), dayOf = workspaceDays(facts.timezone);
  const after = (at: string) => dayOf(at) > date;
  let scope: number | null = 0, completed: number | null = 0;
  const completions = new Set<string>();
  let erasedDuringDay = false;
  for (const identifier of chronology.identifiers) {
    if (chronology.memberAt(identifier, after)) {
      const category = chronology.categoryAt(identifier, after);
      if (category === null) { scope = null; completed = null; }
      else if (!excluded(category)) {
        if (scope !== null) scope++;
        if (completed !== null && category === "completed") completed++;
      }
    }
    const issue = chronology.issues.get(identifier);
    if (!issue) {
      // An erased issue present during this day may have completed before its
      // deletion. Do not silently turn its erased transitions into zero events.
      if (chronology.memberAt(identifier, at => dayOf(at) >= date) ||
        chronology.events.some(e => e.identifier === identifier && dayOf(e.at) === date)) erasedDuringDay = true;
      continue;
    }
    const candidates = issue.transitions.filter(t => t.category === "completed" && t.previousCategory !== "completed").map(t => t.at);
    const creationCategory = chronology.categoryAt(identifier, at => Date.parse(at) > Date.parse(issue.createdAt));
    if (creationCategory === "completed") candidates.push(issue.createdAt);
    if (candidates.some(at => dayOf(at) === date && chronology.memberAt(identifier, eventAt => Date.parse(eventAt) > Date.parse(at)))) completions.add(identifier);
  }
  return { scope, completed, completions: erasedDuringDay ? null : completions.size };
}
