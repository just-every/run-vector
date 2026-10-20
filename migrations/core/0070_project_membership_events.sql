-- Additive project reporting. Deleted issues leave only identifiers and chronology.
CREATE TABLE project_membership_events (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
 identifier TEXT NOT NULL,
 direction TEXT NOT NULL CHECK(direction IN ('added','removed')),
 occurred_at TEXT NOT NULL
);
CREATE INDEX project_membership_interval ON project_membership_events(project_id,occurred_at);
-- Recover only recorded changes. This cannot recover already erased issues.
INSERT INTO project_membership_events(project_id,identifier,direction,occurred_at)
 SELECT project_id,identifier,direction,occurred_at FROM (
 SELECT json_extract(a.next_value_json,'$.projectId') AS project_id,i.identifier,'added' AS direction,a.created_at AS occurred_at,a.id AS activity_id
 FROM issue_activity a JOIN issues i ON i.id=a.issue_id
 WHERE json_extract(a.next_value_json,'$.projectId') IS NOT NULL
 AND json_extract(a.previous_value_json,'$.projectId') IS NOT json_extract(a.next_value_json,'$.projectId')
 UNION ALL
 SELECT json_extract(a.previous_value_json,'$.projectId'),i.identifier,'removed',a.created_at,a.id
 FROM issue_activity a JOIN issues i ON i.id=a.issue_id
 WHERE json_type(a.next_value_json,'$.projectId') IS NOT NULL
 AND json_extract(a.previous_value_json,'$.projectId') IS NOT NULL
 AND json_extract(a.previous_value_json,'$.projectId') IS NOT json_extract(a.next_value_json,'$.projectId'))
 WHERE EXISTS(SELECT 1 FROM projects WHERE id=project_id)
 ORDER BY julianday(occurred_at),activity_id,direction DESC;
CREATE TRIGGER project_membership_created AFTER INSERT ON issues WHEN NEW.project_id IS NOT NULL BEGIN
 INSERT INTO project_membership_events(project_id,identifier,direction,occurred_at) VALUES(NEW.project_id,NEW.identifier,'added',NEW.created_at);
END;
CREATE TRIGGER project_membership_changed AFTER UPDATE OF project_id ON issues WHEN NEW.project_id IS NOT OLD.project_id BEGIN
 INSERT INTO project_membership_events(project_id,identifier,direction,occurred_at) SELECT OLD.project_id,OLD.identifier,'removed',NEW.updated_at WHERE OLD.project_id IS NOT NULL;
 INSERT INTO project_membership_events(project_id,identifier,direction,occurred_at) SELECT NEW.project_id,NEW.identifier,'added',NEW.updated_at WHERE NEW.project_id IS NOT NULL;
END;
CREATE TRIGGER project_membership_deleted BEFORE DELETE ON issues WHEN OLD.project_id IS NOT NULL BEGIN
 INSERT INTO project_membership_events(project_id,identifier,direction,occurred_at) VALUES(OLD.project_id,OLD.identifier,'removed',COALESCE((SELECT requested_at FROM issue_deletions WHERE issue_id=OLD.id),strftime('%Y-%m-%dT%H:%M:%fZ','now')));
END;
-- Daily records retain aggregate counts only, never issue/category/person facts.
CREATE TABLE project_report_days (
 project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
 day TEXT NOT NULL,
 timezone TEXT NOT NULL,
 scope INTEGER CHECK(scope IS NULL OR scope>=0),
 completed INTEGER CHECK(completed IS NULL OR completed>=0),
 completions INTEGER CHECK(completions IS NULL OR completions>=0),
 recorded_at TEXT NOT NULL,
 PRIMARY KEY(project_id,day)
);
CREATE TABLE cycle_report_days (
 cycle_id TEXT NOT NULL REFERENCES cycles(id) ON DELETE CASCADE,
 day TEXT NOT NULL,
 timezone TEXT NOT NULL,
 scope INTEGER CHECK(scope IS NULL OR scope>=0),
 completed INTEGER CHECK(completed IS NULL OR completed>=0),
 completions INTEGER CHECK(completions IS NULL OR completions>=0),
 recorded_at TEXT NOT NULL,
 PRIMARY KEY(cycle_id,day)
);
CREATE TABLE project_report_snapshots (
 project_id TEXT PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
 through_at TEXT NOT NULL,
 timezone TEXT NOT NULL,
 final_state TEXT NOT NULL,
 scope INTEGER NOT NULL,
 completed INTEGER NOT NULL
);
-- The final record is aggregate-only. Existing terminal projects are honestly
-- recorded at upgrade; their earlier daily history is not invented.
INSERT INTO project_report_snapshots
 SELECT p.id,strftime('%Y-%m-%dT%H:%M:%fZ','now'),w.timezone,
 CASE WHEN p.archived_at IS NOT NULL THEN 'archived' ELSE p.lifecycle END,
 (SELECT count(*) FROM issues i JOIN workflow_statuses s ON s.id=i.status_id WHERE i.project_id=p.id AND s.category NOT IN ('canceled','duplicate')),
 (SELECT count(*) FROM issues i JOIN workflow_statuses s ON s.id=i.status_id WHERE i.project_id=p.id AND s.category='completed')
 FROM projects p JOIN workspace_settings w ON w.id=p.workspace_id
 WHERE p.lifecycle IN ('completed','canceled') OR p.archived_at IS NOT NULL;
CREATE TRIGGER project_report_finalized AFTER UPDATE OF lifecycle,archived_at ON projects
 WHEN (NEW.lifecycle IN ('completed','canceled') OR NEW.archived_at IS NOT NULL)
 AND OLD.lifecycle NOT IN ('completed','canceled') AND OLD.archived_at IS NULL BEGIN
 INSERT INTO project_report_snapshots
 SELECT NEW.id,NEW.updated_at,w.timezone,CASE WHEN NEW.archived_at IS NOT NULL THEN 'archived' ELSE NEW.lifecycle END,
 (SELECT count(*) FROM issues i JOIN workflow_statuses s ON s.id=i.status_id WHERE i.project_id=NEW.id AND s.category NOT IN ('canceled','duplicate')),
 (SELECT count(*) FROM issues i JOIN workflow_statuses s ON s.id=i.status_id WHERE i.project_id=NEW.id AND s.category='completed')
 FROM workspace_settings w WHERE w.id=NEW.workspace_id;
END;
CREATE TRIGGER project_report_reopened AFTER UPDATE OF lifecycle,archived_at ON projects
 WHEN NEW.lifecycle NOT IN ('completed','canceled') AND NEW.archived_at IS NULL BEGIN
 DELETE FROM project_report_snapshots WHERE project_id=NEW.id;
END;
-- Both report histories use the deletion operation's canonical timestamp, also
-- when the clock differs from SQLite's wall clock during recovery/testing.
DROP TRIGGER cycle_membership_deleted;
CREATE TRIGGER cycle_membership_deleted BEFORE DELETE ON issues WHEN OLD.cycle_id IS NOT NULL BEGIN
 INSERT INTO cycle_membership_events VALUES(lower(hex(randomblob(16))),OLD.cycle_id,OLD.identifier,'removed',COALESCE((SELECT requested_at FROM issue_deletions WHERE issue_id=OLD.id),strftime('%Y-%m-%dT%H:%M:%fZ','now')));
END;
