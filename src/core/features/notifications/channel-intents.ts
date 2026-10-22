import type { WorkerBindings } from '../../app/bindings';
import { notificationEmailAvailable } from './context';

export function emailIntent(db: D1Database, predicate: string, values: unknown[], origin: string) {
  return db.prepare(`INSERT OR IGNORE INTO notification_deliveries
    (id,notification_id,recipient_id,actor_id,actor_name,identifier,title,app_link,status,email_mode,created_at,updated_at)
    SELECT n.id,n.id,n.recipient_id,n.actor_id,n.actor_name,i.identifier,i.title,?||'/app/issues/'||i.identifier,
      'pending',r.email_mode,n.created_at,n.created_at
    FROM notifications n JOIN notification_channel_routes r ON r.notification_id=n.id JOIN issues i ON i.id=n.issue_id
    WHERE (${predicate}) AND r.email_mode<>'off' AND r.email_enabled=1
    AND NOT EXISTS(SELECT 1 FROM notification_channel_receipts receipt WHERE receipt.notification_id=n.id)
    AND NOT EXISTS(SELECT 1 FROM notification_channel_restore_holds held WHERE held.notification_id=n.id)
    AND NOT EXISTS(SELECT 1 FROM rer_portability_state WHERE applying=1)`)
    .bind(origin.replace(/\/$/, ''), ...values);
}
export function slackIntent(db: D1Database, predicate: string, values: unknown[]) {
  return db.prepare(`INSERT OR IGNORE INTO vector_webhook_events(id,workspace_id,destination_id,event,body,created_at)
    SELECT n.id||':slack-dm',r.workspace_id,'slack-dm','slack.dm',
      json_object('eventId',n.event_id,'notificationId',n.id,'recipientId',n.recipient_id,'actorId',n.actor_id,'issueId',i.id,'identifier',i.identifier),n.created_at
    FROM notifications n JOIN notification_channel_routes r ON r.notification_id=n.id JOIN issues i ON i.id=n.issue_id
    JOIN vector_slack_member_links l ON l.operator_id=n.recipient_id AND l.workspace_id=r.workspace_id
    JOIN vector_slack_installations s ON s.workspace_id=r.workspace_id AND s.enabled=1
    WHERE (${predicate}) AND r.slack_enabled=1
    AND NOT EXISTS(SELECT 1 FROM notification_channel_receipts receipt WHERE receipt.notification_id=n.id)
    AND NOT EXISTS(SELECT 1 FROM notification_channel_restore_holds held WHERE held.notification_id=n.id)
    AND NOT EXISTS(SELECT 1 FROM vector_restore_status WHERE effects_held=1)
    AND NOT EXISTS(SELECT 1 FROM rer_portability_state WHERE applying=1)`).bind(...values);
}
export function routingReceipt(db: D1Database, predicate: string, values: unknown[]) {
  return db.prepare(`INSERT OR IGNORE INTO notification_channel_receipts(notification_id)
    SELECT n.id FROM notifications n WHERE (${predicate})`).bind(...values);
}
/** Covers scheduled and SQL-trigger Inbox producers as well as ordinary mutations.
 * Historical rows have migration receipts, so scanning cannot backfill them. */
export async function routePendingNotifications(env: WorkerBindings, eventIds?: string[]) {
  const rows = (await env.DB.prepare(`SELECT n.id FROM notifications n
    WHERE NOT EXISTS(SELECT 1 FROM notification_channel_receipts r WHERE r.notification_id=n.id)
    AND NOT EXISTS(SELECT 1 FROM notification_channel_restore_holds held WHERE held.notification_id=n.id)
    AND NOT EXISTS(SELECT 1 FROM vector_restore_status WHERE effects_held=1)
    AND NOT EXISTS(SELECT 1 FROM rer_portability_state WHERE applying=1)
    ${eventIds ? 'AND n.event_id IN(SELECT value FROM json_each(?))' : ''}
    ORDER BY n.created_at,n.id LIMIT 500`).bind(...(eventIds ? [JSON.stringify(eventIds)] : [])).all<{id: string}>()).results;
  if (!rows.length) return;
  const predicate = 'n.id IN(SELECT value FROM json_each(?))', values = [JSON.stringify(rows.map(row => row.id))];
  await env.DB.batch([
    ...(notificationEmailAvailable(env) ? [emailIntent(env.DB,predicate,values,new URL(env.APP_ORIGIN).origin)] : []),
    slackIntent(env.DB,predicate,values), routingReceipt(env.DB,predicate,values),
  ]);
}
