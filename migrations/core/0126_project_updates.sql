-- Native project updates retain their subject and accountable author.
-- Existing projects and subscriptions are never scanned for past deliveries.
CREATE TABLE project_updates (
 id TEXT PRIMARY KEY,
 project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
 author_operator_id TEXT REFERENCES operators(id) ON DELETE SET NULL,
 status TEXT NOT NULL CHECK(status IN ('on-track','at-risk','off-track')),
 body TEXT NOT NULL,
 created_at TEXT NOT NULL
);
CREATE INDEX project_updates_project_order ON project_updates(project_id,created_at DESC,id DESC);
CREATE TABLE project_update_notifications (
 id TEXT PRIMARY KEY,
 update_id TEXT NOT NULL REFERENCES project_updates(id) ON DELETE CASCADE,
 project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
 recipient_id TEXT NOT NULL REFERENCES operators(id) ON DELETE CASCADE,
 created_at TEXT NOT NULL,
 read_at TEXT,
 UNIQUE(update_id,recipient_id)
);
CREATE INDEX project_update_notifications_recipient_order ON project_update_notifications(recipient_id,created_at DESC,id DESC);
-- A request identity is content-bound even when two requests race admission.
CREATE TRIGGER project_update_identity BEFORE INSERT ON project_updates
WHEN EXISTS(SELECT 1 FROM project_updates old WHERE old.id=NEW.id AND
 (old.project_id IS NOT NEW.project_id OR old.author_operator_id IS NOT NEW.author_operator_id
  OR old.status IS NOT NEW.status OR old.body IS NOT NEW.body))
 OR EXISTS(SELECT 1 FROM project_activity activity WHERE activity.id=NEW.id AND
  (activity.project_id IS NOT NEW.project_id OR activity.kind IS NOT 'project.update_posted'
   OR activity.actor_operator_id IS NOT NEW.author_operator_id
   OR json_extract(activity.next_value_json,'$.updateId') IS NOT NEW.id
   OR json_extract(activity.next_value_json,'$.status') IS NOT NEW.status))
BEGIN
 SELECT RAISE(ABORT,'project_update_conflict');
END;

-- Preserve every existing per-type preference while admitting native update mutes.
CREATE TABLE project_update_mute_copy AS SELECT operator_id,kind FROM notification_type_mutes;
DROP TABLE notification_type_mutes;
CREATE TABLE notification_type_mutes (
 operator_id TEXT NOT NULL REFERENCES operators(id) ON DELETE CASCADE,
 kind TEXT NOT NULL CHECK(kind IN ('assignment','mention','comment','thread_reopened','triage','intake_return','unblocked','due_reminder','status','completed','canceled','duplicate','archived','urgent','blocking','due_changed','reminder','project_update')),
 PRIMARY KEY(operator_id,kind)
);
INSERT INTO notification_type_mutes SELECT operator_id,kind FROM project_update_mute_copy;
DROP TABLE project_update_mute_copy;
