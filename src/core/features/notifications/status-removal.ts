import { activeRecipient } from "./events";

/** A removal's activity IDs share one operation prefix. Select the affected
 * issues inside the transaction, including issues committed after planning. */
export function statusRemovalNotifications(db: D1Database, operationId: string) {
  const operation = "a.id>=? AND a.id<?";
  const activityRange = [operationId + ":", operationId + ";"];
  return {
    capture: [
      db.prepare(`INSERT OR IGNORE INTO notification_candidates
        (event_id,issue_id,recipient_id,kind,actor_id,actor_name,created_at)
        SELECT a.id,i.id,o.id,'status',a.actor_operator_id,actor.name,a.created_at
        FROM issue_activity a JOIN issues i ON i.id=a.issue_id
        JOIN teams t ON t.id=i.team_id
        JOIN workflow_statuses old ON old.id=json_extract(a.previous_value_json,'$.statusId')
        JOIN workflow_statuses next ON next.id=json_extract(a.next_value_json,'$.statusId')
        JOIN issue_followers f ON f.issue_id=i.id
        JOIN operators o ON o.id=f.operator_id AND o.workspace_id=t.workspace_id
        JOIN operators actor ON actor.id=a.actor_operator_id
        WHERE ${operation} AND old.category=next.category AND old.id<>next.id
          AND ${activeRecipient} AND o.id<>a.actor_operator_id
          AND NOT EXISTS(SELECT 1 FROM notification_events e WHERE e.event_id=a.id)`)
        .bind(...activityRange),
    ],
    finalize: [
      db.prepare(`INSERT OR IGNORE INTO notifications
        (id,event_id,issue_id,recipient_id,actor_id,actor_name,causes_json,created_at)
        SELECT lower(hex(randomblob(16))),c.event_id,c.issue_id,c.recipient_id,
          c.actor_id,c.actor_name,json_group_array(c.kind),c.created_at
        FROM notification_candidates c JOIN issue_activity a ON a.id=c.event_id
        JOIN issues i ON i.id=c.issue_id JOIN teams t ON t.id=i.team_id
        JOIN operators o ON o.id=c.recipient_id AND o.workspace_id=t.workspace_id
        WHERE ${operation} AND ${activeRecipient} AND o.id<>c.actor_id
          AND NOT EXISTS(SELECT 1 FROM notification_events e WHERE e.event_id=c.event_id)
          AND NOT EXISTS(SELECT 1 FROM issue_notification_mutes m
            WHERE m.issue_id=c.issue_id AND m.operator_id=c.recipient_id)
          AND NOT EXISTS(SELECT 1 FROM notification_type_mutes m
            WHERE m.kind=c.kind AND m.operator_id=c.recipient_id)
        GROUP BY c.event_id,c.issue_id,c.recipient_id`)
        .bind(...activityRange),
      db.prepare(`INSERT OR IGNORE INTO notification_events(event_id,created_at)
        SELECT a.id,a.created_at FROM issue_activity a WHERE ${operation}`)
        .bind(...activityRange),
      db.prepare(`DELETE FROM notification_candidates WHERE event_id IN
        (SELECT a.id FROM issue_activity a WHERE ${operation})`)
        .bind(...activityRange),
    ],
  };
}
