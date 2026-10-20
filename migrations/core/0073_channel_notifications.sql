-- Channel deliveries reuse the native outbound queue and its restore/erasure ledgers.
ALTER TABLE vector_webhook_destinations ADD COLUMN kind TEXT NOT NULL DEFAULT 'webhook' CHECK(kind IN ('webhook','slack','discord'));
CREATE TABLE vector_slack_installations (
 workspace_id TEXT PRIMARY KEY, team_name TEXT NOT NULL, created_by TEXT NOT NULL,
 enabled INTEGER NOT NULL DEFAULT 1, updated_at TEXT NOT NULL
);
CREATE TABLE vector_channel_bindings (
 destination_id TEXT PRIMARY KEY REFERENCES vector_webhook_destinations(id),
 workspace_id TEXT NOT NULL, scope TEXT NOT NULL CHECK(scope IN ('team','project','view')),
 object_id TEXT NOT NULL, channel_id TEXT NOT NULL, channel_name TEXT NOT NULL,
 events TEXT NOT NULL CHECK(json_valid(events)), created_by TEXT NOT NULL,
 UNIQUE(workspace_id,scope,object_id)
);
-- Preserve the existing webhook contract; channel destinations have their own minimal event body.
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
 WHERE i.id=NEW.issue_id ON CONFLICT(id) DO NOTHING;
END;
CREATE TRIGGER vector_channel_event AFTER INSERT ON issue_activity
WHEN (NEW.kind='issue.created' OR (NEW.kind IN ('issue.updated','issue.status_changed') AND json_extract(NEW.next_value_json,'$.statusId') IS NOT NULL))
 AND (NOT EXISTS(SELECT 1 FROM vector_restore_status) OR EXISTS(SELECT 1 FROM vector_restore_status WHERE effects_held=0))
BEGIN
 INSERT INTO vector_webhook_events(id,workspace_id,destination_id,event,body,created_at)
 SELECT NEW.id||':'||d.id,t.workspace_id,d.id,
 CASE WHEN NEW.kind='issue.created' THEN CASE WHEN s.category='intake' THEN 'triage.created' ELSE 'issue.created' END ELSE 'issue.status_changed' END,
 json_object('identifier',i.identifier,'issueId',i.id,'title',COALESCE(json_extract(NEW.next_value_json,'$.title'),i.title),
 'actor',COALESCE((SELECT name FROM operators WHERE id=NEW.actor_operator_id),'Automation'),'actorId',NEW.actor_operator_id,
 'change',CASE WHEN NEW.kind='issue.created' THEN 'Created' ELSE COALESCE((SELECT name FROM workflow_statuses WHERE id=json_extract(NEW.previous_value_json,'$.statusId')),s.name)||' → '||COALESCE((SELECT name FROM workflow_statuses WHERE id=json_extract(NEW.next_value_json,'$.statusId')),s.name) END),NEW.created_at
 FROM issues i JOIN teams t ON t.id=i.team_id JOIN workflow_statuses s ON s.id=i.status_id
 JOIN vector_channel_bindings b ON b.workspace_id=t.workspace_id
 JOIN vector_webhook_destinations d ON d.id=b.destination_id AND d.enabled=1 AND d.revoked_at IS NULL
 WHERE i.id=NEW.issue_id AND (b.scope='team' AND b.object_id=i.team_id OR b.scope='project' AND b.object_id=COALESCE(json_extract(NEW.next_value_json,'$.projectId'),i.project_id) OR b.scope='view')
 AND EXISTS(SELECT 1 FROM json_each(b.events) WHERE value=CASE WHEN NEW.kind='issue.created' THEN CASE WHEN s.category='intake' THEN 'triage.created' ELSE 'issue.created' END ELSE 'issue.status_changed' END)
 ON CONFLICT(id) DO NOTHING;
END;
CREATE TRIGGER vector_channel_operator_removed AFTER UPDATE OF removed_at ON operators WHEN NEW.removed_at IS NOT NULL BEGIN
 UPDATE vector_webhook_destinations SET enabled=0,revoked_at=COALESCE(revoked_at,NEW.removed_at) WHERE id IN(SELECT destination_id FROM vector_channel_bindings WHERE created_by=NEW.id);
 DELETE FROM vector_integration_secret_keys WHERE identity='slack:'||NEW.workspace_id AND EXISTS(SELECT 1 FROM vector_slack_installations WHERE workspace_id=NEW.workspace_id AND created_by=NEW.id);
 UPDATE vector_slack_installations SET enabled=0 WHERE workspace_id=NEW.workspace_id AND created_by=NEW.id;
END;
