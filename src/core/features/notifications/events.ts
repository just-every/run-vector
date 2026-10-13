import { mentionedOperators } from "./mentions.server";
import { notificationContext } from "./context";
import type { NotificationKind } from "./schema";
export type CollaborationEvent = {
  id: string;
  issueId: string;
  actor: string | null;
  actorName?: string | null;
  at: string;
};
export const activeRecipient = `o.removed_at IS NULL AND NOT EXISTS(SELECT 1 FROM vector_auth_operators mapping JOIN oa_operators native ON native.id=mapping.auth_id WHERE mapping.operator_id=o.id AND native.status<>'active')`;
const receipt =
  "EXISTS(SELECT 1 FROM issue_activity a WHERE a.id=? AND NOT EXISTS(SELECT 1 FROM notification_events e WHERE e.event_id=a.id))";
function candidate(
  db: D1Database,
  event: CollaborationEvent,
  kind: NotificationKind,
  selection: string,
  params: unknown[],
) {
  return db
    .prepare(
      `INSERT OR IGNORE INTO notification_candidates(event_id,issue_id,recipient_id,kind,actor_id,actor_name,created_at)
    SELECT ?,i.id,o.id,?,?,COALESCE((SELECT name FROM operators WHERE id=?),?),?
    FROM issues i JOIN teams t ON t.id=i.team_id JOIN operators o ON o.workspace_id=t.workspace_id
    WHERE ${activeRecipient} AND (o.id<>? OR ? IS NULL) AND ${receipt} AND (${selection})`,
    )
    .bind(
      event.id,
      kind,
      event.actor,
      event.actor,
      event.actorName ?? null,
      event.at,
      event.actor,
      event.actor,
      event.id,
      ...params,
    );
}
export function followStatements(
  db: D1Database,
  event: CollaborationEvent,
  operatorIds: (string | null)[],
) {
  return [
    db
      .prepare(
        `INSERT OR IGNORE INTO issue_followers(issue_id,operator_id,created_at)
    SELECT i.id,o.id,? FROM issues i JOIN teams t ON t.id=i.team_id JOIN operators o ON o.workspace_id=t.workspace_id
    WHERE i.id=? AND ${activeRecipient} AND o.id IN(SELECT value FROM json_each(?)) AND ${receipt}`,
      )
      .bind(
        event.at,
        event.issueId,
        JSON.stringify(operatorIds.filter(Boolean)),
        event.id,
      ),
  ];
}
export function assignmentStatements(
  db: D1Database,
  event: CollaborationEvent,
  assignee: string | null,
) {
  if (!assignee) return [];
  return [
    candidate(db, event, "assignment", "i.id=? AND o.id=?", [
      event.issueId,
      assignee,
    ]),
    ...followStatements(db, event, [assignee]),
  ];
}
export function commentStatements(db: D1Database, event: CollaborationEvent) {
  return [
    candidate(
      db,
      event,
      "comment",
      "i.id=? AND EXISTS(SELECT 1 FROM issue_followers f WHERE f.issue_id=i.id AND f.operator_id=o.id)",
      [event.issueId],
    ),
    ...followStatements(db, event, [event.actor]),
  ];
}
export function mentionStatements(
  db: D1Database,
  event: CollaborationEvent,
  body: string | null,
  commentId: string | null = null,
) {
  const ids = mentionedOperators(body ?? ""),
    encoded = JSON.stringify(ids),
    key = commentId ?? "description";
  return [
    candidate(
      db,
      event,
      "mention",
      `i.id=? AND o.id IN(SELECT value FROM json_each(?)) AND NOT EXISTS(SELECT 1 FROM issue_mentions m WHERE m.issue_id=i.id AND m.body_key=? AND m.operator_id=o.id)`,
      [event.issueId, encoded, key],
    ),
    db
      .prepare(
        `INSERT OR IGNORE INTO issue_followers(issue_id,operator_id,created_at)
      SELECT i.id,o.id,? FROM issues i JOIN teams t ON t.id=i.team_id JOIN operators o ON o.workspace_id=t.workspace_id
      WHERE i.id=? AND ${activeRecipient} AND o.id IN(SELECT value FROM json_each(?)) AND ${receipt}
      AND NOT EXISTS(SELECT 1 FROM issue_mentions m WHERE m.issue_id=i.id AND m.body_key=? AND m.operator_id=o.id)`,
      )
      .bind(event.at, event.issueId, encoded, event.id, key),
    db
      .prepare(
        `DELETE FROM issue_mentions WHERE issue_id=? AND body_key=? AND ${receipt}`,
      )
      .bind(event.issueId, key, event.id),
    db
      .prepare(
        `INSERT INTO issue_mentions(issue_id,body_key,comment_id,operator_id)
      SELECT i.id,?,?,o.id FROM issues i JOIN teams t ON t.id=i.team_id JOIN operators o ON o.workspace_id=t.workspace_id
      WHERE i.id=? AND ${activeRecipient} AND o.id IN(SELECT value FROM json_each(?)) AND ${receipt}`,
      )
      .bind(key, commentId, event.issueId, encoded, event.id),
  ];
}
/** Capture before the status/edge write; finalization checks after the write. */
export function blockerStatements(
  db: D1Database,
  event: CollaborationEvent,
  blockedId?: string,
) {
  return [
    candidate(
      db,
      event,
      "unblocked",
      `o.id=i.assignee_operator_id AND ${blockedId ? "i.id=?" : "EXISTS(SELECT 1 FROM issue_dependencies d WHERE d.blocked_issue_id=i.id AND d.blocking_issue_id=?)"}
    AND EXISTS(SELECT 1 FROM issue_dependencies d JOIN issues b ON b.id=d.blocking_issue_id JOIN workflow_statuses s ON s.id=b.status_id WHERE d.blocked_issue_id=i.id AND s.category NOT IN ('completed','canceled','duplicate'))`,
      [blockedId ?? event.issueId],
    ),
  ];
}
export function returnStatements(db: D1Database, event: CollaborationEvent) {
  return [
    candidate(
      db,
      event,
      "intake_return",
      `i.id=? AND EXISTS(SELECT 1 FROM issue_deferral_origins f JOIN intake_decisions d ON d.id=f.decision_id WHERE f.issue_id=i.id AND d.actor_operator_id=o.id)`,
      [event.issueId],
    ),
  ];
}
export function finalizeEvent(db: D1Database, event: CollaborationEvent) {
  const context = notificationContext(db);
  if (context?.available) context.eventIds.add(event.id);
  const statements = [
    db
      .prepare(
        `DELETE FROM notification_candidates WHERE event_id=? AND kind='unblocked' AND EXISTS(
      SELECT 1 FROM issue_dependencies d JOIN issues b ON b.id=d.blocking_issue_id JOIN workflow_statuses s ON s.id=b.status_id
      WHERE d.blocked_issue_id=notification_candidates.issue_id AND s.category NOT IN ('completed','canceled','duplicate'))`,
      )
      .bind(event.id),
    db
      .prepare(
        `INSERT OR IGNORE INTO notifications(id,event_id,issue_id,recipient_id,actor_id,actor_name,causes_json,created_at)
      SELECT lower(hex(randomblob(16))),c.event_id,c.issue_id,c.recipient_id,c.actor_id,c.actor_name,json_group_array(c.kind),c.created_at
      FROM notification_candidates c JOIN operators o ON o.id=c.recipient_id
      WHERE c.event_id=? AND NOT EXISTS(SELECT 1 FROM notification_events e WHERE e.event_id=c.event_id) AND ${activeRecipient}
       AND NOT EXISTS(SELECT 1 FROM issue_notification_mutes m WHERE m.issue_id=c.issue_id AND m.operator_id=c.recipient_id)
       AND NOT EXISTS(SELECT 1 FROM notification_type_mutes m WHERE m.kind=c.kind AND m.operator_id=c.recipient_id)
      GROUP BY c.event_id,c.issue_id,c.recipient_id`,
      )
      .bind(event.id),
  ];
  if (context?.available)
    statements.push(
      db
        .prepare(
          `INSERT OR IGNORE INTO notification_deliveries(id,notification_id,recipient_id,actor_id,actor_name,identifier,title,app_link,status,created_at,updated_at)
    SELECT n.id,n.id,n.recipient_id,n.actor_id,n.actor_name,i.identifier,i.title,?||'/app/issues/'||i.identifier,'pending',n.created_at,n.created_at
    FROM notifications n JOIN issues i ON i.id=n.issue_id JOIN operators o ON o.id=n.recipient_id
    WHERE n.event_id=? AND NOT EXISTS(SELECT 1 FROM notification_events e WHERE e.event_id=n.event_id) AND ${activeRecipient} AND COALESCE((SELECT email_enabled FROM notification_preferences WHERE operator_id=o.id),1)=1
    AND EXISTS(SELECT 1 FROM json_each(n.causes_json) WHERE value IN ('assignment','mention'))`,
        )
        .bind(context.origin.replace(/\/$/, ""), event.id),
    );
  statements.push(
    db
      .prepare(
        "INSERT OR IGNORE INTO notification_events(event_id,created_at) SELECT id,created_at FROM issue_activity WHERE id=?",
      )
      .bind(event.id),
    db
      .prepare("DELETE FROM notification_candidates WHERE event_id=?")
      .bind(event.id),
  );
  return statements;
}
