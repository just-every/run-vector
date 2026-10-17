/** ISSUE-008 and the role matrix: only a comment's author edits it; its author
 * deletes it, and so do workspace Owners and Admins. Team owners (ROLE-007) do
 * not exist yet, so a Member never deletes another member's comment. */
export const moderatorSql = `EXISTS(SELECT 1 FROM vector_auth_operators m JOIN oa_operators a ON a.id=m.auth_id
 WHERE m.operator_id=? AND a.status='active' AND a.role IN ('owner','admin'))`;

export class CommentPermissionError extends Error {
  readonly code = "forbidden";
  readonly status = 403;
}

type CommentRow = {
  id: string;
  parentId: string | null;
  own: number;
  moderator: number;
  resolvedAt: string | null;
};

/** Read through the caller's fenced mutation database so a stale session is
 * refused before any permission answer is given. */
export async function liveComment(db: D1Database, issueId: string, id: string, actor: string) {
  return db
    .prepare(
      `SELECT c.id,c.parent_comment_id AS parentId,c.resolved_at AS resolvedAt,
 (c.actor_operator_id=? AND c.imported_author_name IS NULL) AS own,${moderatorSql} AS moderator
 FROM issue_comments c WHERE c.id=? AND c.issue_id=? AND c.deleted_at IS NULL`,
    )
    .bind(actor, actor, id, issueId)
    .first<CommentRow>();
}

export function requireCommentChange(row: CommentRow, action: "edit" | "delete") {
  if (row.own === 1) return;
  if (action === "delete" && row.moderator === 1) return;
  throw new CommentPermissionError(
    action === "edit"
      ? "Only the comment's author can edit it."
      : "Only the comment's author, an Owner or an Admin can delete it.",
  );
}
