CREATE TABLE subscription_clock (id INTEGER PRIMARY KEY CHECK(id=1),revision INTEGER NOT NULL);
INSERT INTO subscription_clock VALUES(1,0);
CREATE TABLE subject_subscriptions (
 id TEXT PRIMARY KEY,operator_id TEXT NOT NULL REFERENCES operators(id) ON DELETE CASCADE,
 subject_type TEXT NOT NULL,subject_id TEXT NOT NULL,start_revision INTEGER NOT NULL,created_at TEXT NOT NULL,
 UNIQUE(operator_id,subject_type,subject_id)
);
CREATE TABLE subscription_events (
 event_id TEXT PRIMARY KEY REFERENCES issue_activity(id) ON DELETE CASCADE,
 issue_id TEXT NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
 revision INTEGER NOT NULL,kind TEXT NOT NULL,created_at TEXT NOT NULL
);
CREATE INDEX subscription_event_revision ON subscription_events(revision,event_id);
CREATE TABLE subscription_event_receipts (
 event_id TEXT NOT NULL REFERENCES subscription_events(event_id) ON DELETE CASCADE,
 operator_id TEXT NOT NULL REFERENCES operators(id) ON DELETE CASCADE,
 PRIMARY KEY(event_id,operator_id)
);
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
   THEN (SELECT category FROM workflow_statuses WHERE id=json_extract(NEW.next_value_json,'$.statusId')) ELSE 'status' END,NEW.created_at FROM subscription_clock WHERE id=1;
END;
CREATE TRIGGER subscription_team_departure AFTER DELETE ON team_members BEGIN
 DELETE FROM subject_subscriptions WHERE operator_id=OLD.operator_id AND subject_type='team' AND subject_id=OLD.team_id;
END;
CREATE TRIGGER subscription_operator_removed AFTER UPDATE OF removed_at ON operators WHEN NEW.removed_at IS NOT NULL BEGIN
 DELETE FROM subject_subscriptions WHERE operator_id=NEW.id;
 DELETE FROM subscription_event_receipts WHERE operator_id=NEW.id;
END;
CREATE TRIGGER subscription_operator_suspended AFTER UPDATE OF status ON oa_operators WHEN NEW.status<>'active' BEGIN
 DELETE FROM subject_subscriptions WHERE operator_id IN(SELECT operator_id FROM vector_auth_operators WHERE auth_id=NEW.id);
 DELETE FROM subscription_event_receipts WHERE operator_id IN(SELECT operator_id FROM vector_auth_operators WHERE auth_id=NEW.id);
END;
-- Preferences and history stay portable. Destination-only cutoffs prevent any
-- restored pending event from creating a new effect after access review.
ALTER TABLE vector_restore_status ADD COLUMN subscription_revision INTEGER NOT NULL DEFAULT 0;
CREATE TRIGGER subscription_restore_insert AFTER INSERT ON vector_restore_status BEGIN
 UPDATE vector_restore_status SET subscription_revision=(SELECT revision FROM subscription_clock WHERE id=1) WHERE id=NEW.id;
END;
CREATE TRIGGER subscription_restore_update AFTER UPDATE OF import_id ON vector_restore_status BEGIN
 UPDATE vector_restore_status SET subscription_revision=(SELECT revision FROM subscription_clock WHERE id=1) WHERE id=NEW.id;
END;
