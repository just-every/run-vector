CREATE TABLE initiative_graph (
 workspace_id TEXT PRIMARY KEY REFERENCES workspace_settings(id),revision INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE initiatives (
 id TEXT PRIMARY KEY,workspace_id TEXT NOT NULL REFERENCES workspace_settings(id),
 parent_id TEXT REFERENCES initiatives(id),owner_operator_id TEXT NOT NULL REFERENCES operators(id),
 name TEXT NOT NULL,description TEXT NOT NULL DEFAULT '',target_date TEXT,
 status TEXT NOT NULL CHECK(status IN ('planned','active','completed')),
 version INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL,updated_at TEXT NOT NULL
);
CREATE INDEX initiatives_workspace_parent ON initiatives(workspace_id,parent_id,id);
CREATE TABLE initiative_projects (
 initiative_id TEXT NOT NULL REFERENCES initiatives(id) ON DELETE CASCADE,
 project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
 PRIMARY KEY(initiative_id,project_id)
);
