import type { IssueListData } from "../list-schema.ts";
export type IssueRow = IssueListData["issues"][number];
export function toggleIssueSelection(
  selection: Map<string, IssueRow>,
  issue: IssueRow,
) {
  const next = new Map(selection);
  if (next.has(issue.identifier)) next.delete(issue.identifier);
  else next.set(issue.identifier, issue);
  return next;
}
export function refreshIssueSelection(
  selection: Map<string, IssueRow>,
  rows: IssueRow[],
) {
  const next = new Map(selection);
  rows.forEach((row) => {
    if (next.has(row.identifier)) next.set(row.identifier, row);
  });
  return next;
}
export function issueGroups(data: IssueListData, grouping: string) {
  if (grouping === "none")
    return [
      { key: "all", name: "Issues", count: data.total, issues: data.issues },
    ];
  return data.groups
    .map((group) => ({
      ...group,
      issues: data.issues.filter((issue) => issue.groupKey === group.key),
    }))
    .filter((group) => group.issues.length > 0);
}
