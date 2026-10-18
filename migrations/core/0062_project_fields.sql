-- Forward-only project planning fields; existing projects retain their dates and labels.
ALTER TABLE projects ADD COLUMN start_date TEXT;
ALTER TABLE projects ADD COLUMN priority TEXT NOT NULL DEFAULT 'none'
  CHECK (priority IN ('urgent','high','medium','low','none'));
ALTER TABLE labels ADD COLUMN projects_enabled INTEGER NOT NULL DEFAULT 0
  CHECK (projects_enabled IN (0,1));
CREATE TABLE project_labels (
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  label_id TEXT NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  PRIMARY KEY (project_id,label_id)
);
CREATE INDEX project_labels_label_idx ON project_labels(label_id,project_id);
CREATE TRIGGER project_dates_insert BEFORE INSERT ON projects
WHEN (NEW.start_date IS NOT NULL AND (length(NEW.start_date)<>10 OR date(NEW.start_date,'+0 days') IS NOT NEW.start_date))
 OR (NEW.target_date IS NOT NULL AND (length(NEW.target_date)<>10 OR date(NEW.target_date,'+0 days') IS NOT NEW.target_date))
 OR (NEW.start_date IS NOT NULL AND NEW.target_date IS NOT NULL AND NEW.target_date<NEW.start_date)
BEGIN SELECT RAISE(ABORT,'invalid_project_dates'); END;
CREATE TRIGGER project_dates_update BEFORE UPDATE OF start_date,target_date ON projects
WHEN (NEW.start_date IS NOT NULL AND (length(NEW.start_date)<>10 OR date(NEW.start_date,'+0 days') IS NOT NEW.start_date))
 OR (NEW.target_date IS NOT NULL AND (length(NEW.target_date)<>10 OR date(NEW.target_date,'+0 days') IS NOT NEW.target_date))
 OR (NEW.start_date IS NOT NULL AND NEW.target_date IS NOT NULL AND NEW.target_date<NEW.start_date)
BEGIN SELECT RAISE(ABORT,'invalid_project_dates'); END;
CREATE TRIGGER project_label_admission BEFORE INSERT ON project_labels
WHEN NOT EXISTS(SELECT 1 FROM projects p JOIN labels l ON l.workspace_id=p.workspace_id WHERE p.id=NEW.project_id AND l.id=NEW.label_id AND l.projects_enabled=1)
BEGIN SELECT RAISE(ABORT,'invalid_project_label'); END;
CREATE TRIGGER project_label_update_admission BEFORE UPDATE ON project_labels
WHEN NOT EXISTS(SELECT 1 FROM projects p JOIN labels l ON l.workspace_id=p.workspace_id WHERE p.id=NEW.project_id AND l.id=NEW.label_id AND l.projects_enabled=1)
BEGIN SELECT RAISE(ABORT,'invalid_project_label'); END;
CREATE TRIGGER project_label_usage BEFORE UPDATE OF projects_enabled ON labels
WHEN NEW.projects_enabled=0 AND EXISTS(SELECT 1 FROM project_labels WHERE label_id=OLD.id)
BEGIN SELECT RAISE(ABORT,'project_label_in_use'); END;
