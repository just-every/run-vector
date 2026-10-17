import { createUlid } from "../../shared/ids";
import {
  blockerStatements, duplicateFollowerStatements, followerChangeStatements, finalizeEvent,
} from "../notifications/events";
import type { DuplicateSelectionRow } from "./selection";
import { defaultDuplicateStatus, duplicateRestoreStatus } from "./status";

/** Keep capture, issue updates and edge updates in separate phases. A selected
 * source may itself be an incoming duplicate of another selected source. */
export function planSelectedDuplicate(
  db: D1Database,
  issue: DuplicateSelectionRow,
  actor: string,
  canonicalIdentifier: string | null,
  selectedIds: string[],
  at: string,
) {
  const id = createUlid(new Date(at));
  const event = { id, issueId: issue.id, actor, at };
  const status = canonicalIdentifier === null ? duplicateRestoreStatus : defaultDuplicateStatus;
  const capture = [
    db.prepare(`INSERT INTO issue_activity(id,issue_id,actor_operator_id,kind,previous_value_json,next_value_json,created_at,updated_at)
      SELECT ?,i.id,?,'issue.duplicate_changed',
        json_object('canonicalIdentifier',(SELECT c.identifier FROM issue_duplicates d JOIN issues c ON c.id=d.canonical_issue_id WHERE d.issue_id=i.id),'statusId',i.status_id),
        json_object('canonicalIdentifier',?,'statusId',${status}),?,? FROM issues i WHERE i.id=?`)
      .bind(id, actor, canonicalIdentifier, at, at, issue.id),
    ...blockerStatements(db, event),
    ...followerChangeStatements(db, event),
  ];
  const cascadeWrites: D1PreparedStatement[] = [];
  if (canonicalIdentifier !== null) {
    capture.push(...duplicateFollowerStatements(db, event, selectedIds));
    capture.push(db.prepare(`INSERT INTO issue_activity(id,issue_id,actor_operator_id,kind,previous_value_json,next_value_json,created_at,updated_at)
      SELECT substr(?,1,10)||upper(hex(randomblob(8))),d.issue_id,?,'issue.duplicate_changed',
        json_object('canonicalIdentifier',?),json_object('canonicalIdentifier',?),?,?
      FROM issue_duplicates d WHERE d.canonical_issue_id=? AND d.issue_id NOT IN(SELECT value FROM json_each(?))`)
      .bind(id, actor, issue.identifier, canonicalIdentifier, at, at, issue.id, JSON.stringify(selectedIds)));
    cascadeWrites.push(db.prepare(`UPDATE issues SET version=version+1,updated_at=? WHERE id IN(
      SELECT issue_id FROM issue_duplicates WHERE canonical_issue_id=? AND issue_id NOT IN(SELECT value FROM json_each(?)))`)
      .bind(at, issue.id, JSON.stringify(selectedIds)));
  }
  return {
    capture,
    cascadeWrites,
    sourceWrites: [
      db.prepare(`UPDATE issues SET status_id=(SELECT json_extract(next_value_json,'$.statusId') FROM issue_activity WHERE id=?),
        version=version+1,completed_at=NULL,canceled_at=NULL,deferred_until=NULL,cycle_id=NULL,updated_at=? WHERE id=?`)
        .bind(id, at, issue.id),
      db.prepare("DELETE FROM issue_deferral_origins WHERE issue_id=?").bind(issue.id),
    ],
    finalize: finalizeEvent(db, event),
  };
}
