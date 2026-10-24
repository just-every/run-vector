ALTER TABLE teams ADD COLUMN is_private INTEGER NOT NULL DEFAULT 0 CHECK(is_private IN(0,1));
-- Retained deletion receipts keep their current team visibility after the issue is erased.
ALTER TABLE issue_deletions ADD COLUMN team_id TEXT REFERENCES teams(id);

-- Re-evaluate already queued immediate mail and digests at final admission.
DROP VIEW notification_channel_routes;
CREATE VIEW notification_channel_routes AS
 SELECT n.id notification_id,o.id recipient_id,t.workspace_id,
 CASE (SELECT MIN(CASE COALESCE((SELECT email_mode FROM notification_channel_overrides WHERE operator_id=o.id AND kind=cause.value),(SELECT email_mode FROM notification_channel_defaults WHERE workspace_id=t.workspace_id AND kind=cause.value),CASE WHEN cause.value IN ('assignment','mention') THEN 'immediate' ELSE 'off' END) WHEN 'immediate' THEN 0 WHEN 'hourly' THEN 1 WHEN 'daily' THEN 2 ELSE 3 END) FROM json_each(n.causes_json) cause WHERE NOT EXISTS(SELECT 1 FROM notification_type_mutes mute WHERE mute.operator_id=o.id AND mute.kind=cause.value)) WHEN 0 THEN 'immediate' WHEN 1 THEN 'hourly' WHEN 2 THEN 'daily' ELSE 'off' END email_mode,
 COALESCE((SELECT email_enabled FROM notification_preferences WHERE operator_id=o.id),1) email_enabled,
 EXISTS(SELECT 1 FROM json_each(n.causes_json) cause WHERE NOT EXISTS(SELECT 1 FROM notification_type_mutes mute WHERE mute.operator_id=o.id AND mute.kind=cause.value) AND COALESCE((SELECT slack_enabled FROM notification_channel_overrides WHERE operator_id=o.id AND kind=cause.value),(SELECT slack_enabled FROM notification_channel_defaults WHERE workspace_id=t.workspace_id AND kind=cause.value),EXISTS(SELECT 1 FROM vector_slack_member_links legacy,json_each(legacy.dm_kinds) selected WHERE legacy.operator_id=o.id AND selected.value=cause.value),0)=1) slack_enabled,
 (SELECT json_group_array(cause.value) FROM json_each(n.causes_json) cause WHERE NOT EXISTS(SELECT 1 FROM notification_type_mutes mute WHERE mute.operator_id=o.id AND mute.kind=cause.value) AND COALESCE((SELECT email_mode FROM notification_channel_overrides WHERE operator_id=o.id AND kind=cause.value),(SELECT email_mode FROM notification_channel_defaults WHERE workspace_id=t.workspace_id AND kind=cause.value),CASE WHEN cause.value IN ('assignment','mention') THEN 'immediate' ELSE 'off' END)<>'off') mail_causes_json
 FROM notifications n JOIN issues i ON i.id=n.issue_id JOIN teams t ON t.id=i.team_id
 JOIN operators o ON o.id=n.recipient_id AND o.workspace_id=t.workspace_id
 WHERE o.removed_at IS NULL
 AND NOT EXISTS(SELECT 1 FROM vector_auth_operators mapping JOIN oa_operators native ON native.id=mapping.auth_id WHERE mapping.operator_id=o.id AND native.status<>'active')
 AND (o.role='owner' OR (o.role<>'guest' AND t.is_private=0) OR EXISTS(SELECT 1 FROM team_members visible WHERE visible.operator_id=o.id AND visible.team_id=i.team_id))
 AND (n.actor_id IS NULL OR n.actor_id<>o.id)
 AND NOT EXISTS(SELECT 1 FROM issue_notification_mutes mute WHERE mute.issue_id=i.id AND mute.operator_id=o.id);

DROP TRIGGER vector_native_webhook_event;
CREATE TRIGGER vector_native_webhook_event AFTER INSERT ON issue_activity
WHEN NEW.kind IN ('issue.created','issue.updated','issue.status_changed')
 AND (NOT EXISTS(SELECT 1 FROM vector_restore_status) OR EXISTS(SELECT 1 FROM vector_restore_status WHERE effects_held=0))
BEGIN
 INSERT INTO vector_webhook_events(id,workspace_id,destination_id,event,body,created_at)
 SELECT i.id||':'||i.version||':'||d.id||':'||CASE WHEN NEW.kind='issue.created' THEN 'created' WHEN s.category='completed' THEN 'completed' ELSE 'updated' END,
 t.workspace_id,d.id,CASE WHEN NEW.kind='issue.created' THEN 'issue.created' WHEN s.category='completed' THEN 'issue.completed' ELSE 'issue.updated' END,
 json_object('identifier',i.identifier,'version',i.version,'title',i.title,'status',s.category,'updatedAt',i.updated_at),NEW.created_at
 FROM issues i JOIN teams t ON t.id=i.team_id JOIN workflow_statuses s ON s.id=i.status_id
 JOIN vector_webhook_destinations d ON d.workspace_id=t.workspace_id AND d.kind='webhook' AND d.enabled=1 AND d.revoked_at IS NULL
 WHERE i.id=NEW.issue_id AND t.is_private=0 ON CONFLICT(id) DO NOTHING;
END;
