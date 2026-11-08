-- Resolution targets and their clock snapshots are portable domain state.
CREATE TABLE team_slas (
 team_id TEXT PRIMARY KEY REFERENCES teams(id) ON DELETE CASCADE,
 body_json TEXT NOT NULL CHECK(json_valid(body_json)), revision TEXT NOT NULL,
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE issue_sla_clocks (
 issue_id TEXT PRIMARY KEY REFERENCES issues(id) ON DELETE CASCADE,
 team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
 rule_json TEXT NOT NULL CHECK(json_valid(rule_json)), timezone TEXT NOT NULL,
 started_at TEXT NOT NULL, observed_at TEXT NOT NULL, elapsed_minutes REAL NOT NULL DEFAULT 0,
 stopped_at TEXT, stop_reason TEXT, revision TEXT NOT NULL
);
CREATE TABLE issue_sla_occurrences (
 issue_id TEXT NOT NULL REFERENCES issue_sla_clocks(issue_id) ON DELETE CASCADE,
 kind TEXT NOT NULL CHECK(kind IN ('warning','breach')),
 event_id TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL,
 PRIMARY KEY(issue_id,kind)
);
-- A resolved or withdrawn clock cannot resume on a later reopen or team move.
CREATE TRIGGER sla_issue_stop AFTER UPDATE OF status_id,team_id,archived_at ON issues
WHEN NEW.team_id<>OLD.team_id OR NEW.archived_at IS NOT NULL OR EXISTS(SELECT 1 FROM workflow_statuses WHERE id=NEW.status_id AND category IN ('completed','canceled','duplicate'))
BEGIN
 UPDATE issue_sla_clocks SET stopped_at=COALESCE(stopped_at,NEW.updated_at),stop_reason=COALESCE(stop_reason,CASE WHEN EXISTS(SELECT 1 FROM workflow_statuses WHERE id=NEW.status_id AND category='completed') THEN 'resolved' ELSE 'stopped' END),revision=lower(hex(randomblob(16))) WHERE issue_id=NEW.id;
END;
-- Restored clock history is inert even after effect review. New issues may start new clocks.
CREATE TRIGGER sla_restore_hold AFTER INSERT ON vector_restore_status BEGIN
 UPDATE issue_sla_clocks SET stopped_at=COALESCE(stopped_at,observed_at),stop_reason=COALESCE(stop_reason,'stopped'),revision=lower(hex(randomblob(16)));
END;

-- Observe starts and withdrawals in the native issue transaction, not the next tick.
CREATE TRIGGER sla_issue_start AFTER INSERT ON issues BEGIN
 INSERT OR IGNORE INTO issue_sla_clocks(issue_id,team_id,rule_json,timezone,started_at,observed_at,elapsed_minutes,revision)
 SELECT i.id,i.team_id,r.body_json,w.timezone,max(i.updated_at,r.created_at),max(i.updated_at,r.created_at),0,lower(hex(randomblob(16)))
 FROM issues i JOIN teams t ON t.id=i.team_id JOIN team_slas r ON r.team_id=i.team_id JOIN workspace_settings w ON w.id=t.workspace_id
 JOIN workflow_statuses st ON st.id=i.status_id
 WHERE i.id=NEW.id AND json_extract(r.body_json,'$.enabled')=1 AND (json_extract(r.body_json,'$.priority') IS NULL OR json_extract(r.body_json,'$.priority')=i.priority)
 AND (json_extract(r.body_json,'$.labelId') IS NULL OR EXISTS(SELECT 1 FROM issue_labels l WHERE l.issue_id=i.id AND l.label_id=json_extract(r.body_json,'$.labelId')))
 AND t.archived_at IS NULL AND i.archived_at IS NULL AND st.category NOT IN ('completed','canceled','duplicate')
 AND NOT EXISTS(SELECT 1 FROM vector_restore_status WHERE effects_held=1)
 AND NOT EXISTS(SELECT 1 FROM rer_portability_state WHERE applying=1);
END;
CREATE TRIGGER sla_issue_match AFTER UPDATE OF priority,status_id,team_id ON issues BEGIN
 INSERT OR IGNORE INTO issue_sla_clocks(issue_id,team_id,rule_json,timezone,started_at,observed_at,elapsed_minutes,revision)
 SELECT i.id,i.team_id,r.body_json,w.timezone,max(i.updated_at,r.created_at),max(i.updated_at,r.created_at),0,lower(hex(randomblob(16)))
 FROM issues i JOIN teams t ON t.id=i.team_id JOIN team_slas r ON r.team_id=i.team_id JOIN workspace_settings w ON w.id=t.workspace_id
 JOIN workflow_statuses st ON st.id=i.status_id
 WHERE i.id=NEW.id AND json_extract(r.body_json,'$.enabled')=1 AND (json_extract(r.body_json,'$.priority') IS NULL OR json_extract(r.body_json,'$.priority')=i.priority)
 AND (json_extract(r.body_json,'$.labelId') IS NULL OR EXISTS(SELECT 1 FROM issue_labels l WHERE l.issue_id=i.id AND l.label_id=json_extract(r.body_json,'$.labelId')))
 AND t.archived_at IS NULL AND i.archived_at IS NULL AND st.category NOT IN ('completed','canceled','duplicate')
 AND NOT EXISTS(SELECT 1 FROM vector_restore_status WHERE effects_held=1)
 AND NOT EXISTS(SELECT 1 FROM rer_portability_state WHERE applying=1);
END;
CREATE TRIGGER sla_label_match AFTER INSERT ON issue_labels BEGIN
 INSERT OR IGNORE INTO issue_sla_clocks(issue_id,team_id,rule_json,timezone,started_at,observed_at,elapsed_minutes,revision)
 SELECT i.id,i.team_id,r.body_json,w.timezone,max(i.updated_at,r.created_at),max(i.updated_at,r.created_at),0,lower(hex(randomblob(16)))
 FROM issues i JOIN teams t ON t.id=i.team_id JOIN team_slas r ON r.team_id=i.team_id JOIN workspace_settings w ON w.id=t.workspace_id
 JOIN workflow_statuses st ON st.id=i.status_id
 WHERE i.id=NEW.issue_id AND json_extract(r.body_json,'$.enabled')=1 AND (json_extract(r.body_json,'$.priority') IS NULL OR json_extract(r.body_json,'$.priority')=i.priority)
 AND (json_extract(r.body_json,'$.labelId') IS NULL OR EXISTS(SELECT 1 FROM issue_labels l WHERE l.issue_id=i.id AND l.label_id=json_extract(r.body_json,'$.labelId')))
 AND t.archived_at IS NULL AND i.archived_at IS NULL AND st.category NOT IN ('completed','canceled','duplicate')
 AND NOT EXISTS(SELECT 1 FROM vector_restore_status WHERE effects_held=1)
 AND NOT EXISTS(SELECT 1 FROM rer_portability_state WHERE applying=1);
END;
CREATE TRIGGER sla_priority_withdrawn AFTER UPDATE OF priority ON issues BEGIN
 UPDATE issue_sla_clocks SET stopped_at=COALESCE(stopped_at,NEW.updated_at),stop_reason=COALESCE(stop_reason,'stopped'),revision=lower(hex(randomblob(16)))
 WHERE issue_id=NEW.id AND json_extract(rule_json,'$.priority') IS NOT NULL AND json_extract(rule_json,'$.priority')<>NEW.priority;
END;
-- Label edits replace the whole join set. The final issue update decides
-- withdrawal, so retaining a selected label during an unrelated edit is safe.
CREATE TRIGGER sla_label_withdrawn AFTER UPDATE OF version ON issues BEGIN
 UPDATE issue_sla_clocks SET stopped_at=COALESCE(stopped_at,NEW.updated_at),stop_reason=COALESCE(stop_reason,'stopped'),revision=lower(hex(randomblob(16)))
 WHERE issue_id=NEW.id AND json_extract(rule_json,'$.labelId') IS NOT NULL
 AND NOT EXISTS(SELECT 1 FROM issue_labels WHERE issue_id=NEW.id AND label_id=json_extract(issue_sla_clocks.rule_json,'$.labelId'));
END;
CREATE TRIGGER sla_disabled AFTER UPDATE OF body_json ON team_slas WHEN json_extract(NEW.body_json,'$.enabled')=0 BEGIN
 UPDATE issue_sla_clocks SET stopped_at=COALESCE(stopped_at,NEW.updated_at),stop_reason=COALESCE(stop_reason,'stopped'),revision=lower(hex(randomblob(16))) WHERE team_id=NEW.team_id;
END;
CREATE TRIGGER sla_restore_updated AFTER UPDATE OF effects_held ON vector_restore_status WHEN NEW.effects_held=1 BEGIN
 UPDATE issue_sla_clocks SET stopped_at=COALESCE(stopped_at,observed_at),stop_reason=COALESCE(stop_reason,'stopped'),revision=lower(hex(randomblob(16)));
END;

-- Retain every prior mute and candidate while admitting the new event kind.
CREATE TABLE sla_type_mute_copy AS SELECT operator_id,kind FROM notification_type_mutes;
DROP TABLE notification_type_mutes;
CREATE TABLE notification_type_mutes (
 operator_id TEXT NOT NULL REFERENCES operators(id) ON DELETE CASCADE,
 kind TEXT NOT NULL CHECK(kind IN ('assignment','mention','comment','thread_reopened','triage','sla_warning','intake_return','unblocked','due_reminder','status','completed','canceled','duplicate','archived','urgent','blocking','due_changed','reminder')),
 PRIMARY KEY(operator_id,kind)
);
INSERT INTO notification_type_mutes SELECT operator_id,kind FROM sla_type_mute_copy;
DROP TABLE sla_type_mute_copy;

CREATE TABLE sla_candidate_copy AS SELECT * FROM notification_candidates;
DROP TABLE notification_candidates;
CREATE TABLE notification_candidates (
 event_id TEXT NOT NULL, issue_id TEXT NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
 recipient_id TEXT NOT NULL REFERENCES operators(id) ON DELETE CASCADE,
 kind TEXT NOT NULL CHECK(kind IN ('assignment','mention','comment','thread_reopened','triage','sla_warning','intake_return','unblocked','due_reminder','status','completed','canceled','duplicate','archived','urgent','blocking','due_changed','reminder')),
 actor_id TEXT REFERENCES operators(id) ON DELETE SET NULL, actor_name TEXT,
 created_at TEXT NOT NULL, PRIMARY KEY(event_id,issue_id,recipient_id,kind)
);
INSERT INTO notification_candidates SELECT * FROM sla_candidate_copy;
DROP TABLE sla_candidate_copy;

CREATE TABLE sla_channel_copy AS SELECT * FROM notification_channel_defaults;
DROP TABLE notification_channel_defaults;
CREATE TABLE notification_channel_defaults (
 workspace_id TEXT NOT NULL REFERENCES workspace_settings(id) ON DELETE CASCADE,
 kind TEXT NOT NULL CHECK(kind IN ('assignment','mention','comment','thread_reopened','triage','sla_warning','intake_return','unblocked','due_reminder','status','completed','canceled','duplicate','archived','urgent','blocking','due_changed','reminder')),
 email_mode TEXT NOT NULL CHECK(email_mode IN ('off','immediate','hourly','daily')),
 slack_enabled INTEGER NOT NULL CHECK(slack_enabled IN (0,1)), PRIMARY KEY(workspace_id,kind)
);
INSERT INTO notification_channel_defaults SELECT * FROM sla_channel_copy;
DROP TABLE sla_channel_copy;

CREATE TABLE sla_channel_copy AS SELECT * FROM notification_channel_overrides;
DROP TABLE notification_channel_overrides;
CREATE TABLE notification_channel_overrides (
 operator_id TEXT NOT NULL REFERENCES operators(id) ON DELETE CASCADE,
 kind TEXT NOT NULL CHECK(kind IN ('assignment','mention','comment','thread_reopened','triage','sla_warning','intake_return','unblocked','due_reminder','status','completed','canceled','duplicate','archived','urgent','blocking','due_changed','reminder')),
 email_mode TEXT NOT NULL CHECK(email_mode IN ('off','immediate','hourly','daily')),
 slack_enabled INTEGER NOT NULL CHECK(slack_enabled IN (0,1)), PRIMARY KEY(operator_id,kind)
);
INSERT INTO notification_channel_overrides SELECT * FROM sla_channel_copy;
DROP TABLE sla_channel_copy;
