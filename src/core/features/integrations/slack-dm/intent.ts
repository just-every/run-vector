import {visibleRecipient} from '../../notifications/events';
export const directDestination='slack-dm';
const restoreReleased="(NOT EXISTS(SELECT 1 FROM vector_restore_status) OR EXISTS(SELECT 1 FROM vector_restore_status WHERE effects_held=0))";
/** One intent per notification and linked recipient who routes one of its causes to Slack,
 * written in the source mutation's transaction under the same receipt guard as mail. */
export function directIntent(db:D1Database,eventId:string){
 return db.prepare(`INSERT OR IGNORE INTO vector_webhook_events(id,workspace_id,destination_id,event,body,created_at)
  SELECT n.id||':slack-dm',t.workspace_id,'${directDestination}','slack.dm',json_object('eventId',n.event_id,'notificationId',n.id,'recipientId',n.recipient_id,'actorId',n.actor_id,'issueId',i.id,'identifier',i.identifier),n.created_at
  FROM notifications n JOIN issues i ON i.id=n.issue_id JOIN teams t ON t.id=i.team_id JOIN operators o ON o.id=n.recipient_id AND o.workspace_id=t.workspace_id
  JOIN vector_slack_member_links l ON l.operator_id=o.id AND l.workspace_id=t.workspace_id
  JOIN vector_slack_installations s ON s.workspace_id=t.workspace_id AND s.enabled=1
  WHERE n.event_id=? AND NOT EXISTS(SELECT 1 FROM notification_events e WHERE e.event_id=n.event_id) AND ${visibleRecipient} AND ${restoreReleased}
  AND EXISTS(SELECT 1 FROM json_each(n.causes_json) cause WHERE cause.value IN(SELECT value FROM json_each(l.dm_kinds)))`).bind(eventId);
}
