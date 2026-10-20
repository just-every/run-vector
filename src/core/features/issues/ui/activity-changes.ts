import type { StreamOptions } from "../../streams/ui/data";

// History rows say what changed: each stored before/after pair becomes
// "Status: Backlog → In progress". Long text fields only say they were edited;
// derived timestamps (completed/canceled) follow the status and are not listed.
type Named = { id: string; name: string };
type Change = { field: string; from?: string; to?: string };

const name = (list: Named[] | undefined, id: unknown, none: string, gone: string) =>
  id === null || id === undefined || id === "" ? none : list?.find((item) => item.id === id)?.name ?? gone;
const date = (value: unknown) =>
  typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)
    ? new Date(value.slice(0, 10) + "T00:00:00Z").toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })
    : "Not set";
const priority = (value: unknown) =>
  typeof value !== "string" || value === "none" ? "No priority" : value[0]!.toUpperCase() + value.slice(1);

const FIELDS: Record<string, { label: string; show?: (value: unknown, options: StreamOptions | null) => string }> = {
  statusId: { label: "Status", show: (v, o) => name(o?.statuses, v, "None", "a status in another team") },
  teamId: { label: "Team", show: (v, o) => name(o?.teams, v, "None", "another team") },
  assigneeOperatorId: { label: "Assignee", show: (v, o) => name(o?.operators, v, "Unassigned", "a removed operator") },
  priority: { label: "Priority", show: priority },
  projectId: { label: "Project", show: (v, o) => name(o?.projects, v, "No project", "an archived project") },
  milestoneId: { label: "Milestone", show: (v, o) => name(o?.milestones, v, "No milestone", "a removed milestone") },
  cycleId: { label: "Cycle", show: (v, o) => name(o?.cycles, v, "No cycle", "an earlier cycle") },
  dueDate: { label: "Due date", show: date },
  estimate: { label: "Estimate", show: (v) => (v === null || v === undefined ? "None" : String(v)) },
  labelIds: { label: "Labels", show: (v, o) => (Array.isArray(v) && v.length ? v.map((id) => name(o?.labels, id, "", "a deleted label")).join(", ") : "None") },
  parentIdentifier: { label: "Parent", show: (v) => (typeof v === "string" && v ? v : "None") },
  title: { label: "Title", show: (v) => (typeof v === "string" ? `“${v}”` : "None") },
  description: { label: "Description" },
  checklist: { label: "Checklist", show: value => { const task = value as { text?: string; checked?: boolean } | null; return task?.text ? `${task.checked ? "Checked" : "Unchecked"}: ${task.text}` : ""; } },
  descriptionRestore: { label: "Restored description revision", show: value => { const restore = value as { revisionId?: string } | null; return restore?.revisionId ?? ""; } },
  expectedOutcome: { label: "Expected outcome" },
  customerImpact: { label: "Customer impact" },
  customFields: { label: "Custom fields" },
};

const record = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

export function activityChanges(kind: string, previousValue: unknown, nextValue: unknown, options: StreamOptions | null): Change[] {
  // A created or imported issue's values are the issue itself, not a change.
  if (kind === "issue.created" || kind === "issue.imported") return [];
  const before = record(previousValue), after = record(nextValue);
  return Object.keys(FIELDS)
    .filter((key) => key in after || key in before)
    .map((key) => {
      const field = FIELDS[key]!;
      return field.show
        ? { field: field.label, from: field.show(before[key], options), to: field.show(after[key], options) }
        : { field: field.label };
    })
    .filter((change) => change.from === undefined || change.from !== change.to);
}

export function activityTitle(kind: string, nextValue?: unknown) {
  if (kind === "issue.copied_from") return `Copied from ${String(record(nextValue).identifier ?? "an issue")}`;
  if (kind === "issue.copied_to") return `Copied to ${String(record(nextValue).identifier ?? "an issue")}`;
  if (typeof record(nextValue).undoOf === 'string') return 'Undid the previous change';
  if (kind === "issue.auto_closed") return `Closed automatically after ${String(record(nextValue).days ?? "")} days without activity`;
  if (kind === "issue.auto_archived") return `Archived automatically ${String(record(nextValue).days ?? "")} days after it closed`;
  const titles: Record<string, string> = {
    "issue.created": "Created the issue",
    "issue.updated": "Changed the issue",
    "issue.cycle_automatically_added": "Added to the active cycle automatically",
    "issue.team_moved": "Moved to another team",
    "issue.parent_changed": "Changed the parent",
    "issue.duplicate_changed": "Changed the duplicate link",
    "issue.related_added": "Related an issue",
    "issue.related_removed": "Removed a related link",
    "issue.dependency_added": "Added a dependency",
    "issue.evidence_added": "Added evidence",
    "issue.imported": "Imported the issue",
    "issue.operator_removed": "Unassigned a removed operator",
    "comment.created": "Commented",
    "comment.edited": "Edited a comment",
    "comment.deleted": "Deleted a comment",
    "thread.resolved": "Resolved a thread",
    "thread.reopened": "Reopened a thread",
  };
  return titles[kind] ?? kind.replace(/^issue\./, "").replaceAll(/[._]/g, " ").replace(/^./, (letter) => letter.toUpperCase());
}
