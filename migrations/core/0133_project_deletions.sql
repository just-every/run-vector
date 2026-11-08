-- Retain native project content and one versioned receipt per deletion.
CREATE TABLE project_deletions (
 id TEXT PRIMARY KEY,
 project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
 workspace_id TEXT NOT NULL REFERENCES workspace_settings(id),
 actor_id TEXT REFERENCES operators(id) ON DELETE SET NULL,
 deleted_at TEXT NOT NULL,
 retain_until TEXT NOT NULL,
 session_hash TEXT,
 undo_until TEXT NOT NULL,
 members_json TEXT NOT NULL,
 version INTEGER NOT NULL DEFAULT 1,
 restored_at TEXT
);
CREATE UNIQUE INDEX project_deletions_active ON project_deletions(project_id) WHERE restored_at IS NULL;
CREATE TABLE project_deletion_memberships (
 deletion_id TEXT NOT NULL REFERENCES project_deletions(id) ON DELETE CASCADE,
 issue_id TEXT NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
 milestone_id TEXT REFERENCES project_milestones(id) ON DELETE SET NULL,
 PRIMARY KEY(deletion_id,issue_id)
);
-- Any subsequent membership write, including an explicit clear, takes custody
-- away from recovery. Capture is inserted only after the initial detach.
CREATE TRIGGER project_deletion_membership_changed AFTER UPDATE OF project_id,milestone_id ON issues
BEGIN
 DELETE FROM project_deletion_memberships WHERE issue_id=NEW.id;
END;
-- Ordinary native writers cannot mutate retained content behind a tombstone.
CREATE TRIGGER project_deleted_write BEFORE UPDATE ON projects
WHEN EXISTS(SELECT 1 FROM project_deletions WHERE project_id=OLD.id AND restored_at IS NULL)
BEGIN SELECT RAISE(ABORT,'project_deleted'); END;
CREATE TRIGGER project_deleted_assignment BEFORE UPDATE OF project_id ON issues
WHEN NEW.project_id IS NOT NULL AND EXISTS(SELECT 1 FROM project_deletions WHERE project_id=NEW.project_id AND restored_at IS NULL)
BEGIN SELECT RAISE(ABORT,'project_deleted'); END;
CREATE TRIGGER project_deleted_creation BEFORE INSERT ON issues
WHEN NEW.project_id IS NOT NULL AND EXISTS(SELECT 1 FROM project_deletions WHERE project_id=NEW.project_id AND restored_at IS NULL)
BEGIN SELECT RAISE(ABORT,'project_deleted'); END;
