import { detachedRemovalRow, confirmDetachedRemoval } from "./detached";
import { MutationAccessError } from "../auth/mutation-database";
import { requireIssueAccess } from "../issues/access";
import { createUlid } from "../../shared/ids";

export type FileRemovalRow = {
  detached?: number;
  id: string;
  issue_id: string;
  identifier: string;
  blob_key: string;
  bytes: number;
  writer_settled: number;
  content_sha256: string | null;
  removal_requested_at: string | null;
  removal_actor_operator_id: string | null;
  removal_confirmed_at: string | null;
  deleted_at: string | null;
};

const columns = `f.id,f.issue_id,i.identifier,f.blob_key,f.bytes,f.writer_settled,
 f.content_sha256,f.removal_requested_at,f.removal_actor_operator_id,
 f.removal_confirmed_at,f.deleted_at`;

export async function removalRow(db: D1Database, issueId: string, id: string) {
  return (await db
    .prepare(
      `SELECT ${columns} FROM issue_files f JOIN issues i ON i.id=f.issue_id WHERE f.id=? AND f.issue_id=?`,
    )
    .bind(id, issueId)
    .first<FileRemovalRow>()) ?? detachedRemovalRow(db, issueId, id);
}

export async function requestRemovalIntent(
  db: D1Database,
  issueId: string,
  id: string,
  actor: string,
  operatorIssue?: { identifier: string },
) {
  if (operatorIssue) await requireIssueAccess(db, operatorIssue.identifier, actor);
  const now = new Date().toISOString();
  const intent = await db
    .prepare(
      `UPDATE issue_files SET
    removal_requested_at=COALESCE(removal_requested_at,?),
    removal_actor_operator_id=COALESCE(removal_actor_operator_id,?),updated_at=?
    WHERE id=? AND issue_id=? AND removal_confirmed_at IS NULL
      AND EXISTS(SELECT 1 FROM operators WHERE id=? AND removed_at IS NULL)
      ${operatorIssue ? `AND EXISTS(SELECT 1 FROM issues i JOIN teams t ON t.id=i.team_id
        JOIN operators o ON o.workspace_id=t.workspace_id WHERE i.id=issue_files.issue_id
        AND o.id=? AND o.removed_at IS NULL)` : ""}`,
    )
    .bind(now, actor, now, id, issueId, actor, ...(operatorIssue ? [actor] : []))
    .run();
  if (operatorIssue && intent.meta.changes === 0)
    await requireIssueAccess(db, operatorIssue.identifier, actor);
  if (
    !(await db
      .prepare("SELECT 1 FROM operators WHERE id=? AND removed_at IS NULL")
      .bind(actor)
      .first())
  )
    throw new MutationAccessError();
  return removalRow(db, issueId, id);
}

export async function removalAttempt(
  db: D1Database,
  row: FileRemovalRow,
  error: string | null,
) {
  await db
    .prepare(
      `UPDATE ${row.detached ? "detached_file_removals" : "issue_files"} SET cleanup_error=?,updated_at=? WHERE id=? AND issue_id=? AND removal_confirmed_at IS NULL`,
    )
    .bind(error, new Date().toISOString(), row.id, row.issue_id)
    .run();
}

export async function markWriterSettled(db: D1Database, row: FileRemovalRow) {
  // The parent may disappear while R2 head is in flight. Settle the exact
  // reservation wherever the committed deletion transaction moved custody.
  await db.batch(["issue_files", "detached_file_removals"].map(table => db.prepare(
    `UPDATE ${table} SET writer_settled=1,updated_at=? WHERE id=? AND issue_id=? AND blob_key=? AND removal_requested_at IS NOT NULL AND removal_confirmed_at IS NULL`
  ).bind(new Date().toISOString(), row.id, row.issue_id, row.blob_key)));
}

export async function confirmRemoval(db: D1Database, row: FileRemovalRow) {
  if (row.detached) return confirmDetachedRemoval(db, row);
  const now = new Date().toISOString();
  const active = `id=? AND issue_id=? AND writer_settled=1 AND removal_requested_at IS NOT NULL AND removal_confirmed_at IS NULL`;
  const fresh = `EXISTS(SELECT 1 FROM issue_files WHERE ${active} AND deleted_at IS NULL)`;
  const results = await db.batch([
    db
      .prepare(
        `INSERT INTO issue_activity(id,issue_id,actor_operator_id,kind,next_value_json,created_at,updated_at)
      SELECT ?,?,?,'file.deleted',?,?,? WHERE ${fresh}`,
      )
      .bind(
        createUlid(new Date()),
        row.issue_id,
        row.removal_actor_operator_id,
        JSON.stringify({ id: row.id }),
        now,
        now,
        row.id,
        row.issue_id,
      ),
    db
      .prepare(
        `INSERT INTO audit_records(id,actor_operator_id,action,subject_identifier,subject_id,created_at,updated_at)
      SELECT ?,?,'file.deleted',?,?,?,? WHERE ${fresh}`,
      )
      .bind(
        createUlid(new Date()),
        row.removal_actor_operator_id,
        row.identifier,
        row.id,
        now,
        now,
        row.id,
        row.issue_id,
      ),
    db
      .prepare(
        `UPDATE issue_files SET deleted_at=COALESCE(deleted_at,?),removal_confirmed_at=?,
      cleanup_error=NULL,name='',content_type='',content_sha256=NULL,updated_at=? WHERE ${active}`,
      )
      .bind(now, now, now, row.id, row.issue_id),
  ]);
  if (results[2].meta.changes === 1) return true;
  const detached = await detachedRemovalRow(db, row.issue_id, row.id);
  return detached ? confirmDetachedRemoval(db, detached) : false;
}

export async function pendingRemovals(db: D1Database) {
  const rows = await db
    .prepare(
      `SELECT ${columns},0 detached,f.updated_at FROM issue_files f JOIN issues i ON i.id=f.issue_id
    WHERE f.removal_requested_at IS NOT NULL AND f.removal_confirmed_at IS NULL
    AND NOT EXISTS(SELECT 1 FROM vector_restore_status WHERE effects_held=1)
    AND NOT EXISTS(SELECT 1 FROM vector_http_restore)
    UNION ALL SELECT id,issue_id,identifier,blob_key,bytes,writer_settled,content_sha256,removal_requested_at,removal_actor_operator_id,removal_confirmed_at,deleted_at,1 detached,updated_at
    FROM detached_file_removals WHERE removal_confirmed_at IS NULL
    AND NOT EXISTS(SELECT 1 FROM vector_restore_status WHERE effects_held=1)
    AND NOT EXISTS(SELECT 1 FROM vector_http_restore)
    ORDER BY updated_at,id LIMIT 50`,
    )
    .all<FileRemovalRow>();
  return rows.results;
}
