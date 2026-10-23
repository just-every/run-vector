import { MutationAccessError, mutationDatabase } from "../auth/mutation-database";
import { IssueAccessError, requireIssueAccess } from "../issues/access";
import type { ReactionInput, ReactionProjection } from "./schema";

export class ReactionError extends Error {
  constructor(
    readonly code: "forbidden" | "not_found",
    message: string,
    readonly status: 403 | 404,
  ) { super(message); }
}

const memberRole = "o.role IN ('owner','admin','member')";
const liveSubject = `(?='description' OR EXISTS(
  SELECT 1 FROM issue_comments c WHERE c.id=? AND c.issue_id=i.id AND c.deleted_at IS NULL))`;

/** Read names from current operators, including their anonymized tombstones. */
export async function readReactions(
  db: D1Database,
  issueId: string,
  actor: string,
): Promise<ReactionProjection> {
  const [permission, records] = await db.batch([
    db.prepare(`SELECT ${memberRole} AS canReact FROM operators o
      JOIN issues i ON i.id=? JOIN teams t ON t.id=i.team_id AND t.workspace_id=o.workspace_id
      WHERE o.id=? AND o.removed_at IS NULL`).bind(issueId, actor),
    db.prepare(`SELECT r.subject_id AS subjectId,r.emoji,o.id,o.name
      FROM issue_reactions r JOIN issues i ON i.id=r.issue_id
      JOIN operators o ON o.id=r.operator_id
      WHERE i.id=? AND (r.subject_id='description' OR EXISTS(
        SELECT 1 FROM issue_comments c WHERE c.id=r.subject_id AND c.issue_id=i.id AND c.deleted_at IS NULL))
      ORDER BY r.subject_id,r.emoji,o.name,o.id`).bind(issueId),
  ]);
  const reactions: ReactionProjection["reactions"] = [];
  for (const row of records.results as { subjectId: string; emoji: string; id: string; name: string }[]) {
    let reaction = reactions.at(-1);
    if (!reaction || reaction.subjectId !== row.subjectId || reaction.emoji !== row.emoji) {
      reaction = { subjectId: row.subjectId, emoji: row.emoji, count: 0, reacted: false, people: [] };
      reactions.push(reaction);
    }
    reaction.count++;
    reaction.reacted ||= row.id === actor;
    reaction.people.push({ id: row.id, name: row.name });
  }
  const allowed = permission.results[0] as { canReact: number } | undefined;
  return { canReact: Boolean(allowed?.canReact), reactions };
}

async function requireReactionMutation(
  db: D1Database,
  identifier: string,
  actor: string,
  subjectId: string,
) {
  let issue;
  try {
    issue = await requireIssueAccess(db, identifier, actor);
  } catch (error) {
    if (error instanceof IssueAccessError && error.code === "unauthenticated")
      throw new MutationAccessError();
    throw error;
  }
  const member = await db.prepare(`SELECT ${memberRole} AS allowed FROM operators o WHERE o.id=? AND o.removed_at IS NULL`)
    .bind(actor).first<{ allowed: number }>();
  if (!member) throw new MutationAccessError();
  if (!member.allowed) throw new ReactionError("forbidden", "Only workspace members can react.", 403);
  if (subjectId !== "description" && !await db.prepare(
    "SELECT 1 FROM issue_comments WHERE id=? AND issue_id=? AND deleted_at IS NULL",
  ).bind(subjectId, issue.id).first())
    throw new ReactionError("not_found", "Reaction subject is unavailable.", 404);
  return issue;
}

/** Composite add/remove is idempotent and never creates an issue event. */
export async function changeReaction(
  source: D1Database,
  identifier: string,
  actor: string,
  input: ReactionInput,
  present: boolean,
) {
  const db = mutationDatabase(source, actor);
  const issue = await requireReactionMutation(db, identifier, actor, input.subjectId);
  const mutation = present
    ? db.prepare(`INSERT INTO issue_reactions(issue_id,subject_id,operator_id,emoji,created_at)
        VALUES(?,?,?,?,?) ON CONFLICT(issue_id,subject_id,operator_id,emoji) DO NOTHING`)
        .bind(issue.id, input.subjectId, actor, input.emoji, new Date().toISOString())
    : db.prepare("DELETE FROM issue_reactions WHERE issue_id=? AND subject_id=? AND operator_id=? AND emoji=?")
        .bind(issue.id, input.subjectId, actor, input.emoji);
  try {
    await db.batch([
      // Shared transaction admission also fences deletion of a comment after
      // preflight, so neither a missing nor foreign subject can acquire a row.
      db.prepare(`SELECT CASE WHEN EXISTS(
        SELECT 1 FROM issues i JOIN teams t ON t.id=i.team_id
        JOIN operators o ON o.workspace_id=t.workspace_id
        WHERE i.id=? AND o.id=? AND o.removed_at IS NULL AND ${memberRole} AND ${liveSubject}
      ) THEN 1 ELSE json('reaction access denied') END`)
        .bind(issue.id, actor, input.subjectId, input.subjectId),
      mutation,
    ]);
  } catch (error) {
    // Translate only actual access/subject changes. Storage failures propagate.
    await requireReactionMutation(db, identifier, actor, input.subjectId);
    throw error;
  }
  return issue;
}
