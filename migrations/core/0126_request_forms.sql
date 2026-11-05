-- Native request definitions and immutable submitted answers are portable data.
CREATE TABLE request_forms (
  id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  fields_json TEXT NOT NULL CHECK(json_valid(fields_json)),
  published INTEGER NOT NULL DEFAULT 1 CHECK(published IN (0,1)),
  revision INTEGER NOT NULL DEFAULT 1 CHECK(revision>0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX request_forms_team ON request_forms(team_id,name,id);
CREATE TABLE request_form_revisions (
  form_id TEXT NOT NULL REFERENCES request_forms(id) ON DELETE CASCADE,
  revision INTEGER NOT NULL,
  name TEXT NOT NULL,
  fields_json TEXT NOT NULL CHECK(json_valid(fields_json)),
  published INTEGER NOT NULL CHECK(published IN (0,1)),
  created_at TEXT NOT NULL,
  PRIMARY KEY(form_id,revision)
);
CREATE TABLE request_form_submissions (
  issue_id TEXT PRIMARY KEY REFERENCES issues(id) ON DELETE CASCADE,
  form_id TEXT NOT NULL,
  revision INTEGER NOT NULL,
  form_name TEXT NOT NULL,
  fields_json TEXT NOT NULL CHECK(json_valid(fields_json)),
  answers_json TEXT NOT NULL CHECK(json_valid(answers_json)),
  created_at TEXT NOT NULL,
  FOREIGN KEY(form_id,revision) REFERENCES request_form_revisions(form_id,revision)
);
