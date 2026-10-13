import { createUlid } from "../../shared/ids";
import type { FileRemovalRow } from "./repository";
/** Transfer every unresolved reservation before discussion deletion, in its batch. */
export function detachFileSql(
  issue: { id: string; identifier: string }, actor: string, at: string,
) {
  return [
    {sql:`INSERT INTO detached_file_removals(id,issue_id,identifier,actor_operator_id,blob_key,bytes,writer_settled,content_sha256,removal_requested_at,removal_actor_operator_id,removal_confirmed_at,deleted_at,cleanup_error,updated_at)
      SELECT id,issue_id,?,actor_operator_id,blob_key,bytes,writer_settled,content_sha256,COALESCE(removal_requested_at,?),COALESCE(removal_actor_operator_id,?),NULL,deleted_at,cleanup_error,?
      FROM issue_files WHERE issue_id=? AND removal_confirmed_at IS NULL`,params:[issue.identifier,at,actor,at,issue.id]},
    ...["issue_links", "issue_comments", "issue_files"].map(table=>({sql:`DELETE FROM ${table} WHERE issue_id=?`,params:[issue.id]})),
  ];
}
export function detachedRemovalRow(
  db: D1Database,
  issueId: string,
  id: string,
) {
  return db
    .prepare(
      "SELECT *,1 detached FROM detached_file_removals WHERE id=? AND issue_id=?",
    )
    .bind(id, issueId)
    .first<FileRemovalRow>();
}
export async function confirmDetachedRemoval(
  db: D1Database,
  row: FileRemovalRow,
) {
  const now = new Date().toISOString();
  const results = await db.batch([
    db
      .prepare(
        `INSERT INTO audit_records(id,actor_operator_id,action,subject_identifier,subject_id,created_at,updated_at)
      SELECT ?,removal_actor_operator_id,'file.deleted',identifier,id,?,? FROM detached_file_removals
      WHERE id=? AND issue_id=? AND writer_settled=1 AND removal_confirmed_at IS NULL`,
      )
      .bind(createUlid(new Date(now)), now, now, row.id, row.issue_id),
    db
      .prepare(
        `UPDATE detached_file_removals SET removal_confirmed_at=?,deleted_at=COALESCE(deleted_at,?),content_sha256=NULL,cleanup_error=NULL,updated_at=?
      WHERE id=? AND issue_id=? AND writer_settled=1 AND removal_confirmed_at IS NULL`,
      )
      .bind(now, now, now, row.id, row.issue_id),
  ]);
  return results[1].meta.changes === 1;
}
