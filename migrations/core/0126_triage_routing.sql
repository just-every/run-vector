-- Routing changes placement only for a source record's first native creation.
CREATE TABLE triage_routing_configs (
  workspace_id TEXT NOT NULL REFERENCES workspace_settings(id) ON DELETE CASCADE,
  scope_key TEXT NOT NULL,
  team_id TEXT REFERENCES teams(id) ON DELETE CASCADE,
  version INTEGER NOT NULL CHECK(version > 0),
  configured_by TEXT REFERENCES operators(id) ON DELETE SET NULL,
  rules_json TEXT NOT NULL CHECK(json_valid(rules_json) AND json_type(rules_json)='array'),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY(workspace_id,scope_key),
  CHECK((team_id IS NULL AND scope_key='workspace') OR (team_id IS NOT NULL AND scope_key=team_id))
);
ALTER TABLE issues ADD COLUMN triage_route_json TEXT CHECK(triage_route_json IS NULL OR json_valid(triage_route_json));
