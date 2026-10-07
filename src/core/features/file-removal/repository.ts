import { MutationAccessError } from "../auth/mutation-database";
import { createUlid } from "../../shared/ids";

export type FileRemovalRow = {
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

export function removalRow(db: D1Database, issueId: string, id: string) {
  return db
    .prepare(
      `SELECT ${columns} FROM issue_files f JOIN issues i ON i.id=f.issue_id WHERE f.id=? AND f.issue_id=?`,
    )
    .bind(id, issueId)
    .first<FileRemovalRow>();
}

export async function requestRemovalIntent(
  db: D1Database,
  issueId: string,
  id: string,
  actor: string,
) {
  const now = new Date().toISOString();
  await db
    .prepare(
      `UPDATE issue_files SET
    removal_requested_at=COALESCE(removal_requested_at,?),
    removal_actor_operator_id=COALESCE(removal_actor_operator_id,?),updated_at=?
    WHERE id=? AND issue_id=? AND removal_confirmed_at IS NULL
      AND EXISTS(SELECT 1 FROM operators WHERE id=? AND removed_at IS NULL)`,
    )
    .bind(now, actor, now, id, issueId, actor)
    .run();
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
      "UPDATE issue_files SET cleanup_error=?,updated_at=? WHERE id=? AND issue_id=? AND removal_confirmed_at IS NULL",
    )
    .bind(error, new Date().toISOString(), row.id, row.issue_id)
    .run();
}

export async function markWriterSettled(db: D1Database, row: FileRemovalRow) {
  await db
    .prepare(
      `UPDATE issue_files SET writer_settled=1,updated_at=?
    WHERE id=? AND issue_id=? AND blob_key=? AND removal_requested_at IS NOT NULL AND removal_confirmed_at IS NULL`,
    )
    .bind(new Date().toISOString(), row.id, row.issue_id, row.blob_key)
    .run();
}

export async function confirmRemoval(db: D1Database, row: FileRemovalRow) {
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
  return results[2].meta.changes === 1;
}

export async function pendingRemovals(db: D1Database) {
  const rows = await db
    .prepare(
      `SELECT ${columns} FROM issue_files f JOIN issues i ON i.id=f.issue_id
    WHERE f.removal_requested_at IS NOT NULL AND f.removal_confirmed_at IS NULL
    ORDER BY f.updated_at,f.id LIMIT 50`,
    )
    .all<FileRemovalRow>();
  return rows.results;
}
