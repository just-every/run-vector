import { isMutationAccessError, mutationDatabase } from "../auth/mutation-database";
import { IssueAccessError } from "../issues/access";
import { undoAdmission } from "./admission";
import { undoSessionHash } from "./context";
import { planUndoReversal } from "./reversal";
import { UndoError, undoActionSchema } from "./schema";

export async function undoIssueAction(source: D1Database, actor: string, actionId: string) {
  const db = mutationDatabase(source, actor), sessionHash = await undoSessionHash(db);
  if (!sessionHash) throw new IssueAccessError("unauthenticated", "A native operator session is required.", 401);
  const row = await db.prepare(`SELECT json_extract(a.next_value_json,'$.undo') action FROM issue_activity a
    JOIN operators actor ON actor.id=a.actor_operator_id AND actor.removed_at IS NULL
    WHERE a.id=? AND a.actor_operator_id=? AND json_extract(a.next_value_json,'$.undo.workspaceId')=actor.workspace_id
      AND json_extract(a.next_value_json,'$.undo.sessionHash')=?`)
    .bind(actionId, actor, sessionHash).first<{ action: string | null }>();
  const parsed = row?.action ? undoActionSchema.safeParse(JSON.parse(row.action)) : null;
  if (!row?.action || !parsed?.success || parsed.data.actionId !== actionId)
    throw new UndoError("undo_unavailable", "This action is no longer available to undo.", 409);
  const action = parsed.data;
  const admission = undoAdmission(db, actor, sessionHash, row.action, action);
  const inspect = async () => {
    const result = await admission.inspect();
    if (result.expired) throw new UndoError("undo_expired", "The 10-second Undo window has ended.", 410);
    if (result.denied) throw new UndoError("undo_conflict", "Nothing was changed. Review the reported conflicts.", 409, result.failures);
  };
  await inspect();
  const plan = planUndoReversal(db, actor, action);
  try {
    // Native session fence, latest action, SQL deadline, every post-version,
    // current graph and all restoration options precede every reversal write.
    await db.batch([admission.guard, ...plan.writes]);
  } catch (error) {
    if (isMutationAccessError(error)) throw error;
    await inspect();
    throw error;
  }
  return plan.result;
}
