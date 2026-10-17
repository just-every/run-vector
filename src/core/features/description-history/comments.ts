import { mutationDatabase } from "../auth/mutation-database";
import { requireIssueAccess } from "../issues/access";
import { createUlid } from "../../shared/ids";
import { mentionStatements, finalizeEvent } from "../notifications/events";
import { DescriptionMutationError } from "./errors";
import { toggleTask } from "./tasks";
import type { CommentChecklistInput } from "./schema";

export async function tickCommentTask(db: D1Database, identifier: string, id: string, actor: string, input: CommentChecklistInput) {
  db = mutationDatabase(db, actor);
  const issue = await requireIssueAccess(db, identifier, actor);
  async function current() {
    const row = await db.prepare(`SELECT body,actor_operator_id,imported_author_name FROM issue_comments
      WHERE id=? AND issue_id=? AND deleted_at IS NULL`).bind(id, issue.id)
      .first<{ body: string; actor_operator_id: string; imported_author_name: string | null }>();
    if (!row) throw new DescriptionMutationError("not_found", 404, "Comment is unavailable.");
    if (row.actor_operator_id !== actor || row.imported_author_name !== null)
      throw new DescriptionMutationError("forbidden", 403, "Only the comment author can change its checklist.");
    return row;
  }
  const row = await current();
  const body = toggleTask(row.body, input.index, input.text, input.checked);
  if (row.body !== input.expectedBody || body === null)
    throw new DescriptionMutationError("stale_body", 409, "The comment changed. Reload before changing this item.");
  if (body === row.body) return;
  const now = new Date().toISOString(), activityId = createUlid(new Date(now));
  const event = { id: activityId, issueId: issue.id, actor, at: now };
  const where = `id=? AND issue_id=? AND actor_operator_id=? AND imported_author_name IS NULL AND deleted_at IS NULL AND body=?
    AND EXISTS(SELECT 1 FROM issues i JOIN teams t ON t.id=i.team_id JOIN operators o ON o.workspace_id=t.workspace_id WHERE i.id=issue_comments.issue_id AND o.id=? AND o.removed_at IS NULL)`;
  const params = [id, issue.id, actor, input.expectedBody, actor];
  const statements = [
    db.prepare(`INSERT INTO issue_activity(id,issue_id,actor_operator_id,kind,next_value_json,created_at,updated_at)
      SELECT ?,?,?,'comment.edited',?,?,? WHERE EXISTS(SELECT 1 FROM issue_comments WHERE ${where})`)
      .bind(activityId, issue.id, actor, JSON.stringify({ id, checklist: { index: input.index, text: input.text, checked: input.checked } }), now, now, ...params),
    db.prepare(`INSERT INTO audit_records(id,actor_operator_id,action,subject_identifier,subject_id,created_at,updated_at)
      SELECT ?,?,'comment.edited',?,?,?,? WHERE EXISTS(SELECT 1 FROM issue_activity WHERE id=?)`)
      .bind(createUlid(new Date(now)), actor, identifier, id, now, now, activityId),
    ...mentionStatements(db, event, body, id),
  ];
  const index = statements.length;
  const result = await db.batch<{ id: string }>([
    ...statements,
    db.prepare(`UPDATE issue_comments SET body=?,edited_at=?,updated_at=? WHERE ${where} RETURNING id`)
      .bind(body, now, now, ...params),
    ...finalizeEvent(db, event),
  ]);
  if (result[index].results[0]?.id === id) return;
  await requireIssueAccess(db, identifier, actor);
  await current();
  throw new DescriptionMutationError("stale_body", 409, "The comment changed. Reload before changing this item.");
}
