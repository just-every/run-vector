-- Triage responsibility is portable configuration. New Inbox events use current members; historical events are never replayed.
ALTER TABLE teams ADD COLUMN triage_responsibility_json TEXT CHECK(triage_responsibility_json IS NULL OR (json_valid(triage_responsibility_json) AND json_type(triage_responsibility_json)='object'));

CREATE TABLE triage_copy AS SELECT * FROM notification_type_mutes;
DROP TABLE notification_type_mutes;
CREATE TABLE notification_type_mutes (
 operator_id TEXT NOT NULL REFERENCES operators(id) ON DELETE CASCADE,
 kind TEXT NOT NULL CHECK(kind IN ('new_triage','assignment','mention','comment','thread_reopened','intake_return','unblocked','due_reminder','status','completed','canceled','duplicate','archived','urgent','blocking','due_changed','reminder')),
 PRIMARY KEY(operator_id,kind)
);
INSERT INTO notification_type_mutes SELECT * FROM triage_copy;
DROP TABLE triage_copy;

CREATE TABLE triage_copy AS SELECT * FROM notification_candidates;
DROP TABLE notification_candidates;
CREATE TABLE notification_candidates (
 event_id TEXT NOT NULL, issue_id TEXT NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
 recipient_id TEXT NOT NULL REFERENCES operators(id) ON DELETE CASCADE,
 kind TEXT NOT NULL CHECK(kind IN ('new_triage','assignment','mention','comment','thread_reopened','intake_return','unblocked','due_reminder','status','completed','canceled','duplicate','archived','urgent','blocking','due_changed','reminder')),
 actor_id TEXT REFERENCES operators(id) ON DELETE SET NULL, actor_name TEXT,
 created_at TEXT NOT NULL, PRIMARY KEY(event_id,issue_id,recipient_id,kind)
);
INSERT INTO notification_candidates SELECT * FROM triage_copy;
DROP TABLE triage_copy;

CREATE TABLE triage_copy AS SELECT * FROM notification_channel_defaults;
DROP TABLE notification_channel_defaults;
CREATE TABLE notification_channel_defaults (
 workspace_id TEXT NOT NULL REFERENCES workspace_settings(id) ON DELETE CASCADE,
 kind TEXT NOT NULL CHECK(kind IN ('new_triage','assignment','mention','comment','thread_reopened','intake_return','unblocked','due_reminder','status','completed','canceled','duplicate','archived','urgent','blocking','due_changed','reminder')),
 email_mode TEXT NOT NULL CHECK(email_mode IN ('off','immediate','hourly','daily')),
 slack_enabled INTEGER NOT NULL CHECK(slack_enabled IN (0,1)), PRIMARY KEY(workspace_id,kind)
);
INSERT INTO notification_channel_defaults SELECT * FROM triage_copy;
DROP TABLE triage_copy;

CREATE TABLE triage_copy AS SELECT * FROM notification_channel_overrides;
DROP TABLE notification_channel_overrides;
CREATE TABLE notification_channel_overrides (
 operator_id TEXT NOT NULL REFERENCES operators(id) ON DELETE CASCADE,
 kind TEXT NOT NULL CHECK(kind IN ('new_triage','assignment','mention','comment','thread_reopened','intake_return','unblocked','due_reminder','status','completed','canceled','duplicate','archived','urgent','blocking','due_changed','reminder')),
 email_mode TEXT NOT NULL CHECK(email_mode IN ('off','immediate','hourly','daily')),
 slack_enabled INTEGER NOT NULL CHECK(slack_enabled IN (0,1)), PRIMARY KEY(operator_id,kind)
);
INSERT INTO notification_channel_overrides SELECT * FROM triage_copy;
DROP TABLE triage_copy;
