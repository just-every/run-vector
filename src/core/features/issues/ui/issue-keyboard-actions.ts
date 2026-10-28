import { z } from "zod";
import type { WorkspaceOptions } from "../../../shared/workspace-options";
import type { IssueRow } from "./issue-selection";

export const issueEditFields = {
  statusId: "Status",
  assigneeOperatorId: "Assignee",
  priority: "Priority",
  labelIds: "Labels",
  estimate: "Estimate",
  startDate: "Start date",
  dueDate: "Due date",
  projectId: "Project",
  milestoneId: "Milestone",
  cycleId: "Cycle",
} as const;
export type IssueEditField = keyof typeof issueEditFields;
export type IssueEditTarget = Pick<IssueRow,
  "identifier" | "title" | "version" | "team" | "status" | "priority" |
  "assignee" | "project" | "milestone" | "cycle" | "labels" | "startDate" | "dueDate"
> & { estimate?: number | null };
export const issueEditShortcuts: Record<string, IssueEditField> = {
  s: "statusId", a: "assigneeOperatorId", p: "priority", l: "labelIds",
  e: "estimate", d: "dueDate",
};
export const bulkReceiptSchema = z.object({
  issues: z.array(z.object({ identifier: z.string(), version: z.number() })),
  changed: z.number(),
});
export type BulkReceipt = z.output<typeof bulkReceiptSchema>;
export const bulkFailuresSchema = z.object({
  failures: z.array(z.object({ identifier: z.string(), reasons: z.array(z.string()) })),
});

export function issueEditChoices(field: IssueEditField, rows: IssueEditTarget[], options: WorkspaceOptions) {
  const teams = new Set(rows.map((row) => row.team.id));
  if (field === "statusId") return options.statuses.filter((status) =>
    rows.every((row) => row.team.id === status.teamId &&
      (row.status.id === status.id || !["intake", "duplicate"].includes(row.status.category))) &&
    !["intake", "duplicate"].includes(status.category));
  if (field === "assigneeOperatorId") return options.operators;
  if (field === "projectId") return options.projects;
  if (field === "milestoneId") return options.milestones.filter(milestone => rows.every(row => row.project?.id === milestone.projectId));
  if (field === "cycleId") return options.cycles.filter((cycle) => teams.size === 1 && teams.has(cycle.teamId) &&
    rows.every((row) => row.cycle?.id === cycle.id || !["completed", "canceled", "duplicate"].includes(row.status.category)));
  return ["none", "low", "medium", "high", "urgent"].map((id) => ({
    id, name: id === "none" ? "No priority" : id[0]!.toUpperCase() + id.slice(1),
  }));
}

export function issueBranchName(row: IssueEditTarget) {
  const title = row.title.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 180).replace(/-+$/g, "");
  return row.identifier.toLowerCase() + (title ? `-${title}` : "");
}

export function initialIssueEditValue(field: IssueEditField, rows: IssueEditTarget[]) {
  const values = rows.map((row) => field === "statusId" ? row.status.id :
    field === "assigneeOperatorId" ? row.assignee?.id ?? "" :
    field === "projectId" ? row.project?.id ?? "" :
    field === "milestoneId" ? row.milestone?.id ?? "" :
    field === "cycleId" ? row.cycle?.id ?? "" :
    field === "priority" ? row.priority : (field === "dueDate" || field === "startDate") ? row[field] ?? "" :
    field === "estimate" ? String(row.estimate ?? "") : "");
  return values.every((value) => value === values[0]) ? values[0] ?? "" : "";
}
