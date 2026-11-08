-- Forward-only hierarchy. Existing teams remain independent roots.
ALTER TABLE teams ADD COLUMN parent_team_id TEXT;
ALTER TABLE teams ADD COLUMN workflow_inherited INTEGER NOT NULL DEFAULT 0 CHECK(workflow_inherited IN (0,1));
ALTER TABLE teams ADD COLUMN permissions_inherited INTEGER NOT NULL DEFAULT 0 CHECK(permissions_inherited IN (0,1));
ALTER TABLE teams ADD COLUMN hierarchy_version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE workflow_statuses ADD COLUMN inherited_from TEXT;
CREATE INDEX teams_parent_idx ON teams(parent_team_id);
CREATE UNIQUE INDEX workflow_inherited_idx ON workflow_statuses(team_id,inherited_from) WHERE inherited_from IS NOT NULL;
