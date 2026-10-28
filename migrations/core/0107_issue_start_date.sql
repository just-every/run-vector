ALTER TABLE issues ADD COLUMN start_date TEXT;

CREATE INDEX issues_start_date ON issues(start_date) WHERE start_date IS NOT NULL;

CREATE TRIGGER issues_start_date_insert BEFORE INSERT ON issues
WHEN NEW.start_date IS NOT NULL AND NEW.due_date IS NOT NULL AND NEW.start_date > NEW.due_date
BEGIN
  SELECT RAISE(ABORT, 'issue_start_after_due');
END;

CREATE TRIGGER issues_start_date_update BEFORE UPDATE OF start_date,due_date ON issues
WHEN NEW.start_date IS NOT NULL AND NEW.due_date IS NOT NULL AND NEW.start_date > NEW.due_date
BEGIN
  SELECT RAISE(ABORT, 'issue_start_after_due');
END;

ALTER TABLE project_template_issues ADD COLUMN start_offset_days INTEGER;
