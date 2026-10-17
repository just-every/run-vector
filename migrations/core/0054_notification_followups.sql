CREATE TABLE notification_snoozes (
 notification_id TEXT PRIMARY KEY REFERENCES notifications(id) ON DELETE CASCADE,
 issue_id TEXT NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
 recipient_id TEXT NOT NULL REFERENCES operators(id) ON DELETE CASCADE,
 until_at TEXT, until_change INTEGER NOT NULL CHECK(until_change IN(0,1)),
 snoozed_at TEXT NOT NULL, returned_at TEXT,
 CHECK((until_change=1 AND until_at IS NULL) OR (until_change=0 AND until_at IS NOT NULL))
);
CREATE INDEX notification_snoozes_due ON notification_snoozes(until_at) WHERE returned_at IS NULL;
CREATE TABLE issue_reminders (
 id TEXT PRIMARY KEY, issue_id TEXT NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
 recipient_id TEXT NOT NULL REFERENCES operators(id) ON DELETE CASCADE,
 remind_at TEXT NOT NULL, created_at TEXT NOT NULL, delivered_at TEXT, delivery_id TEXT,
 CHECK((delivered_at IS NULL)=(delivery_id IS NULL))
);
CREATE INDEX issue_reminders_due ON issue_reminders(remind_at) WHERE delivered_at IS NULL;
-- Activity receipt insertion shares the issue mutation's transaction, including comments.
-- Historical activity imported during restore must never wake a snooze.
CREATE TRIGGER notification_snooze_issue_change AFTER INSERT ON issue_activity
 WHEN NOT EXISTS(SELECT 1 FROM rer_portability_state WHERE applying=1)
 AND NOT EXISTS(SELECT 1 FROM vector_restore_status WHERE effects_held=1)
 BEGIN
 UPDATE notifications SET read_at=NULL WHERE id IN (
  SELECT notification_id FROM notification_snoozes WHERE issue_id=NEW.issue_id
  AND until_change=1 AND returned_at IS NULL
 );
 UPDATE notification_snoozes SET returned_at=NEW.created_at WHERE issue_id=NEW.issue_id
 AND until_change=1 AND returned_at IS NULL;
 END;
