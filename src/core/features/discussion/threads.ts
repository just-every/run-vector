import { mutationDatabase } from "../auth/mutation-database";
import { requireIssueAccess } from "../issues/access";
import { createUlid } from "../../shared/ids";
import { finalizeEvent, threadReopenedStatements } from "../notifications/events";

/** A thread is a top-level comment and its ordered replies (ISSUE-008). */
export class ThreadError extends Error {
  readonly code = "not_found";
  readonly status = 404;
}

/** Replies attach only to a top-level comment of the same issue. A deleted
 * root keeps its thread, so its tombstone can still be replied to. */
export async function threadRoot(db: D1Database, issueId: string, parentId: string) {
  const root = await db
    .prepare("SELECT id FROM issue_comments WHERE id=? AND issue_id=? AND parent_comment_id IS NULL")
    .bind(parentId, issueId)
    .first<{ id: string }>();
  if (!root) throw new ThreadError("The thread is unavailable.");
  return root.id;
}

function threadActivity(db: D1Database, issueId: string, root: string, actor: string, kind: string, now: string, when: string, id = createUlid(new Date(now))) {
  return db
    .prepare(
      `INSERT INTO issue_activity(id,issue_id,actor_operator_id,kind,next_value_json,created_at,updated_at)
 SELECT ?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM issue_comments WHERE id=? AND issue_id=? AND ${when})`,
    )
    .bind(id, issueId, actor, kind, JSON.stringify({ id: root }), now, now, root, issueId);
}

export function reopenStatements(db: D1Database, issueId: string, root: string, actor: string, now: string) {
  const event = { id: createUlid(new Date(now)), issueId, actor, at: now };
  return [
    threadActivity(db, issueId, root, actor, "thread.reopened", now, "resolved_at IS NOT NULL", event.id),
    ...threadReopenedStatements(db, event, root),
    db
      .prepare("UPDATE issue_comments SET resolved_at=NULL,resolved_by_operator_id=NULL,updated_at=? WHERE id=? AND issue_id=? AND resolved_at IS NOT NULL")
      .bind(now, root, issueId),
    ...finalizeEvent(db, event),
  ];
}

/** Any operator who can comment resolves or reopens any thread. Repeating the
 * current state is a no-op without a second activity entry. */
export async function changeResolution(
  source: D1Database,
  issue: { id: string; identifier: string },
  root: string,
  actor: string,
  resolved: boolean,
) {
  const db = mutationDatabase(source, actor);
  await requireIssueAccess(db, issue.identifier, actor);
  await threadRoot(db, issue.id, root);
  const now = new Date().toISOString();
  const guard = db
    .prepare(`SELECT CASE WHEN EXISTS(SELECT 1 FROM issues i JOIN teams t ON t.id=i.team_id JOIN operators o ON o.workspace_id=t.workspace_id WHERE i.id=? AND o.id=? AND o.removed_at IS NULL) THEN 1 ELSE json('discussion access denied') END`)
    .bind(issue.id, actor);
  await db.batch(
    resolved
      ? [
          guard,
          threadActivity(db, issue.id, root, actor, "thread.resolved", now, "resolved_at IS NULL"),
          db
            .prepare("UPDATE issue_comments SET resolved_at=?,resolved_by_operator_id=?,updated_at=? WHERE id=? AND issue_id=? AND resolved_at IS NULL")
            .bind(now, actor, now, root, issue.id),
        ]
      : [guard, ...reopenStatements(db, issue.id, root, actor, now)],
  );
}
