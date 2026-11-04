import type { IssueListQuery } from "../list-schema";
import type { WorkspaceOptions } from "../../../shared/workspace-options";
import { defaultIssueListQuery } from "./issue-list-controls";
import { priorityLabel } from "./labels";

const names = { q: "Search", expression: "Combined filter", category: "Category", status: "Status", priority: "Priority", assignee: "Assignee", team: "Team", project: "Project", cycle: "Cycle", label: "Label", start: "Start", due: "Due", blocked: "Blocked", parent: "Parent" } as const;
export function AppliedIssueFilters({ query, options, onChange }: { query: IssueListQuery; options: WorkspaceOptions | null; onChange: (change: Partial<IssueListQuery>) => void }) {
  const values = { status: options?.statuses, assignee: options?.operators, team: options?.teams, project: options?.projects, cycle: options?.cycles, label: options?.labels };
  const applied = (Object.keys(names) as (keyof typeof names)[]).filter(key => query[key] !== defaultIssueListQuery[key]);
  if (!applied.length) return null;
  return <div className="issue-applied-filters" aria-label="Applied filters">{applied.map(key => {
    const value = query[key];
    const list = key in values ? values[key as keyof typeof values] : undefined;
    const label = list?.find(item => item.id === value)?.name ?? (key === "priority" ? priorityLabel(value) : value === "none" ? "None" : value === "unassigned" ? "Unassigned" : list ? "Selected value" : value.replaceAll("_", " "));
    return <button type="button" key={key} aria-label={`Remove ${names[key]} filter`} onClick={() => onChange({ [key]: defaultIssueListQuery[key] })}>{names[key]}: {label} ×</button>;
  })}</div>;
}
