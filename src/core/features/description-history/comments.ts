import { issueReferenceStatements } from "../issue-references/repository";
import { isMutationAccessError, mutationDatabase, RestoreReservationError } from "../auth/mutation-database";
import { requireIssueAccess } from "../issues/access";
import { commentVersionSql } from "../discussion/revision";
import { createUlid } from "../../shared/ids";
import { mentionStatements, finalizeEvent } from "../notifications/events";
import { DescriptionMutationError } from "./errors";
import { mergeTask } from "./tasks";
import type { CommentChecklistInput } from "./schema";

export async function tickCommentTask(db: D1Database, identifier: string, id: string, actor: string, input: CommentChecklistInput) {
  db = mutationDatabase(db, actor);
  const issue = await requireIssueAccess(db, identifier, actor);
  async function current() {
    await requireIssueAccess(db, identifier, actor);
    const row = await db.prepare(`SELECT c.body,c.actor_operator_id,c.imported_author_name,${commentVersionSql} AS version
      FROM issue_comments c WHERE c.id=? AND c.issue_id=? AND c.deleted_at IS NULL`).bind(id, issue.id)
      .first<{ body: string; actor_operator_id: string; imported_author_name: string | null; version: number }>();
    if (!row) throw new DescriptionMutationError("not_found", 404, "Comment is unavailable.");
    if (row.actor_operator_id !== actor || row.imported_author_name !== null)
      throw new DescriptionMutationError("forbidden", 403, "Only the comment author can change its checklist.");
    return row;
  }
  const stale = (row: { body: string; version: number }) => new DescriptionMutationError(
    "stale_body", 409, "The checklist item changed. Read the current comment before trying again.", { id, body: row.body, version: row.version });
  // Recompute an independent click if another writer wins the transaction guard.
  // A changed target is still refused; retries never reuse a prepared body.
  let row = await current();
  for (let attempt = 0; attempt < 3; attempt++) {
    const body = mergeTask(row.body, input.expectedBody, input.index, input.text, input.checked);
    if (body === null || (input.expectedVersion !== undefined && input.expectedVersion > row.version)) throw stale(row);
    if (body === row.body) return;
    const now = new Date().toISOString(), activityId = createUlid(new Date(now));
    const event = { id: activityId, issueId: issue.id, actor, at: now };
    const where = `id=? AND issue_id=? AND actor_operator_id=? AND imported_author_name IS NULL AND deleted_at IS NULL AND body=?
      AND EXISTS(SELECT 1 FROM issues i JOIN teams t ON t.id=i.team_id JOIN operators o ON o.workspace_id=t.workspace_id WHERE i.id=issue_comments.issue_id AND o.id=? AND o.removed_at IS NULL)`;
    const params = [id, issue.id, actor, row.body, actor];
    const statements = [
      // The guard and all receipts commit together, or none of them do.
      db.prepare(`SELECT CASE WHEN EXISTS(SELECT 1 FROM issue_comments c WHERE c.id=? AND c.issue_id=?
        AND c.deleted_at IS NULL AND c.body=? AND ${commentVersionSql}=?) THEN 1 ELSE json('comment checklist revision mismatch') END`)
        .bind(id, issue.id, row.body, row.version),
      db.prepare(`INSERT INTO issue_activity(id,issue_id,actor_operator_id,kind,next_value_json,created_at,updated_at)
        SELECT ?,?,?,'comment.edited',?,?,? WHERE EXISTS(SELECT 1 FROM issue_comments WHERE ${where})`)
        .bind(activityId, issue.id, actor, JSON.stringify({ id, revision: row.version + 1, checklist: { index: input.index, text: input.text, checked: input.checked } }), now, now, ...params),
      db.prepare(`INSERT INTO audit_records(id,actor_operator_id,action,subject_identifier,subject_id,created_at,updated_at)
        SELECT ?,?,'comment.edited',?,?,?,? WHERE EXISTS(SELECT 1 FROM issue_activity WHERE id=?)`)
        .bind(createUlid(new Date(now)), actor, identifier, id, now, now, activityId),
      ...mentionStatements(db, event, body, id),
    ];
    const index = statements.length;
    try {
      const result = await db.batch<{ id: string }>([
        ...statements,
        db.prepare(`UPDATE issue_comments SET body=?,edited_at=?,updated_at=? WHERE ${where} RETURNING id`)
          .bind(body, now, now, ...params),
        ...issueReferenceStatements(db, event, body, { kind: "comment", id }),
        ...finalizeEvent(db, event),
      ]);
      if (result[index].results[0]?.id === id) return;
    } catch (error) {
      if (isMutationAccessError(error) || error instanceof RestoreReservationError) throw error;
      const latest = await current();
      if (latest.version === row.version && latest.body === row.body) throw error;
      row = latest;
      continue;
    }
    row = await current();
  }
  throw stale(row);
}
