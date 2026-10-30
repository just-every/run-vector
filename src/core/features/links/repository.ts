import { mutationDatabase } from "../auth/mutation-database";
import { createUlid } from "../../shared/ids";
import type { z } from "zod";
import type { createLinkSchema, NamedLink } from "./schema";

type Issue = { id: string; identifier: string };

export async function listNamedLinks(
  db: D1Database,
  issueId: string,
): Promise<NamedLink[]> {
  const result = await namedLinksStatement(db, issueId).all<NamedLink>();
  return result.results;
}

export function namedLinksStatement(db: D1Database, issueId: string) {
  return db
    .prepare(
      `SELECT l.id,l.name,l.url,l.comment_id AS commentId,o.name AS actor,l.created_at AS createdAt
    FROM issue_links l JOIN operators o ON o.id=l.actor_operator_id
    WHERE l.issue_id=? AND l.deleted_at IS NULL
      AND (l.comment_id IS NULL OR EXISTS(SELECT 1 FROM issue_comments c WHERE c.id=l.comment_id AND c.issue_id=l.issue_id AND c.deleted_at IS NULL))
    ORDER BY l.created_at,l.id`,
    )
    .bind(issueId);
}

/** Read only the current source URL needed for one explicitly loaded player. */
export function namedVideoSource(db: D1Database, issueId: string, id: string) {
  return db
    .prepare(
      `SELECT l.id,l.url FROM issue_links l
    WHERE l.issue_id=? AND l.id=? AND l.deleted_at IS NULL
      AND (l.comment_id IS NULL OR EXISTS(SELECT 1 FROM issue_comments c
        WHERE c.id=l.comment_id AND c.issue_id=l.issue_id AND c.deleted_at IS NULL))`,
    )
    .bind(issueId, id)
    .first<{ id: string; url: string }>();
}

export async function addNamedLink(
  db: D1Database,
  issue: Issue,
  actor: string,
  input: z.infer<typeof createLinkSchema>,
) {
  db = mutationDatabase(db, actor);
  const id = createUlid(new Date()),
    now = new Date().toISOString();
  // D1 batch is transactional. The comment predicate is evaluated inside the
  // same batch as insertion and its records, not in an earlier eligibility read.
  const result = await db.batch([
    db
      .prepare(
        `INSERT INTO issue_links(id,issue_id,comment_id,actor_operator_id,name,url,created_at,updated_at)
      SELECT ?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM issues WHERE id=?)
      AND (? IS NULL OR EXISTS(SELECT 1 FROM issue_comments WHERE id=? AND issue_id=? AND deleted_at IS NULL))`,
      )
      .bind(
        id,
        issue.id,
        input.commentId ?? null,
        actor,
        input.name,
        input.url,
        now,
        now,
        issue.id,
        input.commentId ?? null,
        input.commentId ?? null,
        issue.id,
      ),
    db
      .prepare(
        `INSERT INTO issue_activity(id,issue_id,actor_operator_id,kind,next_value_json,created_at,updated_at)
      SELECT ?,?,?,'link.created',?,?,? WHERE EXISTS(SELECT 1 FROM issue_links WHERE id=?)`,
      )
      .bind(
        createUlid(new Date()),
        issue.id,
        actor,
        JSON.stringify({ id, commentId: input.commentId ?? null }),
        now,
        now,
        id,
      ),
    db
      .prepare(
        `INSERT INTO audit_records(id,actor_operator_id,action,subject_identifier,subject_id,created_at,updated_at)
      SELECT ?,?,'link.created',?,?,?,? WHERE EXISTS(SELECT 1 FROM issue_links WHERE id=?)`,
      )
      .bind(createUlid(new Date()), actor, issue.identifier, id, now, now, id),
  ]);
  return result[0].meta.changes === 1 ? id : null;
}

export async function removeNamedLink(
  db: D1Database,
  issue: Issue,
  id: string,
  actor: string,
) {
  db = mutationDatabase(db, actor);
  const now = new Date().toISOString();
  const active = `EXISTS(SELECT 1 FROM issue_links l WHERE l.id=? AND l.issue_id=? AND l.deleted_at IS NULL
    AND (l.comment_id IS NULL OR EXISTS(SELECT 1 FROM issue_comments c WHERE c.id=l.comment_id AND c.issue_id=l.issue_id AND c.deleted_at IS NULL)))`;
  const result = await db.batch([
    db
      .prepare(
        `INSERT INTO issue_activity(id,issue_id,actor_operator_id,kind,next_value_json,created_at,updated_at)
      SELECT ?,?,?,'link.deleted',?,?,? WHERE ${active}`,
      )
      .bind(
        createUlid(new Date()),
        issue.id,
        actor,
        JSON.stringify({ id }),
        now,
        now,
        id,
        issue.id,
      ),
    db
      .prepare(
        `INSERT INTO audit_records(id,actor_operator_id,action,subject_identifier,subject_id,created_at,updated_at)
      SELECT ?,?,'link.deleted',?,?,?,? WHERE ${active}`,
      )
      .bind(
        createUlid(new Date()),
        actor,
        issue.identifier,
        id,
        now,
        now,
        id,
        issue.id,
      ),
    db
      .prepare(
        `UPDATE issue_links SET name=NULL,url=NULL,deleted_at=?,updated_at=? WHERE id=? AND issue_id=? AND deleted_at IS NULL
      AND (comment_id IS NULL OR EXISTS(SELECT 1 FROM issue_comments c WHERE c.id=issue_links.comment_id AND c.issue_id=issue_links.issue_id AND c.deleted_at IS NULL))`,
      )
      .bind(now, now, id, issue.id),
  ]);
  return result[2].meta.changes === 1;
}

/** Append these before the comment tombstone UPDATE in that same D1 batch. */
export function commentLinkErasureStatements(
  db: D1Database,
  issue: Issue,
  commentId: string,
  actor: string,
  now: string,
): D1PreparedStatement[] {
  const active = `FROM issue_links l WHERE l.comment_id=? AND l.issue_id=? AND l.deleted_at IS NULL
    AND EXISTS(SELECT 1 FROM issue_comments c WHERE c.id=l.comment_id AND c.issue_id=l.issue_id AND c.deleted_at IS NULL)`;
  // One record per link needs distinct IDs. The fixed timestamp prefix and random
  // hexadecimal suffix are valid ULIDs, generated by SQLite inside the batch.
  const prefix = createUlid(new Date(now)).slice(0, 10);
  return [
    db
      .prepare(
        `INSERT INTO issue_activity(id,issue_id,actor_operator_id,kind,next_value_json,created_at,updated_at)
      SELECT ? || upper(hex(randomblob(8))),?,?,'link.deleted',json_object('id',l.id,'commentId',l.comment_id),?,? ${active}`,
      )
      .bind(prefix, issue.id, actor, now, now, commentId, issue.id),
    db
      .prepare(
        `INSERT INTO audit_records(id,actor_operator_id,action,subject_identifier,subject_id,created_at,updated_at)
      SELECT ? || upper(hex(randomblob(8))),?,'link.deleted',?,l.id,?,? ${active}`,
      )
      .bind(prefix, actor, issue.identifier, now, now, commentId, issue.id),
    db
      .prepare(
        `UPDATE issue_links SET name=NULL,url=NULL,deleted_at=?,updated_at=? WHERE comment_id=? AND issue_id=? AND deleted_at IS NULL
      AND EXISTS(SELECT 1 FROM issue_comments c WHERE c.id=issue_links.comment_id AND c.issue_id=issue_links.issue_id AND c.deleted_at IS NULL)`,
      )
      .bind(now, now, commentId, issue.id),
  ];
}
