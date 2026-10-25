-- Durable identifier-only Slack intake receipts. Retain on archive/restore so
-- a provider retry cannot recreate an issue after credentials are re-entered.
CREATE TABLE vector_slack_event_receipts (
 workspace_id TEXT NOT NULL,
 event_key TEXT NOT NULL,
 identifier TEXT NOT NULL,
 received_at TEXT NOT NULL,
 PRIMARY KEY(workspace_id,event_key)
);
