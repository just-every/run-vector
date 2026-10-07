import { mutationDatabase } from "../auth/mutation-database";
import { createUlid } from "../../shared/ids";
import {
  commentLinkErasureStatements,
  listNamedLinks,
} from "../links/repository";
export async function findIssue(db: D1Database, identifier: string) {
  return db
    .prepare("SELECT id,identifier FROM issues WHERE identifier=?")
    .bind(identifier)
    .first<{ id: string; identifier: string }>();
}
export async function discussion(db: D1Database, issueId: string) {
  const [comments, files, links] = await Promise.all([
    db
      .prepare(
        "SELECT c.id,c.body,c.edited_at AS editedAt,c.deleted_at AS deletedAt,c.created_at AS createdAt,o.name AS actor FROM issue_comments c JOIN operators o ON o.id=c.actor_operator_id WHERE c.issue_id=? ORDER BY c.created_at,c.id",
      )
      .bind(issueId)
      .all(),
    db
      .prepare(
        "SELECT id,name,content_type AS contentType,bytes,state,removal_requested_at AS removalPending,cleanup_error AS cleanupError,created_at AS createdAt FROM issue_files WHERE issue_id=? AND (deleted_at IS NULL OR (removal_requested_at IS NOT NULL AND removal_confirmed_at IS NULL)) ORDER BY created_at,id",
      )
      .bind(issueId)
      .all(),
    listNamedLinks(db, issueId),
  ]);
  return { comments: comments.results, files: files.results, links };
}
function activity(
  db: D1Database,
  actor: string,
  kind: string,
  issueId: string,
  id: string,
  now: string,
) {
  return db
    .prepare(
      "INSERT INTO issue_activity(id,issue_id,actor_operator_id,kind,previous_value_json,next_value_json,created_at,updated_at) VALUES(?,?,?,?,NULL,?,?,?)",
    )
    .bind(
      createUlid(new Date(now)),
      issueId,
      actor,
      kind,
      JSON.stringify({ id }),
      now,
      now,
    );
}
export async function addComment(
  db: D1Database,
  issueId: string,
  actor: string,
  body: string,
) {
  db = mutationDatabase(db, actor);
  const id = createUlid(new Date()),
    now = new Date().toISOString();
  await db.batch([
    db
      .prepare(
        "INSERT INTO issue_comments(id,issue_id,actor_operator_id,body,created_at,updated_at) VALUES(?,?,?,?,?,?)",
      )
      .bind(id, issueId, actor, body, now, now),
    activity(db, actor, "comment.created", issueId, id, now),
  ]);
  return id;
}
export async function changeComment(
  db: D1Database,
  issue: { id: string; identifier: string },
  id: string,
  actor: string,
  body: string | null,
) {
  db = mutationDatabase(db, actor);
  const now = new Date().toISOString();
  const row = await db
    .prepare(
      "SELECT id FROM issue_comments WHERE id=? AND issue_id=? AND deleted_at IS NULL",
    )
    .bind(id, issue.id)
    .first();
  if (!row) return false;
  const mutation =
    body === null
      ? db
          .prepare(
            "UPDATE issue_comments SET body=NULL,deleted_at=?,updated_at=? WHERE id=? AND issue_id=? AND deleted_at IS NULL",
          )
          .bind(now, now, id, issue.id)
      : db
          .prepare(
            "UPDATE issue_comments SET body=?,edited_at=?,updated_at=? WHERE id=? AND issue_id=? AND deleted_at IS NULL",
          )
          .bind(body, now, now, id, issue.id);
  await db.batch([
    db
      .prepare(
        `INSERT INTO issue_activity(id,issue_id,actor_operator_id,kind,next_value_json,created_at,updated_at) SELECT ?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM issue_comments WHERE id=? AND issue_id=? AND deleted_at IS NULL)`,
      )
      .bind(
        createUlid(new Date()),
        issue.id,
        actor,
        body === null ? "comment.deleted" : "comment.edited",
        JSON.stringify({ id }),
        now,
        now,
        id,
        issue.id,
      ),
    db
      .prepare(
        `INSERT INTO audit_records(id,actor_operator_id,action,subject_identifier,subject_id,created_at,updated_at) SELECT ?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM issue_comments WHERE id=? AND issue_id=? AND deleted_at IS NULL)`,
      )
      .bind(
        createUlid(new Date()),
        actor,
        body === null ? "comment.deleted" : "comment.edited",
        issue.identifier,
        id,
        now,
        now,
        id,
        issue.id,
      ),
    ...(body === null
      ? commentLinkErasureStatements(db, issue, id, actor, now)
      : []),
    mutation,
  ]);
  return true;
}
export async function addFile(
  db: D1Database,
  issue: { id: string; identifier: string },
  actor: string,
  file: {
    id: string;
    name: string;
    contentType: string;
    bytes: number;
    key: string;
    sha256: string;
  },
) {
  db = mutationDatabase(db, actor);
  const now = new Date().toISOString();
  const result = await db
    .prepare(
      `INSERT INTO issue_files(id,issue_id,actor_operator_id,name,content_type,bytes,blob_key,state,writer_settled,content_sha256,created_at,updated_at)
 SELECT ?,?,?,?,?,?,?,'pending',0,?,?,? WHERE COALESCE((SELECT SUM(bytes) FROM issue_files WHERE removal_confirmed_at IS NULL),0)+?<=10737418240`,
    )
    .bind(
      file.id,
      issue.id,
      actor,
      file.name,
      file.contentType,
      file.bytes,
      file.key,
      file.sha256,
      now,
      now,
      file.bytes,
    )
    .run();
  return result.meta.changes === 1;
}
export async function finalizeFile(
  db: D1Database,
  issueId: string,
  id: string,
  actor: string,
) {
  const now = new Date().toISOString();
  const result = await db.batch([
    db
      .prepare(
        `INSERT INTO issue_activity(id,issue_id,actor_operator_id,kind,next_value_json,created_at,updated_at) SELECT ?,?,?,'file.created',?,?,? WHERE EXISTS(SELECT 1 FROM issue_files WHERE id=? AND state='pending' AND deleted_at IS NULL AND removal_requested_at IS NULL)`,
      )
      .bind(
        createUlid(new Date()),
        issueId,
        actor,
        JSON.stringify({ id }),
        now,
        now,
        id,
      ),
    db
      .prepare(
        "UPDATE issue_files SET state='ready',writer_settled=1,updated_at=? WHERE id=? AND state='pending' AND deleted_at IS NULL AND removal_requested_at IS NULL",
      )
      .bind(now, id),
    db.prepare("UPDATE issue_files SET writer_settled=1 WHERE id=?").bind(id),
  ]);
  return result[1].meta.changes === 1;
}
export async function failFile(
  db: D1Database,
  id: string,
  writerSettled = false,
) {
  await db
    .prepare(
      "UPDATE issue_files SET state='failed',writer_settled=?,updated_at=? WHERE id=? AND state='pending' AND deleted_at IS NULL",
    )
    .bind(writerSettled ? 1 : 0, new Date().toISOString(), id)
    .run();
}
export async function findFile(db: D1Database, issueId: string, id: string) {
  return db
    .prepare(
      "SELECT id,name,content_type,bytes,blob_key,state,deleted_at,removal_requested_at FROM issue_files WHERE id=? AND issue_id=? AND (deleted_at IS NULL OR (removal_requested_at IS NOT NULL AND removal_confirmed_at IS NULL))",
    )
    .bind(id, issueId)
    .first<{
      id: string;
      name: string;
      content_type: string;
      bytes: number;
      blob_key: string;
      state: string;
      deleted_at: string | null;
      removal_requested_at: string | null;
    }>();
}
