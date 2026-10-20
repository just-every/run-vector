import type { CycleSnapshot } from "../cycle-closure/schema";
import type { DailyReportCount } from "../project-report/schema";
import type { CycleReport, CycleReportFacts } from "./schema";

type CycleWindow = { startsAt: string; endsAt: string; timezone: string };
type Committed = { identifier: string; category: string };
const unique = (values: string[]) => [...new Set(values)].sort();
const excluded = (category: string) => ["canceled", "duplicate"].includes(category);

/** Counts issues throughout: changing estimates never rewrites the burn-up's unit. */
export function buildCycleReport(
  cycle: CycleWindow, facts: CycleReportFacts | null, committed: Committed[],
  snapshot: CycleSnapshot | null, now = new Date(), recorded?: DailyReportCount[],
): CycleReport {
  const through = snapshot?.closedAt ?? now.toISOString();
  const timezone = snapshot?.timezone ?? cycle.timezone;
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit",
  });
  const dayOf = (at: string | number) => {
    const parts = Object.fromEntries(formatter.formatToParts(new Date(at)).map(p => [p.type, p.value]));
    return `${parts.year}-${parts.month}-${parts.day}`;
  };
  const start = Date.parse(cycle.startsAt), end = Date.parse(cycle.endsAt);
  const last = Math.min(Date.parse(through), end - 1);
  const lastDay = dayOf(last);
  const changes = snapshot?.changes ?? (facts?.memberships ?? []).filter(e =>
    Date.parse(e.at) >= start && Date.parse(e.at) < end && Date.parse(e.at) <= Date.parse(through));
  const addedMidcycle = unique(changes.filter(e => e.direction === "added" && Date.parse(e.at) > start).map(e => e.identifier));
  const completed = snapshot?.completed ?? committed.filter(i => i.category === "completed").map(i => i.identifier);
  const carried = committed.filter(i => ["unstarted", "started"].includes(i.category)).map(i => i.identifier);
  const other = committed.filter(i => !completed.includes(i.identifier) && !carried.includes(i.identifier)).map(i => i.identifier);
  const limitations: string[] = [];
  if (!facts) limitations.push("This older snapshot did not record daily status history or assignees. Only its closing totals and scope changes are available.");
  const members = new Set(committed.map(i => i.identifier));
  const closingCategories = new Map(committed.map(i => [i.identifier, i.category]));
  const issueFacts = new Map(facts?.issues.map(i => [i.identifier, i]) ?? []);
  const memberships = (facts?.memberships ?? []).filter(e => Date.parse(e.at) <= Date.parse(through))
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at) || b.id.localeCompare(a.id));
  const membershipByIssue = new Map<string, { direction: "added" | "removed"; day: string }[]>();
  for (const event of memberships) {
    const events = membershipByIssue.get(event.identifier) ?? [];
    events.push({ direction: event.direction, day: dayOf(event.at) });
    membershipByIssue.set(event.identifier, events);
  }
  const identifiers = unique([...members, ...memberships.map(e => e.identifier)]);
  const transitions = new Map(facts?.issues.map(i => [i.identifier, [...i.transitions]
    .filter(t => Date.parse(t.at) <= Date.parse(through))
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at) || b.id.localeCompare(a.id))
    .map(t => ({ ...t, day: dayOf(t.at) }))]) ?? []);
  const datedChanges = changes.map(event => ({ ...event, day: dayOf(event.at) }));
  let missingHistory = false;
  const days: CycleReport["days"] = [];
  for (let date = dayOf(start); last >= start && date <= lastDay;) {
    const terminal = date === lastDay;
    let scope: number | null = 0, done: number | null = 0;
    if (!facts && !terminal) { scope = null; done = null; }
    else for (const identifier of identifiers) {
      let member = members.has(identifier);
      if (!terminal) for (const event of membershipByIssue.get(identifier) ?? []) {
        if (event.day > date) member = event.direction === "removed";
      }
      if (!member) continue;
      const issue = issueFacts.get(identifier);
      let category: string | null = closingCategories.get(identifier) ?? issue?.category ?? null;
      if (!terminal && issue) for (const transition of transitions.get(identifier) ?? []) {
        if (transition.day > date) category = transition.previousCategory;
      }
      if (category === null) { scope = null; done = null; missingHistory = true; break; }
      if (!excluded(category)) { scope = (scope ?? 0) + 1; if (category === "completed") done = (done ?? 0) + 1; }
    }
    days.push({ date, scope, completed: done,
      added: unique(datedChanges.filter(e => e.direction === "added" && e.day === date).map(e => e.identifier)),
      removed: unique(datedChanges.filter(e => e.direction === "removed" && e.day === date).map(e => e.identifier)),
    });
    date = new Date(Date.parse(date + "T12:00:00Z") + 86400000).toISOString().slice(0, 10);
  }
  if (!recorded && missingHistory) limitations.push("Some daily totals are unavailable because an issue was deleted or its historical status was removed before the report was recorded.");
  // Older frozen cycle facts already crossed the approved closure boundary.
  // Preserve those reports; newly recorded/live history uses counts-only days.
  if (recorded) {
  const recordedByDay = new Map(recorded.map(day => [day.date,day]));
  for (const day of days) {
    const captured = recordedByDay.get(day.date);
    if (captured) { day.scope = captured.scope; day.completed = captured.completed; }
    else if (day.date !== lastDay) { day.scope = null; day.completed = null; }
  }
  if (days.some(day => day.scope === null || day.completed === null)) limitations.push("History not recorded for days without a daily snapshot. Recording starts at the first scheduled workspace day close.");
  }
  const groups = new Map<string, CycleReport["byAssignee"][number]>();
  for (const issue of committed) {
    const recorded = facts ? issueFacts.get(issue.identifier) : undefined;
    const key = recorded ? recorded.assigneeId ?? "unassigned" : "not-recorded";
    let group = groups.get(key);
    if (!group) {
      group = { id: recorded?.assigneeId ?? null,
        name: !recorded ? "Not recorded" : recorded.assigneeId === null ? "Unassigned" : recorded.assigneeName ?? "Removed operator",
        completed: 0, carried: 0, other: 0, addedMidcycle: 0 };
      groups.set(key, group);
    }
    if (completed.includes(issue.identifier)) group.completed++;
    else if (carried.includes(issue.identifier)) group.carried++;
    else group.other++;
    if (addedMidcycle.includes(issue.identifier)) group.addedMidcycle++;
  }
  return { source: snapshot ? facts ? "snapshot" : "legacy-snapshot" : "live", timezone, through,
    days, completed: unique(completed), carried: unique(carried), other: unique(other), addedMidcycle,
    byAssignee: [...groups.values()].sort((a, b) => a.name.localeCompare(b.name)), limitations };
}
