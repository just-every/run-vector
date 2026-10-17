import { activityRow } from "../issues/repository";
import { assignmentStatements, blockerStatements, followerChangeStatements, finalizeEvent, mentionStatements } from "../notifications/events";
import type { IssueSnapshot, UndoAction } from "./schema";
import { issueColumns } from "./snapshot";

const same = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right);
type Column = keyof typeof issueColumns;

/** All activities capture the committed post-state first. Edges are removed
 * before restoring canonical statuses, then rebuilt after every issue update. */
export function planUndoReversal(db: D1Database, actor: string, action: UndoAction) {
  const at = new Date().toISOString();
  const capture: D1PreparedStatement[] = [], updates: D1PreparedStatement[] = [], finalize: D1PreparedStatement[] = [];
  for (const [index, original] of action.before.entries()) {
    const current = action.after[index];
    const fields = (Object.keys(issueColumns) as Column[]).filter((key) => key in original && !same(original[key], current[key]));
    const previous: Record<string, unknown> = {}, next: Record<string, unknown> = {};
    for (const key of fields) { previous[key] = current[key]; next[key] = original[key]; }
    if (!same(original.labelIds, current.labelIds)) { previous.labelIds = current.labelIds; next.labelIds = original.labelIds; }
    if (action.kind === "duplicate") {
      previous.canonicalIdentifier = current.canonicalIdentifier;
      next.canonicalIdentifier = original.canonicalIdentifier;
      if (!same(original.deferralOrigin, current.deferralOrigin)) {
        previous.deferralOrigin = current.deferralOrigin; next.deferralOrigin = original.deferralOrigin;
      }
    }
    const activity = activityRow({
      issueId: original.id, actorOperatorId: actor,
      kind: action.kind === "team" ? "issue.team_moved" : action.kind === "duplicate" ? "issue.duplicate_changed" : "issue.updated",
      previousValue: previous, nextValue: { ...next, undoOf: action.actionId }, now: at,
    });
    const event = { id: activity.id, issueId: original.id, actor, at };
    // ISSUE-018: the 0052 issue_description_activity trigger writes the new
    // immutable revision from this activity's changed nextValue.description,
    // attributed to this actor at current version + 1. Keep activity insertion
    // before the issue UPDATE, as native edits and checklist ticks do; a second
    // explicit revision INSERT would duplicate the trigger-owned activity ID.
    capture.push(db.prepare(`INSERT INTO issue_activity(id,issue_id,actor_operator_id,kind,previous_value_json,next_value_json,created_at,updated_at)
      VALUES(?,?,?,?,?,?,?,?)`).bind(activity.id, original.id, actor, activity.kind, activity.previousValueJson, activity.nextValueJson, at, at),
      ...blockerStatements(db, event), ...followerChangeStatements(db, event));
    if (fields.includes("assigneeOperatorId")) capture.push(...assignmentStatements(db, event, original.assigneeOperatorId ?? null));
    if (fields.includes("description")) capture.push(...mentionStatements(db, event, original.description ?? ""));
    if (!same(original.labelIds, current.labelIds)) {
      updates.push(db.prepare("DELETE FROM issue_labels WHERE issue_id=?").bind(original.id));
      for (const label of original.labelIds ?? []) updates.push(db.prepare("INSERT INTO issue_labels(issue_id,label_id,created_at) VALUES(?,?,?)").bind(original.id, label, at));
    }
    if (!same(original.deferralOrigin, current.deferralOrigin)) {
      updates.push(db.prepare("DELETE FROM issue_deferral_origins WHERE issue_id=?").bind(original.id));
      if (original.deferralOrigin) updates.push(db.prepare("INSERT INTO issue_deferral_origins(issue_id,decision_id) VALUES(?,?)").bind(original.id, original.deferralOrigin));
    }
    updates.push(db.prepare(`UPDATE issues SET ${[...fields.map((key) => issueColumns[key] + "=?"), "version=version+1", "updated_at=?"].join(",")} WHERE id=?`)
      .bind(...fields.map((key) => columnValue(original, key)), at, original.id));
    finalize.push(...finalizeEvent(db, event));
  }
  const relations: D1PreparedStatement[] = [];
  if (action.kind === "duplicate") {
    relations.push(db.prepare("DELETE FROM issue_duplicates WHERE issue_id IN(SELECT value FROM json_each(?))").bind(JSON.stringify(action.before.map((row) => row.id))));
    for (const original of action.before) if (original.canonicalId) finalize.unshift(
      db.prepare("INSERT INTO issue_duplicates(issue_id,canonical_issue_id,created_at) VALUES(?,?,?)")
        .bind(original.id, original.canonicalId, original.canonicalCreatedAt),
    );
  }
  return { writes: [...capture, ...relations, ...updates, ...finalize],
    result: { issues: action.after.map((row) => ({ identifier: row.identifier, version: row.version + 1 })), changed: action.after.length } };
}
function columnValue(row: IssueSnapshot, key: Column) {
  return key === "customFields" ? JSON.stringify(row[key]) : row[key] as string | number | null;
}
