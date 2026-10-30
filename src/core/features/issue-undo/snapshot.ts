/** Only relevant fields are retained; a bulk priority action never copies bodies. */
export const snapshotFields = [
  "id", "identifier", "version", "teamId", "statusId", "statusCategory",
  "title", "description", "priority", "assigneeOperatorId", "projectId", "milestoneId", "cycleId",
  "startDate", "dueDate", "estimate", "expectedOutcome", "customerImpact", "customFields",
  "completedAt", "canceledAt", "archivedAt", "deferredUntil", "labelIds", "deferralOrigin",
  "canonicalId", "canonicalIdentifier", "canonicalCreatedAt",
  "parentId", "parentIdentifier", "parentCreatedAt", "parentPosition",
] as const;
export type SnapshotField = typeof snapshotFields[number];
export const identityFields: SnapshotField[] = ["id", "identifier", "version", "teamId", "statusId", "statusCategory"];
export const teamFields = ["cycleId"];
export const duplicateFields = ["cycleId", "completedAt", "canceledAt", "deferredUntil", "deferralOrigin", "canonicalId", "canonicalIdentifier", "canonicalCreatedAt"];

/** These are the only issue columns an inverse may write. */
export const issueColumns = {
  teamId: "team_id", statusId: "status_id", title: "title", description: "description",
  priority: "priority", assigneeOperatorId: "assignee_operator_id", projectId: "project_id", milestoneId: "milestone_id",
  cycleId: "cycle_id", startDate: "start_date", dueDate: "due_date", estimate: "estimate", expectedOutcome: "expected_outcome",
  customerImpact: "customer_impact", customFields: "custom_fields_json", completedAt: "completed_at",
  canceledAt: "canceled_at", archivedAt: "archived_at", deferredUntil: "deferred_until",
} as const;
const expressions: Record<SnapshotField, string> = {
  id: "i.id", identifier: "i.identifier", version: "i.version", teamId: "i.team_id",
  statusId: "i.status_id", statusCategory: "s.category", title: "i.title", description: "i.description",
  priority: "i.priority", assigneeOperatorId: "i.assignee_operator_id", projectId: "i.project_id", milestoneId: "i.milestone_id",
  cycleId: "i.cycle_id", startDate: "i.start_date", dueDate: "i.due_date", estimate: "i.estimate", expectedOutcome: "i.expected_outcome",
  customerImpact: "i.customer_impact", customFields: "json(i.custom_fields_json)", completedAt: "i.completed_at",
  canceledAt: "i.canceled_at", archivedAt: "i.archived_at", deferredUntil: "i.deferred_until",
  labelIds: "json((SELECT json_group_array(label_id) FROM (SELECT label_id FROM issue_labels WHERE issue_id=i.id ORDER BY label_id)))",
  deferralOrigin: "(SELECT decision_id FROM issue_deferral_origins WHERE issue_id=i.id)",
  parentId: "(SELECT parent_issue_id FROM issue_parents WHERE issue_id=i.id)",
  parentIdentifier: "(SELECT p.identifier FROM issue_parents r JOIN issues p ON p.id=r.parent_issue_id WHERE r.issue_id=i.id)",
  parentCreatedAt: "(SELECT created_at FROM issue_parents WHERE issue_id=i.id)",
  parentPosition: "(SELECT position FROM issue_parents WHERE issue_id=i.id)",
  canonicalId: "(SELECT canonical_issue_id FROM issue_duplicates WHERE issue_id=i.id)",
  canonicalIdentifier: "(SELECT c.identifier FROM issue_duplicates d JOIN issues c ON c.id=d.canonical_issue_id WHERE d.issue_id=i.id)",
  canonicalCreatedAt: "(SELECT created_at FROM issue_duplicates WHERE issue_id=i.id)",
};

/** Caller supplies a CTE undo_members(id); all dynamic fields are enum validated. */
export function issueSnapshotSql(fields: readonly SnapshotField[], physical = false) {
  const pairs = fields.map((field) => `'${field}',${expressions[field]}`).join(",");
  return `(SELECT json_group_array(json(snapshot)) FROM (
    SELECT json_object(${pairs}) snapshot FROM ${physical ? "main." : ""}issues i
    JOIN ${physical ? "main." : ""}workflow_statuses s ON s.id=i.status_id AND s.team_id=i.team_id
    WHERE i.id IN(SELECT id FROM undo_members) ORDER BY i.id))`;
}
export const duplicateGraphSql = `(SELECT json_group_array(json(edge)) FROM (
  SELECT json_object('issueId',d.issue_id,'canonicalId',d.canonical_issue_id,'createdAt',d.created_at) edge
  FROM issue_duplicates d WHERE d.issue_id IN(SELECT id FROM undo_members)
    OR d.canonical_issue_id IN(SELECT id FROM undo_members) ORDER BY d.issue_id))`;
export const memberCte = "undo_members AS (SELECT value id FROM json_each(?))";

export function issueSnapshotObjectSql(fields: readonly SnapshotField[]) {
  return `json_object(${fields.map((field) => `'${field}',${expressions[field]}`).join(",")})`;
}
