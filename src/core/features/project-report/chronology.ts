import type { ProjectReportFacts } from "./schema";

export function workspaceDays(timezone: string) {
  const format = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit",
  });
  return (at: string | number) => {
    const parts = Object.fromEntries(format.formatToParts(new Date(at)).map(p => [p.type, p.value]));
    return `${parts.year}-${parts.month}-${parts.day}`;
  };
}
export const shiftDay = (day: string, count: number) =>
  new Date(Date.parse(day + "T12:00:00Z") + count * 86400000).toISOString().slice(0, 10);
export const excluded = (category: string) => ["canceled", "duplicate"].includes(category);

/** Reverse from the latest balance. Event ids preserve insertion order when
 * multiple project moves have the exact same timestamp. */
export function reportChronology(facts: ProjectReportFacts) {
  const events = [...facts.memberships].sort((a, b) => Date.parse(b.at) - Date.parse(a.at) || b.id - a.id);
  const byIssue = new Map<string, typeof events>();
  for (const event of events) {
    const group = byIssue.get(event.identifier) ?? [];
    group.push(event); byIssue.set(event.identifier, group);
  }
  const issues = new Map(facts.issues.map(issue => [issue.identifier, issue]));
  const transitions = new Map(facts.issues.map(issue => [issue.identifier, [...issue.transitions]
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at) || b.id.localeCompare(a.id))]));
  const identifiers = [...new Set([...byIssue.keys(), ...facts.issues.filter(i => i.member).map(i => i.identifier)])].sort();
  const memberAt = (identifier: string, after: (at: string) => boolean) => {
    const issue = issues.get(identifier);
    let member = issue?.member ?? false;
    for (const event of byIssue.get(identifier) ?? []) if (after(event.at)) member = event.direction === "removed";
    return member;
  };
  const categoryAt = (identifier: string, after: (at: string) => boolean) => {
    const issue = issues.get(identifier);
    let category: string | null = issue?.category ?? null;
    for (const transition of transitions.get(identifier) ?? []) if (after(transition.at)) category = transition.previousCategory;
    return category;
  };
  return { events, issues, identifiers, transitions, memberAt, categoryAt };
}
