-- Expand existing databases without inventing a setup owner for prior installs.
CREATE TABLE workspace_installation (
  workspace_id TEXT PRIMARY KEY REFERENCES workspace_settings(id),
  setup_operator_id TEXT NOT NULL REFERENCES operators(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Serializes an empty installation's first-owner creation across Worker instances.
CREATE TABLE workspace_bootstrap (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  workspace_id TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);

CREATE TABLE project_activity (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  actor_operator_id TEXT REFERENCES operators(id),
  kind TEXT NOT NULL,
  previous_value_json TEXT,
  next_value_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX project_activity_project_idx ON project_activity(project_id, created_at);

-- A successful transaction has one removal receipt; all cascades key off it.
CREATE TABLE operator_removals (
  id TEXT PRIMARY KEY,
  operator_id TEXT NOT NULL UNIQUE REFERENCES operators(id),
  workspace_id TEXT NOT NULL REFERENCES workspace_settings(id),
  actor_operator_id TEXT REFERENCES operators(id),
  successor_operator_id TEXT NOT NULL REFERENCES operators(id),
  created_at TEXT NOT NULL
);
