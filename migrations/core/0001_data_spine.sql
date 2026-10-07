PRAGMA foreign_keys = ON;

CREATE TABLE workspace_settings (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  timezone TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE operators (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspace_settings(id),
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  removed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE operator_sessions (
  id TEXT PRIMARY KEY,
  operator_id TEXT NOT NULL REFERENCES operators(id),
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE teams (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspace_settings(id),
  name TEXT NOT NULL,
  identifier_prefix TEXT NOT NULL COLLATE NOCASE,
  archived_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (workspace_id, name),
  UNIQUE (workspace_id, identifier_prefix),
  CHECK (length(identifier_prefix) BETWEEN 2 AND 10),
  CHECK (identifier_prefix = upper(identifier_prefix))
);

CREATE TABLE workflow_statuses (
  id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL REFERENCES teams(id),
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('intake', 'backlog', 'unstarted', 'started', 'completed', 'canceled', 'duplicate')),
  position INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (team_id, name),
  UNIQUE (team_id, position)
);

CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspace_settings(id),
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  lead_operator_id TEXT NOT NULL REFERENCES operators(id),
  target_date TEXT,
  lifecycle TEXT NOT NULL CHECK (lifecycle IN ('planned', 'active', 'completed', 'canceled')),
  color TEXT,
  icon TEXT,
  archived_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (workspace_id, name)
);

CREATE TABLE cycles (
  id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL REFERENCES teams(id),
  name TEXT NOT NULL,
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  capacity INTEGER,
  closed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (team_id, name),
  CHECK (ends_at > starts_at),
  CHECK (capacity IS NULL OR capacity >= 0)
);

CREATE TABLE labels (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspace_settings(id),
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (workspace_id, name)
);

CREATE TABLE issues (
  id TEXT PRIMARY KEY,
  identifier TEXT NOT NULL UNIQUE,
  origin_prefix TEXT NOT NULL,
  sequence_number INTEGER NOT NULL,
  team_id TEXT NOT NULL REFERENCES teams(id),
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status_id TEXT NOT NULL REFERENCES workflow_statuses(id),
  priority TEXT NOT NULL CHECK (priority IN ('urgent', 'high', 'medium', 'low', 'none')),
  assignee_operator_id TEXT REFERENCES operators(id),
  project_id TEXT REFERENCES projects(id),
  cycle_id TEXT REFERENCES cycles(id),
  due_date TEXT,
  estimate INTEGER,
  expected_outcome TEXT,
  customer_impact TEXT,
  custom_fields_json TEXT NOT NULL DEFAULT '{}',
  deferred_until TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  completed_at TEXT,
  canceled_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (sequence_number > 0),
  CHECK (estimate IS NULL OR estimate BETWEEN 1 AND 100)
);

CREATE TABLE issue_labels (
  issue_id TEXT NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  label_id TEXT NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  PRIMARY KEY (issue_id, label_id)
);

CREATE TABLE issue_dependencies (
  blocked_issue_id TEXT NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  blocking_issue_id TEXT NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  PRIMARY KEY (blocked_issue_id, blocking_issue_id),
  CHECK (blocked_issue_id <> blocking_issue_id)
);

CREATE TABLE evidence_revisions (
  id TEXT PRIMARY KEY,
  issue_id TEXT NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  source_name TEXT NOT NULL,
  observed_at TEXT NOT NULL,
  received_at TEXT NOT NULL,
  summary TEXT NOT NULL,
  measurements_json TEXT NOT NULL DEFAULT '{}',
  assertions_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE intake_decisions (
  id TEXT PRIMARY KEY,
  issue_id TEXT NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  actor_operator_id TEXT NOT NULL REFERENCES operators(id),
  kind TEXT NOT NULL CHECK (kind IN ('accepted', 'deferred', 'declined')),
  reason TEXT,
  return_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE issue_activity (
  id TEXT PRIMARY KEY,
  issue_id TEXT NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  actor_operator_id TEXT REFERENCES operators(id),
  kind TEXT NOT NULL,
  previous_value_json TEXT,
  next_value_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE saved_views (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspace_settings(id),
  owner_operator_id TEXT NOT NULL REFERENCES operators(id),
  name TEXT NOT NULL,
  surface TEXT NOT NULL,
  is_shared INTEGER NOT NULL DEFAULT 0 CHECK (is_shared IN (0, 1)),
  filters_json TEXT NOT NULL DEFAULT '{}',
  sort TEXT NOT NULL DEFAULT 'newest',
  grouping TEXT NOT NULL DEFAULT 'none',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (owner_operator_id, name)
);

CREATE TABLE list_preferences (
  id TEXT PRIMARY KEY,
  operator_id TEXT NOT NULL REFERENCES operators(id) ON DELETE CASCADE,
  surface TEXT NOT NULL,
  filters_json TEXT NOT NULL DEFAULT '{}',
  sort TEXT NOT NULL DEFAULT 'newest',
  grouping TEXT NOT NULL DEFAULT 'none',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (operator_id, surface)
);

CREATE INDEX issues_team_status_idx ON issues(team_id, status_id);
CREATE INDEX issues_assignee_idx ON issues(assignee_operator_id);
CREATE INDEX issues_project_idx ON issues(project_id);
CREATE INDEX issues_cycle_idx ON issues(cycle_id);
CREATE INDEX evidence_revisions_issue_idx ON evidence_revisions(issue_id, observed_at, received_at);
CREATE INDEX issue_activity_issue_idx ON issue_activity(issue_id, created_at);
