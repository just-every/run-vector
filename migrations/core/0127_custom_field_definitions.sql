-- FIELD-001: typed custom-field definitions and their single-select options.
-- Issue values stay in issues.custom_fields_json, keyed by definition ID with the
-- option ID as the value. Legacy untyped keys and historical values are retained
-- unchanged; nothing here rewrites an existing issue.
CREATE TABLE custom_field_definitions (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspace_settings(id),
  team_id TEXT REFERENCES teams(id),
  name TEXT NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 120),
  description TEXT NOT NULL DEFAULT '' CHECK(length(description) <= 2000),
  type TEXT NOT NULL CHECK(type IN ('text','number','single_select','multi_select','date','person','url','checkbox')),
  version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
-- A name is unique within its team, whatever its letter case.
CREATE UNIQUE INDEX custom_field_definitions_team_name ON custom_field_definitions(team_id,name COLLATE NOCASE) WHERE team_id IS NOT NULL;
CREATE TABLE custom_field_options (
  id TEXT PRIMARY KEY,
  field_id TEXT NOT NULL REFERENCES custom_field_definitions(id),
  name TEXT NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 120),
  position INTEGER NOT NULL CHECK(position>=0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX custom_field_options_name ON custom_field_options(field_id,name COLLATE NOCASE);
CREATE UNIQUE INDEX custom_field_options_position ON custom_field_options(field_id,position);
