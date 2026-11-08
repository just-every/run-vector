import { createUlid } from '../../shared/ids';
import { settingsActor, SettingsError } from '../settings/repository';

/** A retained suspension can be reopened; legacy anonymous removals cannot.
 * No credential table is changed here. Fresh sign-in is always required. */
export async function reactivateOperator(db: D1Database, actor: string, target: string, method: 'settings' | 'invitation' = 'settings') {
  const access = await settingsActor(db, actor);
  const member = await db.prepare('SELECT id,role,suspended_at FROM operators WHERE id=? AND workspace_id=?')
    .bind(target, access.workspace_id).first<{id:string;role:string;suspended_at:string|null}>();
  if (!member) throw new SettingsError('not_found', 'Member is unavailable.', 404);
  if (!(access.role === 'owner' || access.role === 'admin' && !['owner','admin'].includes(member.role)))
    throw new SettingsError('forbidden', 'Only an Owner can reactivate a former Owner or Admin.', 403);
  if (!member.suspended_at) throw new SettingsError('not_suspended', 'Only a suspended member can be reactivated. Legacy removals cannot be reactivated.', 409);
  const at = new Date().toISOString(), id = createUlid(new Date(at));
  const receipt = 'EXISTS(SELECT 1 FROM member_lifecycle_events WHERE id=?)';
  const [result] = await db.batch([
    db.prepare(`INSERT INTO member_lifecycle_events(id,operator_id,workspace_id,actor_operator_id,action,method,created_at)
      SELECT ?,target.id,target.workspace_id,actor.id,'reactivated',?,? FROM operators target JOIN operators actor ON actor.workspace_id=target.workspace_id
      WHERE target.id=? AND target.suspended_at=? AND target.removed_at IS NOT NULL AND target.role=?
      AND actor.id=? AND actor.removed_at IS NULL AND (actor.role='owner' OR actor.role='admin' AND target.role IN('member','guest','viewer'))`)
      .bind(id, method, at, target, member.suspended_at, member.role, actor),
    db.prepare(`UPDATE operators SET removed_at=NULL,suspended_at=NULL,suspended_by=NULL,updated_at=? WHERE id=? AND ${receipt}`).bind(at, target, id),
    db.prepare(`UPDATE oa_operators SET status='active' WHERE id IN(SELECT auth_id FROM vector_auth_operators WHERE operator_id=?) AND ${receipt}`).bind(target,id),
    db.prepare(`INSERT INTO audit_records(id,actor_operator_id,action,subject_identifier,subject_id,created_at,updated_at,workspace_id,actor_kind,actor_reference)
      SELECT ?,?,'operator.reactivated',?,?,?,?,?,'person',? WHERE ${receipt}`)
      .bind(id, actor, target, target, at, at, access.workspace_id, `person:${actor}`, id),
    db.prepare(`INSERT INTO administration_audit_details(audit_id,previous_value_json,next_value_json)
      SELECT ?,json_object('state','suspended'),json_object('state','active','method',?) WHERE ${receipt}`).bind(id, method, id),
  ]);
  if (result.meta.changes !== 1) throw new SettingsError('lifecycle_conflict', 'Member state or authority changed. Reload and try again.', 409);
  return { id: target, state: 'active' as const, signInRequired: true };
}
