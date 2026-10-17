import { commentStatements, mentionStatements, finalizeEvent } from '../notifications/events';
import { IssueAccessError, requireIssueAccess } from '../issues/access';
import { MutationAccessError, mutationDatabase } from "../auth/mutation-database";
import { createUlid } from "../../shared/ids";
import {
  commentLinkErasureStatements,
  namedLinksStatement,
} from "../links/repository";
import type { NamedLink } from '../links/schema';

async function requireDiscussionMutationAccess(db: D1Database, identifier: string, actor: string) {
  try {
    await requireIssueAccess(db, identifier, actor);
  } catch (error) {
    // A preflight removal and a transaction-fence denial share the same public
    // mutation contract. An active actor outside the workspace remains a 404.
    if (error instanceof IssueAccessError && error.code === "unauthenticated")
      throw new MutationAccessError();
    throw error;
  }
}

export async function findIssue(db: D1Database, identifier: string) {
  return db
    .prepare("SELECT id,identifier FROM issues WHERE identifier=?")
    .bind(identifier)
    .first<{ id: string; identifier: string }>();
}
export async function discussion(db: D1Database, issueId: string, actor?: string) {
  return discussionProjection(await Promise.all(discussionReadStatements(db, issueId, actor).map(statement => statement.all())));
}

export function discussionReadStatements(db: D1Database, issueId: string, actor?: string) {
  return [
    db
      .prepare(
        "SELECT c.id,c.body,c.edited_at AS editedAt,c.deleted_at AS deletedAt,c.created_at AS createdAt,COALESCE(c.imported_author_name,o.name) AS actor,c.imported_author_name IS NOT NULL AS imported,(c.actor_operator_id=? AND c.imported_author_name IS NULL AND c.deleted_at IS NULL) AS canEdit FROM issue_comments c JOIN operators o ON o.id=c.actor_operator_id WHERE c.issue_id=? ORDER BY c.created_at,c.id",
      )
      .bind(actor ?? null, issueId),
    db
      .prepare(
        "SELECT id,name,content_type AS contentType,bytes,state,removal_requested_at AS removalPending,cleanup_error AS cleanupError,created_at AS createdAt FROM issue_files WHERE issue_id=? AND (deleted_at IS NULL OR (removal_requested_at IS NOT NULL AND removal_confirmed_at IS NULL)) ORDER BY created_at,id",
      )
      .bind(issueId),
    namedLinksStatement(db, issueId),
  ] as const;
}

