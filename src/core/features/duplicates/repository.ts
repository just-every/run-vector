import {
  mutationDatabase,
  isMutationAccessError,
} from "../auth/mutation-database";
import { requireIssueAccess } from "../issues/access";
import { IssueMutationError } from "../issues/errors";
import { createUlid } from "../../shared/ids";
import {
  blockerStatements,
  followerChangeStatements,
  duplicateFollowerStatements,
  finalizeEvent,
} from "../notifications/events";
import { defaultDuplicateStatus, duplicateRestoreStatus } from "./status";

export type DuplicateRelationRow = { identifier: string; title: string; relation: string };

export function duplicateRelationsStatement(db: D1Database, id: string) {
  return db
      .prepare(
        `SELECT i.identifier,i.title,CASE WHEN d.issue_id=?1 THEN 'canonical' ELSE 'duplicate' END relation
 FROM issue_duplicates d JOIN issues i ON i.id=CASE WHEN d.issue_id=?1 THEN d.canonical_issue_id ELSE d.issue_id END
 WHERE d.issue_id=?1 OR d.canonical_issue_id=?1 ORDER BY i.identifier`,
      )
      .bind(id);
}

export function duplicateRelationsProjection(rows: DuplicateRelationRow[]) {
  return {
    canonical: rows.find((r) => r.relation === "canonical") ?? null,
    duplicates: rows.filter((r) => r.relation === "duplicate"),
  };
}
const invalid = () =>
  new IssueMutationError(
    "invalid_transition",
    "Choose a different canonical issue that is not already a duplicate.",
  );
export async function decideDuplicate(
  source: D1Database,
  identifier: string,
  actor: string,
  input: { expectedVersion: number; canonicalIdentifier: string | null },
) {
  const db = mutationDatabase(source, actor),
    issue = await requireIssueAccess(db, identifier, actor);
  if (issue.version !== input.expectedVersion) return "stale" as const;
  const target = input.canonicalIdentifier
    ? await requireIssueAccess(db, input.canonicalIdentifier, actor)
    : null;
  if (target?.id === issue.id) throw invalid();
  const existing = await db
    .prepare("SELECT canonical_issue_id FROM issue_duplicates WHERE issue_id=?")
    .bind(issue.id)
    .first<{ canonical_issue_id: string }>();
  if (!target && !existing)
    throw new IssueMutationError(
      "invalid_transition",
      "This issue is not a duplicate.",
    );
  if (
    target &&
    (await db
      .prepare(
        "SELECT 1 FROM issues i JOIN workflow_statuses s ON s.id=i.status_id WHERE i.id=? AND (s.category='duplicate' OR EXISTS(SELECT 1 FROM issue_duplicates WHERE issue_id=i.id))",
      )
      .bind(target.id)
      .first())
  )
    throw invalid();
  const at = new Date().toISOString(),
    id = createUlid(new Date(at));
  const status = target
    ? defaultDuplicateStatus
    : duplicateRestoreStatus;
  const writes = [
    db
      .prepare(
        `SELECT CASE WHEN EXISTS(SELECT 1 FROM issues i JOIN teams t ON t.id=i.team_id JOIN operators o ON o.workspace_id=t.workspace_id WHERE i.id=? AND i.version=? AND o.id=? AND o.removed_at IS NULL) THEN 1 ELSE json('duplicate admission denied') END`,
      )
      .bind(issue.id, input.expectedVersion, actor),
  ];
  if (target)
    writes.push(
      db
        .prepare(
          `SELECT CASE WHEN EXISTS(SELECT 1 FROM issues i JOIN teams t ON t.id=i.team_id JOIN operators o ON o.workspace_id=t.workspace_id JOIN workflow_statuses s ON s.id=i.status_id WHERE i.id=? AND o.id=? AND o.removed_at IS NULL AND s.category<>'duplicate') AND NOT EXISTS(SELECT 1 FROM issue_duplicates WHERE issue_id=?) THEN 1 ELSE json('duplicate target denied') END`,
        )
        .bind(target.id, actor, target.id),
    );
  writes.push(
    db
      .prepare(
        `INSERT INTO issue_activity(id,issue_id,actor_operator_id,kind,previous_value_json,next_value_json,created_at,updated_at)
 SELECT ?,i.id,?,'issue.duplicate_changed',json_object('canonicalIdentifier',(SELECT c.identifier FROM issue_duplicates d JOIN issues c ON c.id=d.canonical_issue_id WHERE d.issue_id=i.id),'statusId',i.status_id),json_object('canonicalIdentifier',?,'statusId',${status}),?,? FROM issues i WHERE i.id=?`,
      )
      .bind(id, actor, input.canonicalIdentifier, at, at, issue.id),
  );
  const event = { id, issueId: issue.id, actor, at };
  writes.push(...blockerStatements(db, event));
  writes.push(...followerChangeStatements(db, event));
  if (target) {
    writes.push(...duplicateFollowerStatements(db, event));
    writes.push(
      db
        .prepare(
          `INSERT INTO issue_activity(id,issue_id,actor_operator_id,kind,previous_value_json,next_value_json,created_at,updated_at)
  SELECT substr(?,1,10)||upper(hex(randomblob(8))),issue_id,?,'issue.duplicate_changed',json_object('canonicalIdentifier',?),json_object('canonicalIdentifier',?),?,? FROM issue_duplicates WHERE canonical_issue_id=?`,
        )
        .bind(
          id,
          actor,
          identifier,
          input.canonicalIdentifier,
          at,
          at,
          issue.id,
        ),
      db
        .prepare(
          "UPDATE issues SET version=version+1,updated_at=? WHERE id IN(SELECT issue_id FROM issue_duplicates WHERE canonical_issue_id=?)",
        )
        .bind(at, issue.id),
      db
        .prepare(
          "UPDATE issue_duplicates SET canonical_issue_id=? WHERE canonical_issue_id=?",
        )
        .bind(target.id, issue.id),
    );
  }
  writes.push(
    db
      .prepare(
        `UPDATE issues SET status_id=(SELECT json_extract(next_value_json,'$.statusId') FROM issue_activity WHERE id=?),version=version+1,completed_at=NULL,canceled_at=NULL,deferred_until=NULL,cycle_id=NULL,updated_at=? WHERE id=?`,
      )
      .bind(id, at, issue.id),
    db.prepare("DELETE FROM issue_duplicates WHERE issue_id=?").bind(issue.id),
    db
      .prepare("DELETE FROM issue_deferral_origins WHERE issue_id=?")
      .bind(issue.id),
  );
  if (target)
    writes.push(
      db
        .prepare(
          "INSERT INTO issue_duplicates(issue_id,canonical_issue_id,created_at) VALUES(?,?,?)",
        )
        .bind(issue.id, target.id, at),
    );
  writes.push(...finalizeEvent(db, event));
  try {
    await db.batch(writes);
  } catch (error) {
    if (isMutationAccessError(error)) throw error;
    const current = await requireIssueAccess(db, identifier, actor);
    if (current.version !== input.expectedVersion) return "stale" as const;
    if (target) {
      await requireIssueAccess(db, input.canonicalIdentifier!, actor);
      if (
        await db
          .prepare("SELECT 1 FROM issue_duplicates WHERE issue_id=?")
          .bind(target.id)
          .first()
      )
        throw invalid();
    }
    throw error;
  }
  return "written" as const;
}
