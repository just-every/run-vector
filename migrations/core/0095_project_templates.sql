CREATE TABLE project_templates (
 id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES workspace_settings(id) ON DELETE CASCADE,
 team_id TEXT REFERENCES teams(id) ON DELETE CASCADE, name TEXT NOT NULL, description TEXT NOT NULL,
 cadence TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE project_template_milestones (template_id TEXT NOT NULL REFERENCES project_templates(id) ON DELETE CASCADE, position INTEGER NOT NULL, name TEXT NOT NULL, description TEXT NOT NULL, offset_days INTEGER, PRIMARY KEY(template_id,position));
CREATE TABLE project_template_labels (template_id TEXT NOT NULL REFERENCES project_templates(id) ON DELETE CASCADE, name TEXT NOT NULL, PRIMARY KEY(template_id,name));
CREATE TABLE project_template_issues (template_id TEXT NOT NULL REFERENCES project_templates(id) ON DELETE CASCADE, position INTEGER NOT NULL, title TEXT NOT NULL, description TEXT NOT NULL, priority TEXT NOT NULL, offset_days INTEGER, milestone_position INTEGER, PRIMARY KEY(template_id,position));
