import { notificationRemovalStatements } from '../notifications/removal';
import { anonymizeActivityStatements } from "./removal-history";
import { pendingOperatorFiles } from "./removal-files";
import { assertRemovalAllowed, removalId, SettingsError } from "./repository";

/** Eligibility, revocation, transfer, anonymisation and activity share one D1 transaction. */
export async function removeOperator(
  db: D1Database,
  actor: string,
  target: string,
  now = new Date(),
) {
  const access = await assertRemovalAllowed(db, actor, target);
  const id = removalId(),
    at = now.toISOString();
  const receipt = "EXISTS(SELECT 1 FROM operator_removals WHERE id=?)";
  const successor =
    "(SELECT successor_operator_id FROM operator_removals WHERE id=?)";
  const retainedActor = actor === target ? null : actor;
  const statements: D1PreparedStatement[] = [
    db
      .prepare(
        `INSERT INTO operator_removals(id,operator_id,workspace_id,actor_operator_id,successor_operator_id,created_at)
      SELECT ?,target.id,target.workspace_id,?,
        CASE WHEN target.id<>actor.id THEN actor.id ELSE
          (SELECT id FROM operators WHERE workspace_id=target.workspace_id AND id<>target.id AND removed_at IS NULL AND role='owner' ORDER BY created_at,id LIMIT 1) END,?
      FROM operators target JOIN operators actor ON actor.workspace_id=target.workspace_id
      JOIN workspace_installation w ON w.workspace_id=target.workspace_id
      WHERE target.id=? AND actor.id=? AND target.removed_at IS NULL AND actor.removed_at IS NULL
        AND NOT ${pendingOperatorFiles}
        AND w.setup_operator_id IS NOT NULL AND (w.setup_operator_id<>target.id OR actor.id=target.id)
        AND EXISTS(SELECT 1 FROM operators WHERE workspace_id=target.workspace_id AND id<>target.id AND removed_at IS NULL)
      ON CONFLICT(operator_id) DO NOTHING`,
      )
      .bind(id, retainedActor, at, target, actor),
    db
      .prepare(
        `UPDATE operator_sessions SET revoked_at=?,updated_at=? WHERE operator_id=? AND ${receipt}`,
      )
      .bind(at, at, target, id),
    db
      .prepare(`DELETE FROM magic_links WHERE operator_id=? AND ${receipt}`)
      .bind(target, id),
    db
      .prepare(
        `DELETE FROM rer_mail_development_outbox WHERE lower(json_extract(message,'$.to[0]'))=(SELECT lower(email) FROM operators WHERE id=?) AND ${receipt}`,
      )
      .bind(target, id),
    db
      .prepare(
        `INSERT INTO issue_activity(id,issue_id,actor_operator_id,kind,previous_value_json,next_value_json,created_at,updated_at)
      SELECT substr(?,1,10)||upper(hex(randomblob(8))),i.id,?,'issue.operator_removed',json_object('assigneeOperatorId',NULL),json_object('assigneeOperatorId',NULL),?,?
      FROM issues i JOIN workflow_statuses s ON s.id=i.status_id
      WHERE i.assignee_operator_id=? AND s.category NOT IN ('completed','canceled','duplicate') AND ${receipt}`,
      )
      .bind(id, retainedActor, at, at, target, id),
    db
      .prepare(
        `UPDATE issues SET assignee_operator_id=NULL,version=version+1,updated_at=?
      WHERE assignee_operator_id=? AND status_id IN(SELECT id FROM workflow_statuses WHERE category NOT IN ('completed','canceled','duplicate')) AND ${receipt}`,
      )
      .bind(at, target, id),
    db
      .prepare(
        `INSERT INTO project_activity(id,project_id,actor_operator_id,kind,previous_value_json,next_value_json,created_at,updated_at)
      SELECT substr(?,1,10)||upper(hex(randomblob(8))),id,?,'project.lead_transferred',json_object('leadOperatorId',NULL),json_object('leadOperatorId',${successor}),?,?
      FROM projects WHERE lead_operator_id=? AND ${receipt}`,
      )
      .bind(id, retainedActor, id, at, at, target, id),
    db
      .prepare(
        `UPDATE projects SET lead_operator_id=${successor},updated_at=? WHERE lead_operator_id=? AND ${receipt}`,
      )
      .bind(id, at, target, id),
    db
      .prepare(
        `DELETE FROM saved_views WHERE owner_operator_id=? AND is_shared=0 AND ${receipt}`,
      )
      .bind(target, id),
    // Resolve collisions against both owners, including earlier rows transferred in this batch.
    db
      .prepare(
        `UPDATE saved_views AS moving SET
      name=(WITH RECURSIVE names(candidate) AS (
        SELECT moving.name UNION ALL SELECT candidate||' (transferred)' FROM names
        WHERE EXISTS(SELECT 1 FROM saved_views other WHERE other.id<>moving.id
          AND other.owner_operator_id IN (?,${successor}) AND other.name=names.candidate)
      ) SELECT candidate FROM names WHERE NOT EXISTS(SELECT 1 FROM saved_views other
          WHERE other.id<>moving.id AND other.owner_operator_id IN (?,${successor}) AND other.name=names.candidate) LIMIT 1),
      owner_operator_id=${successor},updated_at=?
      WHERE owner_operator_id=? AND is_shared=1 AND ${receipt}`,
      )
      .bind(target, id, target, id, id, at, target, id),
    db
      .prepare(
        `DELETE FROM list_preferences WHERE operator_id=? AND ${receipt}`,
      )
      .bind(target, id),
    db.prepare(`DELETE FROM team_join_requests WHERE requester_id=? AND ${receipt}`).bind(target,id),
    db.prepare(`UPDATE team_join_requests SET decided_by=NULL WHERE decided_by=? AND ${receipt}`).bind(target,id),
    // ROLE-007: a team left without an owner is managed by Admins until one is named.
    db
      .prepare(`DELETE FROM team_members WHERE operator_id=? AND ${receipt}`)
      .bind(target, id),
    db
      .prepare(`DELETE FROM team_departures WHERE operator_id=? AND ${receipt}`)
      .bind(target, id),
    db
      .prepare(
        `UPDATE audit_records SET actor_operator_id=NULL WHERE actor_operator_id=? AND ${receipt}`,
      )
      .bind(target, id),
    db
      .prepare(
        `UPDATE operator_removals SET actor_operator_id=NULL WHERE actor_operator_id=? AND ${receipt}`,
      )
      .bind(target, id),
  ];
  statements.push(...anonymizeActivityStatements(db, target, id), ...notificationRemovalStatements(db,target,id));
  statements.push(
    // Non-null legacy comment/decision/file foreign keys retain an anonymous tombstone.
    db
      .prepare(
        `UPDATE operators SET name='Removed operator',email=id||'@removed.invalid',removed_at=?,updated_at=?
      WHERE id=? AND ${receipt}`,
      )
      .bind(at, at, target, id),
    db
      .prepare(
        `INSERT INTO audit_records(id,actor_operator_id,action,subject_identifier,subject_id,created_at,updated_at,workspace_id,actor_kind,actor_reference)
      SELECT ?,?,'operator.removed','Removed operator',?,?,?,?,'person',? WHERE ${receipt}`,
      )
      .bind(id, retainedActor, target, at, at, access.workspace_id, `person:${actor}`, id),
  );
  let result: D1Result[];
  try {
    result = await db.batch(statements);
  } catch (error) {
    // The database keeps the last Owner (0075); a concurrent change reaches it here.
    if (/last_owner/.test(String(error)))
      throw new SettingsError("last_owner", "The last Owner cannot be demoted or removed. Make another member an Owner first.", 409);
    throw error;
  }
  if (result[0].meta.changes !== 1) {
    await assertRemovalAllowed(db, actor, target);
    throw new SettingsError(
      "removal_conflict",
      "Operator state changed. Reload settings and try again.",
      409,
    );
  }
  return {
    removed: true,
    signedOut: actor === target,
    workspaceId: access.workspace_id,
  };
}
