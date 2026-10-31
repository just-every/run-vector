-- Existing destinations keep precisely their current issue events on upgrade.
ALTER TABLE vector_webhook_destinations ADD COLUMN event_kinds TEXT NOT NULL DEFAULT '["issue.created","issue.updated","issue.completed"]' CHECK(json_valid(event_kinds) AND json_type(event_kinds)='array');
ALTER TABLE vector_webhook_destinations ADD COLUMN team_ids TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(team_ids) AND json_type(team_ids)='array');

DROP TRIGGER vector_native_webhook_event;
CREATE TRIGGER vector_native_webhook_event AFTER INSERT ON issue_activity
WHEN NEW.kind IN ('issue.created','issue.updated','issue.status_changed')
 AND (NOT EXISTS(SELECT 1 FROM vector_restore_status) OR EXISTS(SELECT 1 FROM vector_restore_status WHERE effects_held=0))
BEGIN
 INSERT INTO vector_webhook_events(id,workspace_id,destination_id,event,body,created_at)
 SELECT i.id||':'||i.version||':'||d.id||':'||CASE WHEN NEW.kind='issue.created' THEN 'created' WHEN s.category='completed' THEN 'completed' ELSE 'updated' END,
 t.workspace_id,d.id,CASE WHEN NEW.kind='issue.created' THEN 'issue.created' WHEN s.category='completed' THEN 'issue.completed' ELSE 'issue.updated' END,
 json_object('identifier',i.identifier,'issueId',i.id,'teamId',i.team_id,'version',i.version,'title',i.title,'status',s.category,'updatedAt',i.updated_at),NEW.created_at
 FROM issues i JOIN teams t ON t.id=i.team_id JOIN workflow_statuses s ON s.id=i.status_id
 JOIN vector_webhook_destinations d ON d.workspace_id=t.workspace_id AND d.kind='webhook' AND d.enabled=1 AND d.revoked_at IS NULL
 WHERE i.id=NEW.issue_id AND t.is_private=0
 AND EXISTS(SELECT 1 FROM json_each(d.event_kinds) WHERE value=CASE WHEN NEW.kind='issue.created' THEN 'issue.created' WHEN s.category='completed' THEN 'issue.completed' ELSE 'issue.updated' END)
 AND (json_array_length(d.team_ids)=0 OR EXISTS(SELECT 1 FROM json_each(d.team_ids) WHERE value=i.team_id))
 ON CONFLICT(id) DO NOTHING;
END;

-- Activity identity is stable across dispatch and restart. The native comment,
-- its activity and every selected event commit in the same transaction.
-- Identifier-only payloads never retain a comment body, quote or author.
CREATE TRIGGER vector_comment_webhook_event AFTER INSERT ON issue_activity
WHEN NEW.kind IN ('comment.created','comment.edited','comment.deleted')
 AND (NOT EXISTS(SELECT 1 FROM vector_restore_status) OR EXISTS(SELECT 1 FROM vector_restore_status WHERE effects_held=0))
BEGIN
 INSERT INTO vector_webhook_events(id,workspace_id,destination_id,event,body,created_at)
 SELECT NEW.id||':'||d.id,t.workspace_id,d.id,
 CASE NEW.kind WHEN 'comment.edited' THEN 'comment.updated' ELSE NEW.kind END,
 json_object('identifier',i.identifier,'issueId',i.id,'teamId',i.team_id,'commentId',c.id,
   'parentCommentId',c.parent_comment_id,'rootCommentId',COALESCE(c.parent_comment_id,c.id),'occurredAt',NEW.created_at),NEW.created_at
 FROM issue_comments c JOIN issues i ON i.id=c.issue_id JOIN teams t ON t.id=i.team_id
 JOIN vector_webhook_destinations d ON d.workspace_id=t.workspace_id AND d.kind='webhook' AND d.enabled=1 AND d.revoked_at IS NULL
 WHERE c.id=json_extract(NEW.next_value_json,'$.id') AND i.id=NEW.issue_id AND c.deleted_at IS NULL AND c.imported_author_name IS NULL AND t.is_private=0
 AND EXISTS(SELECT 1 FROM json_each(d.event_kinds) WHERE value=CASE NEW.kind WHEN 'comment.edited' THEN 'comment.updated' ELSE NEW.kind END)
 AND (json_array_length(d.team_ids)=0 OR EXISTS(SELECT 1 FROM json_each(d.team_ids) WHERE value=i.team_id))
 ON CONFLICT(id) DO NOTHING;
END;
