import { isMutationAccessError } from "../auth/mutation-database";
import { IssueMutationError } from "./errors";

/** Assignee eligibility can change after form validation, independently of the
 * actor's session. Abort the same transaction that writes the requested issue. */
export async function commitWithAssignee(
  db: D1Database,
  assignee: string | null,
  workspace: string,
  writes: D1PreparedStatement[],
) {
  if (assignee === null) return db.batch(writes);
  const available = `EXISTS(SELECT 1 FROM operators WHERE id=? AND workspace_id=? AND removed_at IS NULL)`;
  try {
    const results = await db.batch([
      db
        .prepare(
          `SELECT CASE WHEN ${available} THEN 1 ELSE json('assignee unavailable') END`,
        )
        .bind(assignee, workspace),
      ...writes,
    ]);
    return results.slice(1);
  } catch (error) {
    if (isMutationAccessError(error)) throw error;
    if (
      !(await db
        .prepare(`SELECT ${available} AS available`)
        .bind(assignee, workspace)
        .first<number>("available"))
    )
      throw new IssueMutationError(
        "invalid_option",
        "Assignee is no longer available in this workspace.",
      );
    throw error;
  }
}
