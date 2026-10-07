/** R2 is outside the D1 transaction. A committed upload reservation or removal
 * intent must settle before operator removal can report success. Never infer a
 * writer has stopped from elapsed time or blob absence. The existing durable
 * cleanup journey reconciles failed effects before removal can be retried.
 */
export const pendingOperatorFiles = `EXISTS(SELECT 1 FROM issue_files f
  WHERE f.removal_confirmed_at IS NULL AND (
    (f.actor_operator_id=target.id AND f.writer_settled=0) OR
    (f.removal_actor_operator_id=target.id AND f.removal_requested_at IS NOT NULL)
  ))`;
export async function hasPendingOperatorFiles(db: D1Database, target: string) {
  return !!(await db
    .prepare(
      `SELECT ${pendingOperatorFiles} AS pending FROM operators target WHERE target.id=?`,
    )
    .bind(target)
    .first<number>("pending"));
}
