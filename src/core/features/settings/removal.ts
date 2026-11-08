import { pendingOperatorFiles } from "./removal-files";
import { assertRemovalAllowed, removalId, SettingsError } from "./repository";

/** Eligibility, revocation, transfer, suspension and activity share one D1 transaction. */
export async function removeOperator(
  db: D1Database,
  actor: string,
  target: string,
  now = new Date(),
  assignments: "keep" | "unassign" = "unassign",
) {
  const access = await assertRemovalAllowed(db, actor, target);
  const id = removalId(),
    at = now.toISOString();
  const receipt = "EXISTS(SELECT 1 FROM member_lifecycle_events WHERE id=?)";
  const successor =
    "(SELECT successor_operator_id FROM member_lifecycle_events WHERE id=?)";
  const retainedActor = actor;
  const statements: D1PreparedStatement[] = [
    db
      .prepare(
        `INSERT INTO member_lifecycle_events(id,operator_id,workspace_id,actor_operator_id,successor_operator_id,action,method,assignments,created_at)
      SELECT ?,target.id,target.workspace_id,?,
        CASE WHEN target.id<>actor.id THEN actor.id ELSE
          (SELECT id FROM operators WHERE workspace_id=target.workspace_id AND id<>target.id AND removed_at IS NULL AND role='owner' ORDER BY created_at,id LIMIT 1) END,?,?,?,?
      FROM operators target JOIN operators actor ON actor.workspace_id=target.workspace_id
      JOIN workspace_installation w ON w.workspace_id=target.workspace_id
      WHERE target.id=? AND actor.id=? AND target.removed_at IS NULL AND actor.removed_at IS NULL
        AND (actor.id=target.id OR actor.role='owner' OR actor.role='admin' AND target.role IN('member','guest','viewer'))
        AND NOT ${pendingOperatorFiles}
        AND w.setup_operator_id IS NOT NULL AND (w.setup_operator_id<>target.id OR actor.id=target.id)
        AND EXISTS(SELECT 1 FROM operators WHERE workspace_id=target.workspace_id AND id<>target.id AND removed_at IS NULL)
`,
      )
      .bind(id, retainedActor, actor === target ? "left" : "suspended", actor === target ? "self" : "settings", assignments, at, target, actor),
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
      SELECT substr(?,1,10)||upper(hex(randomblob(8))),i.id,?,'issue.operator_removed',json_object('assigneeOperatorId',?),json_object('assigneeOperatorId',NULL),?,?
      FROM issues i JOIN workflow_statuses s ON s.id=i.status_id
      WHERE i.assignee_operator_id=? AND s.category NOT IN ('completed','canceled','duplicate') AND ?='unassign' AND ${receipt}`,
      )
      .bind(id, retainedActor, target, at, at, target, assignments, id),
    db
      .prepare(
        `UPDATE issues SET assignee_operator_id=NULL,version=version+1,updated_at=?
      WHERE assignee_operator_id=? AND status_id IN(SELECT id FROM workflow_statuses WHERE category NOT IN ('completed','canceled','duplicate')) AND ?='unassign' AND ${receipt}`,
      )
      .bind(at, target, assignments, id),
    db
      .prepare(
        `INSERT INTO project_activity(id,project_id,actor_operator_id,kind,previous_value_json,next_value_json,created_at,updated_at)
      SELECT substr(?,1,10)||upper(hex(randomblob(8))),id,?,'project.lead_transferred',json_object('leadOperatorId',?),json_object('leadOperatorId',${successor}),?,?
      FROM projects WHERE lead_operator_id=? AND ${receipt}`,
      )
      .bind(id, retainedActor, target, id, at, at, target, id),
    db
      .prepare(
        `UPDATE projects SET lead_operator_id=${successor},updated_at=? WHERE lead_operator_id=? AND ${receipt}`,
      )
      .bind(id, at, target, id),
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
  ];
  statements.push(db.prepare(`DELETE FROM team_join_requests WHERE requester_id=? AND ${receipt}`).bind(target,id));
  // Clear recipient custody and active subscriptions while retaining personal
  // settings, saved views, attribution and terminal delivery receipts.
  // Active-recipient predicates also fence future admission.
  for (const table of ["issue_reminders", "notifications", "document_notifications", "project_notifications", "notification_candidates", "notification_deliveries"]) {
    statements.push(db.prepare(`DELETE FROM ${table} WHERE recipient_id=? AND ${receipt}`).bind(target, id));
  }
  for (const table of ["document_followers", "subject_subscriptions"]) {
    statements.push(db.prepare(`DELETE FROM ${table} WHERE operator_id=? AND ${receipt}`).bind(target, id));
  }
  statements.push(
    db.prepare(`UPDATE operators SET removed_at=?,suspended_at=?,suspended_by=?,updated_at=? WHERE id=? AND ${receipt}`)
      .bind(at, at, actor, at, target, id),
    db.prepare(`INSERT INTO audit_records(id,actor_operator_id,action,subject_identifier,subject_id,created_at,updated_at,workspace_id,actor_kind,actor_reference)
      SELECT ?,?,?,?,?,?,?,?,'person',? WHERE ${receipt}`)
      .bind(id, actor, actor === target ? "operator.left" : "operator.suspended", target, target, at, at, access.workspace_id, `person:${actor}`, id),
    db.prepare(`INSERT INTO administration_audit_details(audit_id,previous_value_json,next_value_json)
      SELECT ?,json_object('state','active'),json_object('state','suspended','method',?,'assignments',?) WHERE ${receipt}`)
      .bind(id, actor === target ? "self" : "settings", assignments, id),
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
    state: "suspended" as const,
    signedOut: actor === target,
    workspaceId: access.workspace_id,
  };
}
