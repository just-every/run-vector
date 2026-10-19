-- Followers hear about an automatic archive (AUTO-003) as its own kind. Widen the
-- kind admission without renaming tables used by mail-admission triggers; retain
-- every prior mute and candidate on upgrade.
CREATE TABLE archive_type_mute_copy AS SELECT operator_id,kind FROM notification_type_mutes;
DROP TABLE notification_type_mutes;
CREATE TABLE notification_type_mutes (
 operator_id TEXT NOT NULL REFERENCES operators(id) ON DELETE CASCADE,
 kind TEXT NOT NULL CHECK(kind IN ('assignment','mention','comment','intake_return','unblocked','due_reminder','status','completed','canceled','duplicate','archived','urgent','blocking','due_changed','reminder')),
 PRIMARY KEY(operator_id,kind)
);
INSERT INTO notification_type_mutes SELECT operator_id,kind FROM archive_type_mute_copy;
DROP TABLE archive_type_mute_copy;

CREATE TABLE archive_candidate_copy AS SELECT * FROM notification_candidates;
DROP TABLE notification_candidates;
CREATE TABLE notification_candidates (
 event_id TEXT NOT NULL, issue_id TEXT NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
 recipient_id TEXT NOT NULL REFERENCES operators(id) ON DELETE CASCADE,
 kind TEXT NOT NULL CHECK(kind IN ('assignment','mention','comment','intake_return','unblocked','due_reminder','status','completed','canceled','duplicate','archived','urgent','blocking','due_changed','reminder')),
 actor_id TEXT REFERENCES operators(id) ON DELETE SET NULL, actor_name TEXT,
 created_at TEXT NOT NULL, PRIMARY KEY(event_id,issue_id,recipient_id,kind)
);
INSERT INTO notification_candidates SELECT * FROM archive_candidate_copy;
DROP TABLE archive_candidate_copy;
