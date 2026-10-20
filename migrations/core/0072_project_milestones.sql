-- Forward-only milestone planning. Existing issue assignments remain untouched.
CREATE TABLE project_milestones (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 120),
  description TEXT NOT NULL DEFAULT '',
  target_date TEXT CHECK(target_date IS NULL OR (length(target_date)=10 AND date(target_date,'+0 days') IS target_date)),
  position INTEGER NOT NULL CHECK(position>=0),
  completed INTEGER NOT NULL DEFAULT 0 CHECK(completed IN (0,1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX project_milestones_position_idx ON project_milestones(project_id,position);
ALTER TABLE issues ADD COLUMN milestone_id TEXT REFERENCES project_milestones(id) ON DELETE SET NULL;
CREATE INDEX issues_milestone_idx ON issues(milestone_id);

CREATE TRIGGER issue_milestone_insert BEFORE INSERT ON issues
WHEN NEW.milestone_id IS NOT NULL AND NOT EXISTS(
  SELECT 1 FROM project_milestones WHERE id=NEW.milestone_id AND project_id=NEW.project_id
)
BEGIN SELECT RAISE(ABORT,'invalid_project_milestone'); END;

-- A project-only move may carry the old milestone until the AFTER trigger clears
-- it. An explicitly changed assignment must already belong to the destination.
CREATE TRIGGER issue_milestone_update BEFORE UPDATE OF milestone_id,project_id ON issues
WHEN NEW.milestone_id IS NOT NULL
 AND (NEW.milestone_id IS NOT OLD.milestone_id OR NEW.project_id IS OLD.project_id)
 AND NOT EXISTS(SELECT 1 FROM project_milestones WHERE id=NEW.milestone_id AND project_id=NEW.project_id)
BEGIN SELECT RAISE(ABORT,'invalid_project_milestone'); END;

CREATE TRIGGER issue_milestone_project_move AFTER UPDATE OF project_id ON issues
WHEN NEW.milestone_id IS NOT NULL AND NOT EXISTS(
  SELECT 1 FROM project_milestones WHERE id=NEW.milestone_id AND project_id=NEW.project_id
)
BEGIN UPDATE issues SET milestone_id=NULL WHERE id=NEW.id; END;

-- Milestones belong to one project for their lifetime; moving them would leave
-- existing issue assignments outside their project.
CREATE TRIGGER project_milestone_project_immutable BEFORE UPDATE OF project_id ON project_milestones
WHEN NEW.project_id IS NOT OLD.project_id
BEGIN SELECT RAISE(ABORT,'milestone_project_immutable'); END;
