type ReferenceActivity = { kind: string; nextValueJson: string | null };

/** A snapshot can be supplied by document rendering. Scope its retained
 * backlinks against the visible live sources before exposing activity JSON. */
export function referenceSourceVisible(activity: ReferenceActivity, visibleIssues: ReadonlySet<string>): boolean {
  if (activity.kind !== "issue.mentioned") return true;
  if (activity.nextValueJson === null) return false;
  const value: unknown = JSON.parse(activity.nextValueJson);
  return typeof value === "object" && value !== null && "sourceIssueId" in value
    && typeof value.sourceIssueId === "string" && visibleIssues.has(value.sourceIssueId);
}
