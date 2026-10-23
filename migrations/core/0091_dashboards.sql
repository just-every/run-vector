CREATE TABLE dashboards (
 id TEXT PRIMARY KEY,
 workspace_id TEXT NOT NULL REFERENCES workspace_settings(id) ON DELETE CASCADE,
 creator_id TEXT NOT NULL REFERENCES operators(id) ON DELETE CASCADE,
 team_id TEXT REFERENCES teams(id) ON DELETE CASCADE,
 name TEXT NOT NULL,
 is_shared INTEGER NOT NULL DEFAULT 0 CHECK(is_shared IN (0,1)),
 version INTEGER NOT NULL DEFAULT 1,
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL
);
CREATE INDEX dashboards_workspace ON dashboards(workspace_id,creator_id,is_shared);
-- Only definitions are saved. Every count and issue is read as the current viewer.
CREATE TABLE dashboard_widgets (
 dashboard_id TEXT NOT NULL REFERENCES dashboards(id) ON DELETE CASCADE,
 position INTEGER NOT NULL CHECK(position>=0),
 definition_json TEXT NOT NULL CHECK(json_valid(definition_json)),
 PRIMARY KEY(dashboard_id,position)
);
