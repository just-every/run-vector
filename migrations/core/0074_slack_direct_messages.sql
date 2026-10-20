-- SLACK-004: member-confirmed Slack links and signed-request replay keys.
-- Both stay out of archives (see archive-policy.mjs); a restored installation re-links.
-- Direct messages reuse vector_webhook_events and the native outbound ledger.
CREATE TABLE vector_slack_member_links (
 operator_id TEXT PRIMARY KEY REFERENCES operators(id) ON DELETE CASCADE,
 workspace_id TEXT NOT NULL, slack_team_id TEXT NOT NULL, slack_user_id TEXT NOT NULL,
 slack_name TEXT NOT NULL,
 dm_kinds TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(dm_kinds) AND json_type(dm_kinds)='array'),
 linked_at TEXT NOT NULL,
 UNIQUE(workspace_id,slack_team_id,slack_user_id)
);
CREATE TABLE vector_slack_request_keys (key TEXT PRIMARY KEY, received_at INTEGER NOT NULL);
-- Removing the workspace credential (or its configuring operator) drops every link and the signing secret.
CREATE TRIGGER vector_slack_installation_disabled AFTER UPDATE OF enabled ON vector_slack_installations WHEN NEW.enabled=0 BEGIN
 DELETE FROM vector_slack_member_links WHERE workspace_id=NEW.workspace_id;
 DELETE FROM vector_integration_secret_keys WHERE identity='slack-signing:'||NEW.workspace_id;
END;
-- A removed member's link goes, and queued direct messages naming them are scrubbed before any send.
CREATE TRIGGER vector_slack_member_removed AFTER UPDATE OF removed_at ON operators WHEN NEW.removed_at IS NOT NULL BEGIN
 DELETE FROM vector_slack_member_links WHERE operator_id=NEW.id;
 UPDATE integration_deliveries SET envelope=json_set(envelope,'$.body','{}') WHERE namespace=NEW.workspace_id AND json_extract(envelope,'$.protocol')='slack_dm'
  AND id IN(SELECT id FROM vector_webhook_events WHERE workspace_id=NEW.workspace_id AND event='slack.dm' AND NEW.id IN(json_extract(body,'$.recipientId'),json_extract(body,'$.actorId')));
 UPDATE vector_webhook_events SET body='{}' WHERE workspace_id=NEW.workspace_id AND event='slack.dm' AND json_extract(body,'$.recipientId')=NEW.id;
END;
