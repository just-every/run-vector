import { createUlid } from "../../shared/ids";
import { sourceErasure } from "./source-erasure";
import { eraseD1ImportTarget } from "../../../../vendor/base/import-kit/src/d1/index";
import {
  mutationDatabase,
  isMutationAccessError,
} from "../auth/mutation-database";
import { requireIssueAccess, IssueAccessError } from "../issues/access";
import { importContext, type ImportActor } from "../data/import/authority";
import { deletionTargets } from "./target";
import { deletionStatements } from "./statements";
export class DeletionConflict extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly version?: number,
  ) {
    super(message);
  }
}
export async function canonicalGuard(db: D1Database, id: string) {
  const duplicates = (
    await db
      .prepare(
        "SELECT i.identifier FROM issue_duplicates d JOIN issues i ON i.id=d.issue_id WHERE canonical_issue_id=? ORDER BY i.identifier",
      )
      .bind(id)
      .all<{ identifier: string }>()
  ).results;
  if (duplicates.length)
    throw new DeletionConflict(
      "canonical_has_duplicates",
      "This canonical issue still has duplicates: " +
        duplicates.map((d) => d.identifier).join(", ") +
        ". Repoint or undo them before deleting.",
    );
}
/** issue.can-delete.v1: any currently active operator in this workspace. */
export async function deleteIssue(
  source: D1Database,
  identifier: string,
  actor: ImportActor,
  expectedVersion: number,
) {
  const db = mutationDatabase(source, actor.id, actor.fence),
    issue = await requireIssueAccess(db, identifier, actor.id);
  if (issue.version !== expectedVersion)
    throw new DeletionConflict(
      "stale_version",
      "The issue changed. Review its current version before deleting.",
      issue.version,
    );
  await canonicalGuard(db, issue.id);
  const context = importContext(db, actor, "vector-deletion", "native-v1");
  const at = new Date().toISOString(),
    operationId = createUlid(new Date(at));
  context.storage.targets = deletionTargets({
    id: issue.id,
    identifier: issue.identifier,
    workspace: actor.workspace,
    actor: actor.id,
    at,
    operationId,
  });
  context.originalErasurePolicy = "withdraw-affected-artifacts";
  try {
    const writes = deletionStatements(
      issue,
      actor.id,
      actor.workspace,
      expectedVersion,
      { at, operationId },
    );
    writes.splice(1, 0, ...(await sourceErasure(db, issue.id)));
    await eraseD1ImportTarget("issue", issue.id, writes, context);
  } catch (error) {
    if (isMutationAccessError(error) || error instanceof IssueAccessError)
      throw error;
    const current = await requireIssueAccess(db, identifier, actor.id);
    if (current.version !== expectedVersion)
      throw new DeletionConflict(
        "stale_version",
        "The issue changed. Review its current version before deleting.",
        current.version,
      );
    await canonicalGuard(db, current.id);
    if (
      error instanceof Error &&
      /IMPORT_ERASURE|IMPORT_ATOMIC_GUARD|REQUEST_LIMIT|ASSERTION|constraint.*ik_d1_assertions/i.test(
        error.message,
      )
    )
      throw new DeletionConflict(
        "erasure_conflict",
        "Retained import or issue data changed or requires privacy review. Refresh before deleting.",
      );
    throw error;
  }
  return issue.id;
}
