import { activeRecipient } from '../notifications/events';
import { visibleTeam } from '../roles/visibility-sql';

/** The same project admission as the request projection, for each live lead.
 * A public contribution makes a mixed project visible without granting access
 * to its private issues. Empty projects are unavailable to Guests.
 */
export const visibleProject = (person: string, project: string) => `EXISTS(
  SELECT 1 FROM main.projects visible_project WHERE visible_project.id=${project}
  AND visible_project.workspace_id=${person}.workspace_id AND (
    EXISTS(SELECT 1 FROM main.issues project_issue WHERE project_issue.project_id=visible_project.id
      AND ${visibleTeam(person,'project_issue.team_id')})
    OR (${person}.role<>'guest' AND NOT EXISTS(SELECT 1 FROM main.issues project_issue WHERE project_issue.project_id=visible_project.id))))`;

/** Inbox-only native subjects; never manufacture an issue to carry an event.
 * The activity receipt and both current lead selections are in the graph batch.
 * DISTINCT and the event recipient key coalesce a person leading both ends.
 */
export function projectDependencyNotices(db: D1Database, event: string, blocked: string, blocking: string, actor: string, at: string) {
  return db.prepare(`INSERT INTO project_notifications(id,event_id,project_id,related_project_id,recipient_id,actor_id,actor_name,created_at)
    SELECT lower(hex(randomblob(16))),?,a.id,b.id,o.id,?,(SELECT name FROM operators WHERE id=?),?
    FROM projects a JOIN projects b ON b.workspace_id=a.workspace_id
    JOIN operators o ON o.workspace_id=a.workspace_id AND o.id IN(a.lead_operator_id,b.lead_operator_id)
    WHERE a.id=? AND b.id=? AND o.id<>? AND ${activeRecipient}
      AND ${visibleProject('o','a.id')} AND ${visibleProject('o','b.id')}
      AND NOT EXISTS(SELECT 1 FROM notification_type_mutes m WHERE m.operator_id=o.id AND m.kind='blocking')`)
    .bind(event,actor,actor,at,blocked,blocking,actor);
}
