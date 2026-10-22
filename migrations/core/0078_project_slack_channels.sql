-- Explicit workspace channels that an Owner/Admin lets project creators bind.
CREATE TABLE vector_slack_allowed_channels (
 workspace_id TEXT NOT NULL, channel_id TEXT NOT NULL, channel_name TEXT NOT NULL,
 created_by TEXT NOT NULL, created_at TEXT NOT NULL,
 PRIMARY KEY(workspace_id,channel_id)
);
