-- Direct project edges are separate from issue dependencies. SQLite serializes
-- these triggers with the edge write, including concurrent opposite edges.
CREATE TABLE project_dependencies (
 id TEXT PRIMARY KEY,
 workspace_id TEXT NOT NULL REFERENCES workspace_settings(id),
 blocked_project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
 blocking_project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
 created_at TEXT NOT NULL,
 UNIQUE(blocked_project_id,blocking_project_id),
 CHECK(blocked_project_id<>blocking_project_id)
);
CREATE INDEX project_dependencies_blocking_idx ON project_dependencies(blocking_project_id,blocked_project_id);
CREATE TRIGGER project_dependency_insert BEFORE INSERT ON project_dependencies BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM projects a JOIN projects b ON b.workspace_id=a.workspace_id
   WHERE a.id=NEW.blocked_project_id AND b.id=NEW.blocking_project_id AND a.workspace_id=NEW.workspace_id)
   THEN RAISE(ABORT,'invalid_project_dependency') END;
 SELECT CASE WHEN NEW.blocked_project_id=NEW.blocking_project_id OR EXISTS(
   WITH RECURSIVE ancestors(id) AS (SELECT NEW.blocking_project_id UNION
     SELECT d.blocking_project_id FROM project_dependencies d JOIN ancestors a ON d.blocked_project_id=a.id)
   SELECT 1 FROM ancestors WHERE id=NEW.blocked_project_id)
   THEN RAISE(ABORT,'project_dependency_cycle') END;
END;
-- Edge identity and direction never mutate. A change is removal and a new edge.
CREATE TRIGGER project_dependency_immutable BEFORE UPDATE ON project_dependencies BEGIN
 SELECT RAISE(ABORT,'immutable_project_dependency');
END;
CREATE TABLE project_notifications (
 id TEXT PRIMARY KEY,
 event_id TEXT NOT NULL REFERENCES project_activity(id) ON DELETE CASCADE,
 project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
 related_project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
 recipient_id TEXT NOT NULL REFERENCES operators(id) ON DELETE CASCADE,
 actor_id TEXT REFERENCES operators(id) ON DELETE SET NULL,
 actor_name TEXT,
 created_at TEXT NOT NULL,
 read_at TEXT,
 UNIQUE(event_id,recipient_id)
);
CREATE INDEX project_notifications_recipient_order ON project_notifications(recipient_id,created_at DESC,id DESC);