export function discussionProjection([comments, files, links]: readonly D1Result[]) {
  return {
    comments: comments.results as Record<string, unknown>[],
    files: files.results as Record<string, unknown>[],
    links: links.results as NamedLink[],
  };
}
function activity(
  db: D1Database,
  actor: string,
  kind: string,
  issueId: string,
  id: string,
  now: string,
  activityId = createUlid(new Date(now)),
) {
  return db
    .prepare(
      "INSERT INTO issue_activity(id,issue_id,actor_operator_id,kind,previous_value_json,next_value_json,created_at,updated_at) VALUES(?,?,?,?,NULL,?,?,?)",
    )
    .bind(
      activityId,
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
  const activityId = createUlid(new Date());
  const event = { id: activityId, issueId, actor, at: now };
  const issue = await db.prepare('SELECT identifier FROM issues WHERE id=?').bind(issueId).first<{identifier:string}>();
  if (!issue) throw new Error('Issue is unavailable.');
  await requireDiscussionMutationAccess(db,issue.identifier,actor);
  await db.batch([
    db.prepare(`SELECT CASE WHEN EXISTS(SELECT 1 FROM issues i JOIN teams t ON t.id=i.team_id JOIN operators o ON o.workspace_id=t.workspace_id WHERE i.id=? AND o.id=? AND o.removed_at IS NULL) THEN 1 ELSE json('discussion access denied') END`).bind(issueId,actor),
    db
      .prepare(
        "INSERT INTO issue_comments(id,issue_id,actor_operator_id,body,created_at,updated_at) VALUES(?,?,?,?,?,?)",
      )
      .bind(id, issueId, actor, body, now, now),
    activity(db, actor, "comment.created", issueId, id, now, activityId),
    ...commentStatements(db,event), ...mentionStatements(db,event,body,id), ...finalizeEvent(db,event),
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
  await requireDiscussionMutationAccess(db,issue.identifier,actor);
  const now = new Date().toISOString();
  const activityId = createUlid(new Date());
  const event = { id: activityId, issueId: issue.id, actor, at: now };
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
            "UPDATE issue_comments SET body=NULL,deleted_at=?,updated_at=? WHERE id=? AND issue_id=? AND deleted_at IS NULL RETURNING id",
          )
          .bind(now, now, id, issue.id)
      : db
          .prepare(
            "UPDATE issue_comments SET body=?,edited_at=?,updated_at=? WHERE id=? AND issue_id=? AND deleted_at IS NULL RETURNING id",
          )
          .bind(body, now, now, id, issue.id);
  const statements = [
    db.prepare(`SELECT CASE WHEN EXISTS(SELECT 1 FROM issues i JOIN teams t ON t.id=i.team_id JOIN operators o ON o.workspace_id=t.workspace_id WHERE i.id=? AND o.id=? AND o.removed_at IS NULL) THEN 1 ELSE json('discussion access denied') END`).bind(issue.id,actor),
    db
      .prepare(
        `INSERT INTO issue_activity(id,issue_id,actor_operator_id,kind,next_value_json,created_at,updated_at) SELECT ?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM issue_comments WHERE id=? AND issue_id=? AND deleted_at IS NULL)`,
      )
      .bind(
        activityId,
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
    ...mentionStatements(db,event,body,id),
  ];
  const mutationIndex = statements.length;
  const receipts = await db.batch<{ id: string }>([
    ...statements, mutation, ...finalizeEvent(db,event),
  ]);
  // Index triggers add writes to D1 meta.changes; only RETURNING identifies
  // whether this live comment survived the transaction guard.
  const rows = receipts[mutationIndex].results;
  return rows.length === 1 && rows[0].id === id;
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
  await requireDiscussionMutationAccess(db, issue.identifier, actor);
  const now = new Date().toISOString();
  const result = await db
    .prepare(
      `INSERT INTO issue_files(id,issue_id,actor_operator_id,name,content_type,bytes,blob_key,state,writer_settled,content_sha256,created_at,updated_at)
 SELECT ?,?,?,?,?,?,?,'pending',0,?,?,? WHERE EXISTS(SELECT 1 FROM issues i JOIN teams t ON t.id=i.team_id JOIN operators o ON o.workspace_id=t.workspace_id WHERE i.id=? AND o.id=? AND o.removed_at IS NULL) AND COALESCE((SELECT SUM(bytes) FROM issue_files WHERE removal_confirmed_at IS NULL),0)+COALESCE((SELECT SUM(bytes) FROM detached_file_removals WHERE removal_confirmed_at IS NULL),0)+?<=10737418240`,
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
      issue.id,
      actor,
      file.bytes,
    )
    .run();
  if (result.meta.changes !== 1)
    await requireDiscussionMutationAccess(db, issue.identifier, actor);
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
    db.prepare("UPDATE detached_file_removals SET writer_settled=1 WHERE id=? AND issue_id=?").bind(id, issueId),
  ]);
  return result[1].meta.changes === 1;
}
export async function failFile(
  db: D1Database,
  id: string,
  writerSettled = false,
) {
  await db.batch([db
    .prepare(
      "UPDATE issue_files SET state='failed',writer_settled=?,updated_at=? WHERE id=? AND state='pending' AND deleted_at IS NULL",
    )
    .bind(writerSettled ? 1 : 0, new Date().toISOString(), id),
    db.prepare("UPDATE detached_file_removals SET writer_settled=MAX(writer_settled,?),updated_at=? WHERE id=? AND removal_confirmed_at IS NULL").bind(writerSettled ? 1 : 0, new Date().toISOString(), id),
  ]);
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
