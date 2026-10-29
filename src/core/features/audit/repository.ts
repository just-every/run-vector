import { settingsActor, SettingsError } from '../settings/repository';
import { auditSchema, type AuditQuery } from './schema';
import { attributionJsonSql, projectAttribution } from '../agent-door/attribution-projection';

export async function auditAuthority(db: D1Database, actor: string) {
  const access = await settingsActor(db, actor);
  if (!['owner', 'admin'].includes(access.role))
    throw new SettingsError('forbidden', 'Only Owners and Admins can browse and export the audit log.', 403);
  return access.workspace_id;
}

/** Both the view and CSV run this exact query. No limit silently drops rows.
 * Human names resolve from current people; agent attribution is historical
 * until native erasure. Subjects always use opaque IDs. */
export async function readAudit(db: D1Database, actor: string, query: AuditQuery) {
  const workspace = await auditAuthority(db, actor);
  const through = query.through ?? await db.prepare('SELECT COALESCE(max(rowid),0) AS n FROM audit_records WHERE workspace_id=?').bind(workspace).first<number>('n') ?? 0;
  const where = ['a.workspace_id=?', 'a.rowid<=?'];
  const actorReference = "CASE WHEN attribution.audit_id IS NOT NULL THEN 'agent:'||attribution.agent_id ELSE a.actor_reference END";
  const actorKind = "CASE WHEN attribution.audit_id IS NOT NULL THEN 'agent' ELSE a.actor_kind END";
  const values: (string | number)[] = [workspace, through];
  for (const [value, clause] of [
    [query.actor, `${actorReference}=?`], [query.kind, `${actorKind}=?`],
    [query.action, 'a.action=?'], [query.subject, 'a.subject_id=?'],
    [query.from && new Date(query.from).toISOString(), 'a.created_at>=?'],
    [query.to && new Date(query.to).toISOString(), 'a.created_at<=?'],
  ]) if (value) { where.push(clause!); values.push(value); }
  const rows = await db.prepare(`SELECT a.id,${actorReference} AS actorRef,${actorKind} AS actorKind,
    COALESCE(attribution.prepared_by,CASE WHEN o.removed_at IS NULL THEN o.name END) AS actorName,a.action,a.subject_id AS subjectRef,a.created_at AS at,
    ${attributionJsonSql('attribution')} AS attributionJson
    FROM audit_records a LEFT JOIN vector_auth_operators m ON a.actor_reference='auth:'||m.auth_id
    LEFT JOIN operators o ON o.id=COALESCE(a.actor_operator_id,m.operator_id) AND o.workspace_id=a.workspace_id
    LEFT JOIN vector_agent_audit_attribution attribution ON attribution.audit_id=a.id
    WHERE ${where.join(' AND ')} ORDER BY a.created_at DESC,a.id DESC`).bind(...values).all<{attributionJson:string|null}>();
  // Recheck current role before releasing any bytes after an asynchronous read.
  if (await auditAuthority(db, actor) !== workspace)
    throw new SettingsError('not_found', 'The audit log is unavailable.', 404);
  return auditSchema.parse({ entries: rows.results.map(projectAttribution), through });
}
