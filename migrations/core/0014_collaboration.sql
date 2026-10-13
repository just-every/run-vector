-- Additive collaboration state. Retain this ledger on application-code rollback.
CREATE TABLE issue_followers (
 issue_id TEXT NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
 operator_id TEXT NOT NULL REFERENCES operators(id) ON DELETE CASCADE,
 created_at TEXT NOT NULL, PRIMARY KEY(issue_id,operator_id)
);
CREATE INDEX issue_followers_operator ON issue_followers(operator_id,issue_id);
CREATE TABLE issue_notification_mutes (
 issue_id TEXT NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
 operator_id TEXT NOT NULL REFERENCES operators(id) ON DELETE CASCADE,
 PRIMARY KEY(issue_id,operator_id)
);
CREATE TABLE notification_preferences (
 operator_id TEXT PRIMARY KEY REFERENCES operators(id) ON DELETE CASCADE,
 email_enabled INTEGER NOT NULL CHECK(email_enabled IN (0,1))
);
CREATE TABLE notification_type_mutes (
 operator_id TEXT NOT NULL REFERENCES operators(id) ON DELETE CASCADE,
 kind TEXT NOT NULL CHECK(kind IN ('assignment','mention','comment','intake_return','unblocked')),
 PRIMARY KEY(operator_id,kind)
);
CREATE TABLE issue_mentions (
 issue_id TEXT NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
 body_key TEXT NOT NULL,
 comment_id TEXT REFERENCES issue_comments(id) ON DELETE CASCADE,
 operator_id TEXT NOT NULL REFERENCES operators(id) ON DELETE CASCADE,
 PRIMARY KEY(issue_id,body_key,operator_id),
 CHECK((body_key='description' AND comment_id IS NULL) OR (comment_id IS NOT NULL AND body_key=comment_id))
);
CREATE TABLE issue_deferral_origins (
 issue_id TEXT PRIMARY KEY REFERENCES issues(id) ON DELETE CASCADE,
 decision_id TEXT NOT NULL UNIQUE REFERENCES intake_decisions(id) ON DELETE CASCADE
);
-- Retain finalized source identity even when every cause was muted. Replaying
-- a receipt must never backfill previously suppressed notifications or mail.
CREATE TABLE notification_events (
 event_id TEXT PRIMARY KEY REFERENCES issue_activity(id) ON DELETE CASCADE,
 created_at TEXT NOT NULL
);
-- A transient transaction workspace: source receipts authorize insertion, and
-- finalization consumes it before commit. It is never an inbox or delivery queue.
CREATE TABLE notification_candidates (
 event_id TEXT NOT NULL, issue_id TEXT NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
 recipient_id TEXT NOT NULL REFERENCES operators(id) ON DELETE CASCADE,
 kind TEXT NOT NULL CHECK(kind IN ('assignment','mention','comment','intake_return','unblocked')),
 actor_id TEXT REFERENCES operators(id) ON DELETE SET NULL, actor_name TEXT,
 created_at TEXT NOT NULL, PRIMARY KEY(event_id,issue_id,recipient_id,kind)
);
CREATE TABLE notifications (
 id TEXT PRIMARY KEY, event_id TEXT NOT NULL,
 issue_id TEXT NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
 recipient_id TEXT NOT NULL REFERENCES operators(id) ON DELETE CASCADE,
 actor_id TEXT REFERENCES operators(id) ON DELETE SET NULL, actor_name TEXT,
 causes_json TEXT NOT NULL CHECK(json_valid(causes_json) AND json_type(causes_json)='array'),
 created_at TEXT NOT NULL, read_at TEXT,
 UNIQUE(event_id,issue_id,recipient_id)
);
CREATE INDEX notifications_recipient_order ON notifications(recipient_id,created_at DESC,id DESC);
CREATE INDEX notifications_unread ON notifications(recipient_id) WHERE read_at IS NULL;
CREATE TABLE notification_deliveries (
 id TEXT PRIMARY KEY,
 notification_id TEXT NOT NULL UNIQUE REFERENCES notifications(id) ON DELETE CASCADE,
 recipient_id TEXT NOT NULL REFERENCES operators(id) ON DELETE CASCADE,
 actor_id TEXT REFERENCES operators(id) ON DELETE SET NULL, actor_name TEXT,
 identifier TEXT NOT NULL, title TEXT NOT NULL, app_link TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('pending','claimed','retry','accepted','development','uncertain','failed','suppressed')),
 attempts INTEGER NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 3),
 claim_token TEXT, claimed_at TEXT, next_attempt_at TEXT, reason TEXT,
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX notification_delivery_due ON notification_deliveries(status,next_attempt_at,created_at);
CREATE TABLE notification_delivery_attempts (
 id TEXT PRIMARY KEY, delivery_id TEXT NOT NULL REFERENCES notification_deliveries(id) ON DELETE CASCADE,
 number INTEGER NOT NULL CHECK(number BETWEEN 1 AND 3), status TEXT NOT NULL,
 reason TEXT, started_at TEXT NOT NULL, settled_at TEXT,
 UNIQUE(delivery_id,number)
);
-- Minimal retained automatic-action audit. No recipient, actor, title or body,
-- and deliberately no erasure cascade to the source issue or delivery.
CREATE TABLE notification_mail_audit (
 id TEXT PRIMARY KEY,
 feature TEXT NOT NULL CHECK(feature='notification.mail'),
 subject_identifier TEXT NOT NULL,
 outcome TEXT NOT NULL CHECK(outcome IN ('accepted','development')),
 created_at TEXT NOT NULL
);
CREATE TABLE notification_development_mail (
 delivery_id TEXT PRIMARY KEY REFERENCES notification_deliveries(id) ON DELETE CASCADE,
 recipient TEXT NOT NULL, subject TEXT NOT NULL, text TEXT NOT NULL, created_at TEXT NOT NULL
);
-- Recover explicit historical relationships only; no text scanning or fan-out.
INSERT OR IGNORE INTO issue_followers(issue_id,operator_id,created_at)
SELECT relation.issue_id,o.id,MIN(relation.created_at) FROM (
 SELECT issue_id,actor_operator_id AS operator_id,created_at FROM issue_activity WHERE kind='issue.created'
 UNION ALL SELECT id,assignee_operator_id,created_at FROM issues WHERE assignee_operator_id IS NOT NULL
 UNION ALL SELECT issue_id,actor_operator_id,created_at FROM issue_comments
) relation JOIN issues i ON i.id=relation.issue_id JOIN teams t ON t.id=i.team_id
JOIN operators o ON o.id=relation.operator_id AND o.workspace_id=t.workspace_id AND o.removed_at IS NULL
GROUP BY relation.issue_id,o.id;
-- Equal timestamp histories cannot identify a current decision reliably. Leave
-- ambiguous legacy deferrals unlinked instead of inventing their recipient.
INSERT INTO issue_deferral_origins(issue_id,decision_id)
SELECT i.id,d.id FROM issues i JOIN intake_decisions d ON d.issue_id=i.id
WHERE i.deferred_until IS NOT NULL AND d.kind='deferred' AND d.return_at=i.deferred_until
 AND d.created_at=(SELECT MAX(last.created_at) FROM intake_decisions last WHERE last.issue_id=i.id)
 AND 1=(SELECT count(*) FROM intake_decisions last WHERE last.issue_id=i.id AND last.created_at=d.created_at);
