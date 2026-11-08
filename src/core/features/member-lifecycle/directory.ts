import { settingsActor, SettingsError } from '../settings/repository';
import { visibleTeam } from '../roles/visibility-sql';

async function directoryAuthority(db: D1Database, actor: string) {
  const access = await settingsActor(db, actor);
  if (!['owner','admin'].includes(access.role)) throw new SettingsError('forbidden', 'Only Owners and Admins can open suspended members.', 403);
  return access;
}
/** Suspended people are listed apart. Activities retain the same visibility
 * fences as the actor's ordinary issue reads, including private teams. */
export async function suspendedDirectory(db: D1Database, actor: string) {
  const access = await directoryAuthority(db, actor);
  const rows = await db.prepare(`SELECT id,name,email,role,suspended_at AS suspendedAt,suspended_by AS suspendedBy,
    (SELECT count(*) FROM issues i JOIN teams t ON t.id=i.team_id JOIN workflow_statuses s ON s.id=i.status_id
      WHERE i.assignee_operator_id=o.id AND s.category NOT IN('completed','canceled','duplicate') AND EXISTS(SELECT 1 FROM operators reader WHERE reader.id=? AND ${visibleTeam('reader', 't.id')})) AS assignedIssueCount
    FROM operators o WHERE workspace_id=? AND suspended_at IS NOT NULL ORDER BY name,id`)
    .bind(actor, access.workspace_id).all();
  await directoryAuthority(db, actor);
  return { members: rows.results };
}
export async function suspendedProfile(db: D1Database, actor: string, id: string) {
  const access = await directoryAuthority(db, actor);
  const member = await db.prepare(`SELECT id,name,email,role,suspended_at AS suspendedAt,suspended_by AS suspendedBy
    FROM operators WHERE id=? AND workspace_id=? AND suspended_at IS NOT NULL`).bind(id, access.workspace_id).first();
  if (!member) throw new SettingsError('not_found', 'Suspended member is unavailable.', 404);
  const [assigned, activity] = await db.batch([
    db.prepare(`SELECT i.identifier,i.title,s.category,'Assignee suspended' AS flag FROM issues i JOIN teams t ON t.id=i.team_id
      JOIN workflow_statuses s ON s.id=i.status_id WHERE i.assignee_operator_id=? AND s.category NOT IN('completed','canceled','duplicate') AND EXISTS(SELECT 1 FROM operators reader WHERE reader.id=? AND ${visibleTeam('reader','t.id')}) ORDER BY i.identifier`).bind(id,actor),
    db.prepare(`SELECT a.id,i.identifier,a.kind,a.created_at AS createdAt FROM issue_activity a JOIN issues i ON i.id=a.issue_id
      JOIN teams t ON t.id=i.team_id WHERE a.actor_operator_id=? AND EXISTS(SELECT 1 FROM operators reader WHERE reader.id=? AND ${visibleTeam('reader','t.id')}) ORDER BY a.created_at DESC,a.id DESC LIMIT 100`).bind(id,actor),
  ]);
  await directoryAuthority(db, actor);
  return { ...member, state: 'suspended', assignedIssues: assigned.results, activity: activity.results };
}
