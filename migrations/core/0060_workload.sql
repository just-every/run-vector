-- Personal planning capacity belongs to an exact cycle or due-date window.
CREATE TABLE workload_capacities (
  workspace_id TEXT NOT NULL REFERENCES workspace_settings(id),
  operator_id TEXT NOT NULL REFERENCES operators(id),
  scope_key TEXT NOT NULL,
  capacity INTEGER CHECK (capacity IS NULL OR (capacity >= 0 AND capacity <= 100000)),
  version INTEGER NOT NULL CHECK (version > 0),
  updated_at TEXT NOT NULL,
  PRIMARY KEY (workspace_id, operator_id, scope_key)
);
