-- GitLab project identity and registration outcomes are portable; credentials are not.
CREATE TABLE vector_gitlab_connections (
 id TEXT PRIMARY KEY,
 workspace_id TEXT NOT NULL REFERENCES workspace_settings(id),
 origin TEXT NOT NULL,
 generation INTEGER NOT NULL DEFAULT 1,
 revoked_at TEXT,
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL,
 UNIQUE(workspace_id,origin)
);
CREATE TABLE vector_gitlab_projects (
 connection_id TEXT NOT NULL REFERENCES vector_gitlab_connections(id),
 project_id INTEGER NOT NULL CHECK(project_id>0),
 path TEXT NOT NULL,
 name TEXT NOT NULL,
 generation INTEGER NOT NULL,
 PRIMARY KEY(connection_id,project_id)
);
CREATE TABLE vector_gitlab_hooks (
 connection_id TEXT NOT NULL REFERENCES vector_gitlab_connections(id),
 project_id INTEGER NOT NULL,
 state TEXT NOT NULL CHECK(state IN ('registering','registered','rejected','unknown')),
 hook_id INTEGER,
 callback_url TEXT NOT NULL,
 generation INTEGER NOT NULL,
 updated_at TEXT NOT NULL,
 PRIMARY KEY(connection_id,project_id),
 FOREIGN KEY(connection_id,project_id) REFERENCES vector_gitlab_projects(connection_id,project_id)
);
