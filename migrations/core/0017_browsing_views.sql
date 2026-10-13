-- Additive browsing state. Retain columns and indexes on application rollback.
ALTER TABLE saved_views ADD COLUMN layout TEXT NOT NULL DEFAULT 'list' CHECK(layout IN ('list','board'));
CREATE INDEX issues_browse_created ON issues(team_id,created_at DESC,identifier);
CREATE INDEX issues_browse_updated ON issues(team_id,updated_at DESC,identifier);
CREATE INDEX issues_browse_priority ON issues(team_id,priority,identifier);
CREATE INDEX issues_browse_due ON issues(team_id,due_date,identifier);
CREATE INDEX saved_views_workspace_visibility ON saved_views(workspace_id,is_shared,owner_operator_id,name);
