-- Forward-only: changing a terminal status identity within its category is
-- a status change. Completion channels apply only on category transitions.
-- Existing subscription events and delivery history remain unchanged.
DROP TRIGGER capture_subscription_event;
CREATE TRIGGER capture_subscription_event AFTER INSERT ON issue_activity
WHEN NEW.kind<>'issue.imported'
 AND (NEW.kind='issue.created' OR (json_type(NEW.next_value_json,'$.statusId')='text' AND json_extract(NEW.next_value_json,'$.statusId') IS NOT json_extract(NEW.previous_value_json,'$.statusId')))
 AND NOT EXISTS(SELECT 1 FROM rer_portability_state WHERE applying=1)
 AND NOT EXISTS(SELECT 1 FROM vector_restore_status WHERE effects_held=1)
BEGIN
 UPDATE subscription_clock SET revision=revision+1 WHERE id=1;
 INSERT INTO subscription_events(event_id,issue_id,revision,kind,created_at)
 SELECT NEW.id,NEW.issue_id,revision,
 CASE WHEN NEW.kind='issue.created' THEN 'status'
  WHEN (SELECT category FROM workflow_statuses WHERE id=json_extract(NEW.next_value_json,'$.statusId')) IN ('completed','canceled','duplicate')
   AND (SELECT category FROM workflow_statuses WHERE id=json_extract(NEW.next_value_json,'$.statusId'))
    IS NOT (SELECT category FROM workflow_statuses WHERE id=json_extract(NEW.previous_value_json,'$.statusId'))
   THEN (SELECT category FROM workflow_statuses WHERE id=json_extract(NEW.next_value_json,'$.statusId')) ELSE 'status' END,NEW.created_at FROM subscription_clock WHERE id=1;
END;
