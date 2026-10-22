import { visibleTeam } from '../roles/visibility-sql';
import { mentionedOperators } from "./mentions.server";
import { notificationContext } from "./context";
import type { NotificationKind } from "./schema";
import { directIntent } from "../integrations/slack-dm/intent";
import { emailIntent, routingReceipt } from "./channel-intents";
export type CollaborationEvent = {
  id: string;
  issueId: string;
  actor: string | null;
  actorName?: string | null;
  at: string;
};
export const activeRecipient = `o.removed_at IS NULL AND NOT EXISTS(SELECT 1 FROM vector_auth_operators mapping JOIN oa_operators native ON native.id=mapping.auth_id WHERE mapping.operator_id=o.id AND native.status<>'active')`;
export const visibleRecipient = `${activeRecipient} AND ${visibleTeam('o','i.team_id')}`;
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
    WHERE ${visibleRecipient} AND (o.id<>? OR ? IS NULL) AND ${receipt} AND (${selection})`,
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
    WHERE i.id=? AND ${visibleRecipient} AND o.id IN(SELECT value FROM json_each(?)) AND ${receipt}`,
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
      WHERE i.id=? AND ${visibleRecipient} AND o.id IN(SELECT value FROM json_each(?)) AND ${receipt}
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
      WHERE i.id=? AND ${visibleRecipient} AND o.id IN(SELECT value FROM json_each(?)) AND ${receipt}`,
      )
      .bind(key, commentId, event.issueId, encoded, event.id),
  ];
}
const following = `EXISTS(SELECT 1 FROM issue_followers f WHERE f.issue_id=i.id AND f.operator_id=o.id)`;
/** A reopened thread reaches only its participants who still follow the issue.
 * The shared candidate receipt guard admits only an actual resolution change. */
export function threadReopenedStatements(
  db: D1Database,
  event: CollaborationEvent,
  root: string,
) {
  return [
    candidate(
      db,
      event,
      "thread_reopened",
      `i.id=? AND ${following} AND EXISTS(SELECT 1 FROM issue_comments c
        WHERE c.issue_id=i.id AND c.actor_operator_id=o.id AND c.imported_author_name IS NULL
          AND (c.id=? OR c.parent_comment_id=?))`,
      [event.issueId, root, root],
    ),
  ];
}
/** Read the immutable before/after receipt inside the mutation's transaction.
 * Bulk plans may record unchanged fields; those must not produce an event. */
export function followerChangeStatements(
  db: D1Database,
  event: CollaborationEvent,
) {
  const changedStatus = `json_type(a.next_value_json,'$.statusId')='text'
    AND json_extract(a.previous_value_json,'$.statusId') IS NOT json_extract(a.next_value_json,'$.statusId')`;
  const rules: [NotificationKind, string][] = [
    [
      "status",
      `${changedStatus} AND EXISTS(SELECT 1 FROM workflow_statuses s WHERE s.id=json_extract(a.next_value_json,'$.statusId') AND (s.category NOT IN ('completed','canceled','duplicate') OR s.category=(SELECT p.category FROM workflow_statuses p WHERE p.id=json_extract(a.previous_value_json,'$.statusId'))))`,
    ],
    ...(["completed", "canceled", "duplicate"] as const).map(
      (kind): [NotificationKind, string] => [
        kind,
        `(${changedStatus} AND EXISTS(SELECT 1 FROM workflow_statuses s WHERE s.id=json_extract(a.next_value_json,'$.statusId') AND s.category='${kind}' AND s.category IS NOT (SELECT p.category FROM workflow_statuses p WHERE p.id=json_extract(a.previous_value_json,'$.statusId'))))${kind === "duplicate" ? " OR (json_type(a.next_value_json,'$.canonicalIdentifier')='text' AND json_extract(a.previous_value_json,'$.canonicalIdentifier') IS NOT json_extract(a.next_value_json,'$.canonicalIdentifier'))" : ""}`,
      ],
    ),
    [
      "urgent",
      `json_extract(a.next_value_json,'$.priority')='urgent' AND json_extract(a.previous_value_json,'$.priority') IS NOT 'urgent'`,
    ],
    [
      "due_changed",
      `json_type(a.next_value_json,'$.dueDate') IS NOT NULL AND json_extract(a.previous_value_json,'$.dueDate') IS NOT json_extract(a.next_value_json,'$.dueDate')`,
    ],
  ];
  return rules.map(([kind, condition]) =>
    candidate(
      db,
      event,
      kind,
      `i.id=? AND ${following} AND EXISTS(SELECT 1 FROM issue_activity a WHERE a.id=? AND a.issue_id=i.id AND (${condition}))`,
      [event.issueId, event.id],
    ),
  );
}
/** An archive (AUTO-003) is a lifecycle change followers receive like a status change. */
export function followerArchiveStatements(
  db: D1Database,
  event: CollaborationEvent,
) {
  return [
    candidate(db, event, "archived", `i.id=? AND ${following}`, [
      event.issueId,
    ]),
  ];
}
/** Both endpoint histories describe one directed relation mutation. Its source
 * receipt groups blocking and last-blocker resolution for each recipient. */
export function followerBlockingStatements(
  db: D1Database,
  event: CollaborationEvent,
  relatedIssueId: string,
) {
  return [
    candidate(db, event, "blocking", `i.id IN (?,?) AND ${following}`, [
      event.issueId,
      relatedIssueId,
    ]),
  ];
}
/** Retargeting a canonical issue also changes its existing duplicates. Capture
 * their followers before moving the relations, under the same source receipt. */
export function duplicateFollowerStatements(
  db: D1Database,
  event: CollaborationEvent,
  excludedIssueIds: string[] = [],
) {
  return [
    candidate(
      db,
      event,
      "duplicate",
      `${following} AND EXISTS(SELECT 1 FROM issue_duplicates d WHERE d.issue_id=i.id AND d.canonical_issue_id=?)
        AND i.id NOT IN(SELECT value FROM json_each(?))`,
      [event.issueId, JSON.stringify(excludedIssueIds)],
    ),
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
  context?.directEventIds.add(event.id);
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
      FROM notification_candidates c JOIN issues i ON i.id=c.issue_id JOIN operators o ON o.id=c.recipient_id
      WHERE c.event_id=? AND NOT EXISTS(SELECT 1 FROM notification_events e WHERE e.event_id=c.event_id) AND ${visibleRecipient}
       AND NOT EXISTS(SELECT 1 FROM issue_notification_mutes m WHERE m.issue_id=c.issue_id AND m.operator_id=c.recipient_id)
       AND NOT EXISTS(SELECT 1 FROM notification_type_mutes m WHERE m.kind=c.kind AND m.operator_id=c.recipient_id)
      GROUP BY c.event_id,c.issue_id,c.recipient_id`,
      )
      .bind(event.id),
  ];
  const predicate = "n.event_id=? AND NOT EXISTS(SELECT 1 FROM notification_events e WHERE e.event_id=n.event_id)";
  if (context?.available) statements.push(emailIntent(db,predicate,[event.id],context.origin));
  // SLACK-004: a linked member's chosen Slack direct message, beside the mail intent.
  statements.push(directIntent(db, event.id));
  if (context) statements.push(routingReceipt(db,predicate,[event.id]));
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
