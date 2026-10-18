import {
  mutationDatabase,
  isMutationAccessError,
} from "../auth/mutation-database";
import { requireIssueAccess } from "../issues/access";
import { createUlid } from "../../shared/ids";
import { versionAdmission } from "./reconcile";
export async function reorderSubissues(
  source: D1Database,
  identifier: string,
  actor: string,
  input: { expectedVersion: number; identifiers: string[] },
) {
  const db = mutationDatabase(source, actor),
    parent = await requireIssueAccess(db, identifier, actor);
  if (parent.version !== input.expectedVersion) return "stale" as const;
  const at = new Date().toISOString(),
    ids = JSON.stringify(input.identifiers),
    activityId = createUlid(new Date(at));
  try {
    await db.batch([
      versionAdmission(db, parent.id, input.expectedVersion),
      db
        .prepare(
          `SELECT CASE WHEN (SELECT count(*) FROM issue_parents WHERE parent_issue_id=?1)=json_array_length(?2) AND NOT EXISTS(SELECT 1 FROM issue_parents r JOIN issues c ON c.id=r.issue_id WHERE r.parent_issue_id=?1 AND c.identifier NOT IN(SELECT value FROM json_each(?2))) THEN 1 ELSE json('subissue membership changed') END`,
        )
        .bind(parent.id, ids),
      db
        .prepare(
          `INSERT INTO issue_activity(id,issue_id,actor_operator_id,kind,previous_value_json,next_value_json,created_at,updated_at)
        SELECT ?,?,?,'issue.subissues_reordered',json_object('identifiers',json((SELECT json_group_array(identifier) FROM (SELECT c.identifier FROM issue_parents r JOIN issues c ON c.id=r.issue_id WHERE r.parent_issue_id=? ORDER BY r.position,c.identifier,c.id)))),json_object('identifiers',json(?)),?,?`,
        )
        .bind(activityId, parent.id, actor, parent.id, ids, at, at),
      db
        .prepare(
          `UPDATE issue_parents SET position=(SELECT CAST(j.key AS INTEGER)+1 FROM json_each(?1) j JOIN issues c ON c.identifier=j.value WHERE c.id=issue_parents.issue_id) WHERE parent_issue_id=?2`,
        )
        .bind(ids, parent.id),
      db
        .prepare("UPDATE issues SET version=version+1,updated_at=? WHERE id=?")
        .bind(at, parent.id),
    ]);
  } catch (error) {
    if (isMutationAccessError(error)) throw error;
    await requireIssueAccess(db, identifier, actor);
    if (
      /subissue membership changed|subissue stale version|malformed JSON/.test(
        String(error),
      )
    )
      return "stale" as const;
    throw error;
  }
  return "written" as const;
}
