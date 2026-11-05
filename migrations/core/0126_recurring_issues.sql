-- Weekly native series retain durable identities; activation is installation-local consent.
CREATE TABLE recurring_issue_series (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspace_settings(id),
  configuring_operator_id TEXT NOT NULL,
  team_id TEXT NOT NULL REFERENCES teams(id),
  template_id TEXT NOT NULL,
  template_version INTEGER NOT NULL CHECK(template_version>0),
  name TEXT NOT NULL,
  timezone TEXT NOT NULL,
  starts_on TEXT NOT NULL,
  next_on TEXT NOT NULL,
  due_offset_days INTEGER CHECK(due_offset_days BETWEEN 0 AND 365),
  skip_while_open INTEGER NOT NULL CHECK(skip_while_open IN(0,1)),
  overrides_json TEXT NOT NULL CHECK(json_valid(overrides_json)),
  state TEXT NOT NULL DEFAULT 'enabled' CHECK(state IN('enabled','paused','ended')),
  version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),
  last_issue_id TEXT,
  last_error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX recurring_issue_series_due_idx ON recurring_issue_series(state,next_on,id);
CREATE TABLE recurring_issue_occurrences (
  series_id TEXT NOT NULL REFERENCES recurring_issue_series(id),
  due_on TEXT NOT NULL,
  scheduled_at TEXT NOT NULL,
  template_id TEXT NOT NULL,
  template_version INTEGER NOT NULL,
  outcome TEXT NOT NULL CHECK(outcome IN('created','skipped','failed')),
  issue_id TEXT,
  child_ids_json TEXT NOT NULL CHECK(json_valid(child_ids_json)),
  error TEXT,
  created_at TEXT NOT NULL,
  PRIMARY KEY(series_id,due_on),
  CHECK((outcome='created' AND issue_id IS NOT NULL AND error IS NULL) OR
    (outcome<>'created' AND issue_id IS NULL))
);
CREATE UNIQUE INDEX recurring_issue_occurrence_issue_idx ON recurring_issue_occurrences(issue_id) WHERE issue_id IS NOT NULL;
CREATE TABLE recurring_issue_activations (
  series_id TEXT PRIMARY KEY REFERENCES recurring_issue_series(id)
);
