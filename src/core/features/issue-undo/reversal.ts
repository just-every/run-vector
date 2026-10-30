import { issueReferenceStatements } from "../issue-references/repository";
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
    if (action.kind === "parent") {
      previous.parentIdentifier = current.parentIdentifier;
      next.parentIdentifier = original.parentIdentifier;
    }
    const activity = activityRow({
      issueId: original.id, actorOperatorId: actor,
      kind: action.kind === "parent" ? "issue.parent_changed" : action.kind === "team" ? "issue.team_moved" : action.kind === "duplicate" ? "issue.duplicate_changed" : "issue.updated",
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
    if (fields.includes("description")) finalize.push(...issueReferenceStatements(db, event, original.description ?? ""));
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
  if (action.kind === "parent" && action.parents) {
    const original = action.before[0];
    relations.push(db.prepare("DELETE FROM issue_parents WHERE issue_id=?").bind(original.id));
    if (original.parentId) relations.push(db.prepare("INSERT INTO issue_parents(issue_id,parent_issue_id,created_at,position) VALUES(?,?,?,?)")
      .bind(original.id, original.parentId, original.parentCreatedAt, original.parentPosition));
    // Restore deepest parents first, then their ancestors. A status restore can
    // itself trigger progress automation, including on an ancestor whose saved
    // before/after values were equal. Inspect its live state inside the batch.
    // Do not reconcile again afterward: a saved manual status is authoritative.
    for (const id of action.parents.ids) {
      const before = action.parents.before.find(row => row.id === id)!;
      updates.push(...restoreParentProgress(db, actor, action.actionId, before, at));
    }
  }
  return { writes: [...capture, ...relations, ...updates, ...finalize],
    result: { issues: action.after.map((row) => ({ identifier: row.identifier, version: row.version + 1 })), changed: action.after.length } };
}
function restoreParentProgress(db: D1Database, actor: string, actionId: string, before: IssueSnapshot, at: string) {
  const fields = ["statusId", "cycleId", "completedAt", "canceledAt", "deferredUntil"] as const;
  const origin = "(SELECT decision_id FROM issue_deferral_origins WHERE issue_id=i.id)";
  const previous = `json_object(${fields.map(key => `'${key}',i.${issueColumns[key]}`).join(",")},'deferralOrigin',${origin})`;
  const next = { ...Object.fromEntries(fields.map(key => [key, before[key]])), deferralOrigin: before.deferralOrigin, undoOf: actionId };
  const activity = activityRow({ issueId: before.id, actorOperatorId: actor, kind: "issue.updated", previousValue: {}, nextValue: next, now: at });
  const event = { id: activity.id, issueId: before.id, actor, at };
  const recorded = "EXISTS(SELECT 1 FROM main.issue_activity WHERE id=?)";
  return [
    db.prepare(`INSERT INTO issue_activity(id,issue_id,actor_operator_id,kind,previous_value_json,next_value_json,created_at,updated_at)
      SELECT ?,i.id,?,'issue.updated',${previous},?,?,? FROM main.issues i WHERE i.id=? AND (
        ${fields.map(key => `i.${issueColumns[key]} IS NOT ?`).join(" OR ")} OR ${origin} IS NOT ?)`)
      .bind(activity.id, actor, activity.nextValueJson, at, at, before.id, ...fields.map(key => before[key]), before.deferralOrigin ?? null),
    ...blockerStatements(db, event), ...followerChangeStatements(db, event),
    db.prepare(`DELETE FROM issue_deferral_origins WHERE issue_id=? AND ${recorded}`).bind(before.id, activity.id),
    ...(before.deferralOrigin ? [db.prepare(`INSERT INTO issue_deferral_origins(issue_id,decision_id) SELECT ?,? WHERE ${recorded}`)
      .bind(before.id, before.deferralOrigin, activity.id)] : []),
    db.prepare(`UPDATE issues SET ${fields.map(key => issueColumns[key] + "=?").join(",")},version=version+1,updated_at=? WHERE id=? AND ${recorded}`)
      .bind(...fields.map(key => before[key]), at, before.id, activity.id),
    ...finalizeEvent(db, event),
  ];
}
function columnValue(row: IssueSnapshot, key: Column) {
  return key === "customFields" ? JSON.stringify(row[key]) : row[key] as string | number | null;
}
