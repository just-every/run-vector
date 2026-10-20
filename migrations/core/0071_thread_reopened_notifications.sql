-- Admit reopened-thread inbox events without changing preferences or prior rows.
-- Preserve table names referenced by existing mail-admission triggers.
CREATE TABLE thread_type_mute_copy AS SELECT operator_id,kind FROM notification_type_mutes;
DROP TABLE notification_type_mutes;
CREATE TABLE notification_type_mutes (
 operator_id TEXT NOT NULL REFERENCES operators(id) ON DELETE CASCADE,
 kind TEXT NOT NULL CHECK(kind IN ('assignment','mention','comment','thread_reopened','intake_return','unblocked','due_reminder','status','completed','canceled','duplicate','archived','urgent','blocking','due_changed','reminder')),
 PRIMARY KEY(operator_id,kind)
);
INSERT INTO notification_type_mutes SELECT operator_id,kind FROM thread_type_mute_copy;
DROP TABLE thread_type_mute_copy;

CREATE TABLE thread_candidate_copy AS SELECT * FROM notification_candidates;
DROP TABLE notification_candidates;
CREATE TABLE notification_candidates (
 event_id TEXT NOT NULL, issue_id TEXT NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
 recipient_id TEXT NOT NULL REFERENCES operators(id) ON DELETE CASCADE,
 kind TEXT NOT NULL CHECK(kind IN ('assignment','mention','comment','thread_reopened','intake_return','unblocked','due_reminder','status','completed','canceled','duplicate','archived','urgent','blocking','due_changed','reminder')),
 actor_id TEXT REFERENCES operators(id) ON DELETE SET NULL, actor_name TEXT,
 created_at TEXT NOT NULL, PRIMARY KEY(event_id,issue_id,recipient_id,kind)
);
INSERT INTO notification_candidates SELECT * FROM thread_candidate_copy;
DROP TABLE thread_candidate_copy;
