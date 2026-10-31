-- Comment author labels do not change native event eligibility. Email replies
-- and other native comments share the same identifier-only mutation stream.
-- Replace the trigger additively; applied migrations and queued history stay intact.
DROP TRIGGER vector_comment_webhook_event;
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
 WHERE c.id=json_extract(NEW.next_value_json,'$.id') AND i.id=NEW.issue_id AND c.deleted_at IS NULL AND t.is_private=0
 AND EXISTS(SELECT 1 FROM json_each(d.event_kinds) WHERE value=CASE NEW.kind WHEN 'comment.edited' THEN 'comment.updated' ELSE NEW.kind END)
 AND (json_array_length(d.team_ids)=0 OR EXISTS(SELECT 1 FROM json_each(d.team_ids) WHERE value=i.team_id))
 ON CONFLICT(id) DO NOTHING;
END;
