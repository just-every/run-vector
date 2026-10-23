CREATE TABLE releases (
 id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES workspace_settings(id),
 team_id TEXT REFERENCES teams(id),name TEXT NOT NULL,target_date TEXT,
 status TEXT NOT NULL CHECK(status IN ('planned','in_progress','released')),
 description TEXT NOT NULL DEFAULT '',version INTEGER NOT NULL DEFAULT 1,
 created_at TEXT NOT NULL,updated_at TEXT NOT NULL
);
CREATE INDEX releases_workspace ON releases(workspace_id,target_date,id);
CREATE TABLE release_issues (
 release_id TEXT NOT NULL REFERENCES releases(id) ON DELETE CASCADE,
 issue_id TEXT NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
 PRIMARY KEY(release_id,issue_id)
);
CREATE TABLE release_projects (
 release_id TEXT NOT NULL REFERENCES releases(id) ON DELETE CASCADE,
 project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
 PRIMARY KEY(release_id,project_id)
);
