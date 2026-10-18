import { reconcileParentChanges } from "../subissues/reconcile";
import {
  mutationDatabase,
  isMutationAccessError,
} from "../auth/mutation-database";
import { requireIssueAccess } from "../issues/access";
import { createUlid } from "../../shared/ids";
import { IssueMutationError } from "../issues/errors";
export type ParentInput = {
  expectedVersion: number;
  parentIdentifier: string | null;
};
export async function updateIssueParent(
  source: D1Database,
  identifier: string,
  actor: string,
  input: ParentInput,
) {
  const db = mutationDatabase(source, actor);
  const issue = await requireIssueAccess(db, identifier, actor);
  if (issue.version !== input.expectedVersion) return "stale" as const;
  const parent =
    input.parentIdentifier === null
      ? null
      : await requireIssueAccess(db, input.parentIdentifier, actor);
  if (parent?.id === issue.id)
    throw new IssueMutationError(
      "invalid_option",
      "An issue cannot be its own parent.",
    );
  const now = new Date().toISOString(),
    activity = createUlid(new Date(now));
  const admission = `EXISTS(SELECT 1 FROM issues i JOIN teams t ON t.id=i.team_id JOIN operators o ON o.workspace_id=t.workspace_id WHERE i.id=? AND i.version=? AND o.id=? AND o.removed_at IS NULL)`;
  try {
    await db.batch([
      db
        .prepare(
          `SELECT CASE WHEN ${admission} THEN 1 ELSE json('parent admission denied') END`,
        )
        .bind(issue.id, input.expectedVersion, actor),
      ...(parent
        ? [
            db
              .prepare(
                `SELECT CASE WHEN EXISTS(SELECT 1 FROM issues p JOIN teams t ON t.id=p.team_id JOIN operators o ON o.workspace_id=t.workspace_id WHERE p.id=? AND o.id=? AND o.removed_at IS NULL) THEN 1 ELSE json('parent unavailable') END`,
              )
              .bind(parent.id, actor),
          ]
        : []),
      db
        .prepare(
          `INSERT INTO issue_activity(id,issue_id,actor_operator_id,kind,previous_value_json,next_value_json,created_at,updated_at)
        SELECT ?,i.id,?,'issue.parent_changed',json_object('parentIdentifier',(SELECT p.identifier FROM issue_parents link JOIN issues p ON p.id=link.parent_issue_id WHERE link.issue_id=i.id)),json_object('parentIdentifier',?),?,? FROM issues i
        WHERE i.id=? AND (SELECT parent_issue_id FROM issue_parents WHERE issue_id=i.id) IS NOT ?`,
        )
        .bind(
          activity,
          actor,
          input.parentIdentifier,
          now,
          now,
          issue.id,
          parent?.id ?? null,
        ),
      db
        .prepare(
          `DELETE FROM issue_parents WHERE issue_id=? AND EXISTS(SELECT 1 FROM issue_activity WHERE id=?)`,
        )
        .bind(issue.id, activity),
      ...(parent
        ? [
            db
              .prepare(
                `INSERT INTO issue_parents(issue_id,parent_issue_id,created_at,position) SELECT ?,?,?,COALESCE((SELECT max(position)+1 FROM issue_parents WHERE parent_issue_id=?),1) WHERE EXISTS(SELECT 1 FROM issue_activity WHERE id=?)`,
              )
              .bind(issue.id, parent.id, now, parent.id, activity),
          ]
        : []),
      db
        .prepare(
          `UPDATE issues SET version=version+1,updated_at=? WHERE id=? AND EXISTS(SELECT 1 FROM issue_activity WHERE id=?)`,
        )
        .bind(now, issue.id, activity),
      reconcileParentChanges(db, activity),
    ]);
  } catch (error) {
    if (isMutationAccessError(error)) throw error;
    const current = await requireIssueAccess(db, identifier, actor);
    if (current.version !== input.expectedVersion) return "stale" as const;
    if (parent) await requireIssueAccess(db, input.parentIdentifier!, actor);
    if (error instanceof Error && /issue_parent_cycle/.test(error.message))
      throw new IssueMutationError(
        "invalid_option",
        "A parent link cannot create an ancestry cycle.",
      );
    if (error instanceof Error && /issue_parent_workspace/.test(error.message))
      throw new IssueMutationError(
        "invalid_option",
        "Parent must belong to this workspace.",
      );
    throw error;
  }
  return "written" as const;
}
