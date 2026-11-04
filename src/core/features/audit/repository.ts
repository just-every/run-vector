import { settingsActor, SettingsError } from '../settings/repository';
import { auditSchema, type AuditQuery } from './schema';

// Keep the recorded provenance intact, while both native-auth and product
// activity can be selected through the same person's filter option.
const actorFilterRef = "CASE WHEN a.actor_kind='person' AND m.operator_id IS NOT NULL THEN 'person:'||m.operator_id ELSE a.actor_reference END";

export async function auditAuthority(db: D1Database, actor: string) {
  const access = await settingsActor(db, actor);
  if (!['owner', 'admin'].includes(access.role))
    throw new SettingsError('forbidden', 'Only Owners and Admins can browse and export the audit log.', 403);
  return access.workspace_id;
}

/** Both the view and CSV run this exact query. No limit silently drops rows.
 * Personal names are resolved from current records, never retained snapshots. */
export async function readAudit(db: D1Database, actor: string, query: AuditQuery) {
  const workspace = await auditAuthority(db, actor);
  const through = query.through ?? await db.prepare('SELECT COALESCE(max(rowid),0) AS n FROM audit_records WHERE workspace_id=?').bind(workspace).first<number>('n') ?? 0;
  const where = ['a.workspace_id=?', 'a.rowid<=?'];
  const values: (string | number)[] = [workspace, through];
  for (const [value, clause] of [
    [query.kind, 'a.actor_kind=?'],
    [query.action, 'a.action=?'], [query.subject, 'a.subject_id=?'],
    [query.from && new Date(query.from).toISOString(), 'a.created_at>=?'],
    [query.to && new Date(query.to).toISOString(), 'a.created_at<=?'],
  ]) if (value) { where.push(clause!); values.push(value); }
  if (query.actor) {
    where.push(`(${actorFilterRef}=? OR a.actor_reference=?)`);
    values.push(query.actor, query.actor);
  }
  const rows = await db.prepare(`SELECT a.id,a.actor_reference AS actorRef,a.actor_kind AS actorKind,
    ${actorFilterRef} AS actorFilterRef,
    COALESCE(agentActivity.actor_name,CASE WHEN o.removed_at IS NULL THEN o.name END) AS actorName,a.action,a.subject_id AS subjectRef,
    CASE WHEN a.action LIKE 'operator.%' OR a.action='auth.signed_in' THEN
      CASE WHEN subjectPerson.removed_at IS NULL THEN COALESCE(subjectPerson.name,
        CASE WHEN subjectAuth.status IN ('active','invited') THEN subjectAuth.display_name END) END
      ELSE COALESCE(NULLIF(a.subject_identifier,a.subject_id),subjectCycle.name) END AS subjectName,
    a.created_at AS at
    FROM audit_records a LEFT JOIN vector_auth_operators m ON a.actor_reference='auth:'||m.auth_id
    LEFT JOIN issue_activity agentActivity ON a.id='agent:'||agentActivity.id
    LEFT JOIN operators o ON o.id=COALESCE(a.actor_operator_id,m.operator_id) AND o.workspace_id=a.workspace_id
    LEFT JOIN vector_auth_operators subjectMapping ON a.subject_id='auth:'||subjectMapping.auth_id
    LEFT JOIN operators subjectPerson ON subjectPerson.id=COALESCE(subjectMapping.operator_id,a.subject_id) AND subjectPerson.workspace_id=a.workspace_id
    LEFT JOIN oa_operators subjectAuth ON a.subject_id='auth:'||subjectAuth.id
    LEFT JOIN cycles subjectCycle ON subjectCycle.id=a.subject_id AND EXISTS(SELECT 1 FROM teams t WHERE t.id=subjectCycle.team_id AND t.workspace_id=a.workspace_id)
    WHERE ${where.join(' AND ')} ORDER BY a.created_at DESC,a.id DESC`).bind(...values).all();
  // Recheck current role before releasing any bytes after an asynchronous read.
  if (await auditAuthority(db, actor) !== workspace)
    throw new SettingsError('not_found', 'The audit log is unavailable.', 404);
  return auditSchema.parse({ entries: rows.results, through });
}
