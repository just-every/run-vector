-- Retain reminder identities and settings on compatible-source rollback.
ALTER TABLE workspace_settings ADD COLUMN reminder_time TEXT NOT NULL DEFAULT '09:00'
 CHECK(length(reminder_time)=5 AND reminder_time GLOB '[0-2][0-9]:[0-5][0-9]' AND substr(reminder_time,1,2)<'24');
-- Copy without renaming: existing mail-admission triggers keep their table reference.
CREATE TABLE reminder_mute_copy AS SELECT operator_id,kind FROM notification_type_mutes;
DROP TABLE notification_type_mutes;
CREATE TABLE notification_type_mutes (
 operator_id TEXT NOT NULL REFERENCES operators(id) ON DELETE CASCADE,
 kind TEXT NOT NULL CHECK(kind IN ('assignment','mention','comment','intake_return','unblocked','due_reminder')),
 PRIMARY KEY(operator_id,kind)
);
INSERT INTO notification_type_mutes SELECT operator_id,kind FROM reminder_mute_copy;
DROP TABLE reminder_mute_copy;
CREATE TABLE due_reminders (
 issue_id TEXT NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
 due_date TEXT NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN ('due_today','overdue')),
 claim_id TEXT NOT NULL UNIQUE,
 created_at TEXT NOT NULL,
 PRIMARY KEY(issue_id,due_date,kind)
);
-- Mutes consume only this operator's occurrence, without blocking a later assignee.
CREATE TABLE due_reminder_suppressions (
 issue_id TEXT NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
 due_date TEXT NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN ('due_today','overdue')),
 operator_id TEXT NOT NULL REFERENCES operators(id) ON DELETE CASCADE,
 created_at TEXT NOT NULL,
 PRIMARY KEY(issue_id,due_date,kind,operator_id)
);
