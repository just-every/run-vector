-- Native issue changes and issue erasure must not scan every member's follow-ups.
CREATE INDEX notification_snoozes_issue ON notification_snoozes(issue_id);
CREATE INDEX issue_reminders_issue_recipient ON issue_reminders(issue_id,recipient_id,remind_at);
