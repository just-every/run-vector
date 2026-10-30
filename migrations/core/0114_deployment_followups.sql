-- PUSH-003. Forward-only: a team's explicit production follow-up window and one
-- durable watch per recorded merge SHA and linked issue. Both are portable
-- domain data; the Inbox kind below is admitted without changing prior rows.
CREATE TABLE team_deployment_followups (
 team_id TEXT PRIMARY KEY REFERENCES teams(id) ON DELETE CASCADE,
 window_hours INTEGER CHECK(window_hours IS NULL OR window_hours BETWEEN 1 AND 720),
 -- Only merges received at or after this instant are followed; NULL is off.
 enabled_at TEXT,
 configured_by TEXT REFERENCES operators(id) ON DELETE SET NULL,
 version INTEGER NOT NULL,
 updated_at TEXT NOT NULL,
 CHECK((window_hours IS NULL)=(enabled_at IS NULL))
);
-- merged_at is GitHub's merge time and recorded_at its first signed receipt;
-- neither ever moves. A production deployment or the one question settles the
-- watch, and neither is ever repeated.
CREATE TABLE deployment_followup_watches (
 repository_id TEXT NOT NULL REFERENCES vector_github_repositories(id),
 sha TEXT NOT NULL,
 issue_id TEXT NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
 pull_number INTEGER NOT NULL,
 merged_at TEXT NOT NULL,
 recorded_at TEXT NOT NULL,
 production_deployment_id INTEGER,
 production_at TEXT,
 asked_at TEXT,
 question_id TEXT,
 recipient_id TEXT REFERENCES operators(id) ON DELETE SET NULL,
 PRIMARY KEY(repository_id,sha,issue_id),
 CHECK((production_deployment_id IS NULL)=(production_at IS NULL)),
 CHECK((asked_at IS NULL)=(question_id IS NULL))
);
CREATE INDEX deployment_followup_issue ON deployment_followup_watches(issue_id);
CREATE INDEX deployment_followup_waiting ON deployment_followup_watches(asked_at,production_at,merged_at);

-- A restore never asks about restored merges: the restored deployment evidence
-- may be stale, so each enabled window applies only to merges after the restore.
CREATE TRIGGER deployment_followup_restore_complete AFTER UPDATE OF phase ON rer_portability_jobs
WHEN NEW.kind='import' AND NEW.phase='complete' AND OLD.phase!='complete' BEGIN
 UPDATE team_deployment_followups SET enabled_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE window_hours IS NOT NULL;
END;

-- Admit the deployment_question Inbox kind. Copy without renaming: existing
-- views and mail-admission triggers keep their table references.
CREATE TABLE deployment_mute_copy AS SELECT operator_id,kind FROM notification_type_mutes;
DROP TABLE notification_type_mutes;
CREATE TABLE notification_type_mutes (
 operator_id TEXT NOT NULL REFERENCES operators(id) ON DELETE CASCADE,
 kind TEXT NOT NULL CHECK(kind IN ('assignment','mention','comment','thread_reopened','intake_return','unblocked','due_reminder','status','completed','canceled','duplicate','archived','urgent','blocking','due_changed','reminder','deployment_question')),
 PRIMARY KEY(operator_id,kind)
);
INSERT INTO notification_type_mutes SELECT operator_id,kind FROM deployment_mute_copy;
DROP TABLE deployment_mute_copy;

CREATE TABLE deployment_candidate_copy AS SELECT * FROM notification_candidates;
DROP TABLE notification_candidates;
CREATE TABLE notification_candidates (
 event_id TEXT NOT NULL, issue_id TEXT NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
 recipient_id TEXT NOT NULL REFERENCES operators(id) ON DELETE CASCADE,
 kind TEXT NOT NULL CHECK(kind IN ('assignment','mention','comment','thread_reopened','intake_return','unblocked','due_reminder','status','completed','canceled','duplicate','archived','urgent','blocking','due_changed','reminder','deployment_question')),
 actor_id TEXT REFERENCES operators(id) ON DELETE SET NULL, actor_name TEXT,
 created_at TEXT NOT NULL, PRIMARY KEY(event_id,issue_id,recipient_id,kind)
);
INSERT INTO notification_candidates SELECT * FROM deployment_candidate_copy;
DROP TABLE deployment_candidate_copy;

CREATE TABLE deployment_default_copy AS SELECT * FROM notification_channel_defaults;
DROP TABLE notification_channel_defaults;
CREATE TABLE notification_channel_defaults (
 workspace_id TEXT NOT NULL REFERENCES workspace_settings(id) ON DELETE CASCADE,
 kind TEXT NOT NULL CHECK(kind IN ('assignment','mention','comment','thread_reopened','intake_return','unblocked','due_reminder','status','completed','canceled','duplicate','archived','urgent','blocking','due_changed','reminder','deployment_question')),
 email_mode TEXT NOT NULL CHECK(email_mode IN ('off','immediate','hourly','daily')),
 slack_enabled INTEGER NOT NULL CHECK(slack_enabled IN (0,1)), PRIMARY KEY(workspace_id,kind)
);
INSERT INTO notification_channel_defaults SELECT * FROM deployment_default_copy;
DROP TABLE deployment_default_copy;

CREATE TABLE deployment_override_copy AS SELECT * FROM notification_channel_overrides;
DROP TABLE notification_channel_overrides;
CREATE TABLE notification_channel_overrides (
 operator_id TEXT NOT NULL REFERENCES operators(id) ON DELETE CASCADE,
 kind TEXT NOT NULL CHECK(kind IN ('assignment','mention','comment','thread_reopened','intake_return','unblocked','due_reminder','status','completed','canceled','duplicate','archived','urgent','blocking','due_changed','reminder','deployment_question')),
 email_mode TEXT NOT NULL CHECK(email_mode IN ('off','immediate','hourly','daily')),
 slack_enabled INTEGER NOT NULL CHECK(slack_enabled IN (0,1)), PRIMARY KEY(operator_id,kind)
);
INSERT INTO notification_channel_overrides SELECT * FROM deployment_override_copy;
DROP TABLE deployment_override_copy;
