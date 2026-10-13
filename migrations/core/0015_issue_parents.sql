-- One optional parent per issue, kept beside the issue record so existing
-- issue rows are not rewritten. Deleting either issue removes the link, so the
-- direct children of a deleted parent become root issues.
CREATE TABLE issue_parents (
  issue_id TEXT PRIMARY KEY REFERENCES issues(id) ON DELETE CASCADE,
  parent_issue_id TEXT NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL
);
CREATE INDEX issue_parents_parent_idx ON issue_parents(parent_issue_id, issue_id);

CREATE TRIGGER issue_parents_insert_guard BEFORE INSERT ON issue_parents
BEGIN
  SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM issues c JOIN teams ct ON ct.id=c.team_id JOIN issues p ON p.id=NEW.parent_issue_id JOIN teams pt ON pt.id=p.team_id WHERE c.id=NEW.issue_id AND pt.workspace_id=ct.workspace_id) THEN RAISE(ABORT,'issue_parent_workspace') END;
  SELECT CASE WHEN EXISTS(WITH RECURSIVE ancestors(id) AS (SELECT NEW.parent_issue_id UNION SELECT r.parent_issue_id FROM issue_parents r JOIN ancestors a ON r.issue_id=a.id) SELECT 1 FROM ancestors WHERE id=NEW.issue_id) THEN RAISE(ABORT,'issue_parent_cycle') END;
END;
CREATE TRIGGER issue_parents_update_guard BEFORE UPDATE OF issue_id,parent_issue_id ON issue_parents
BEGIN
  SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM issues c JOIN teams ct ON ct.id=c.team_id JOIN issues p ON p.id=NEW.parent_issue_id JOIN teams pt ON pt.id=p.team_id WHERE c.id=NEW.issue_id AND pt.workspace_id=ct.workspace_id) THEN RAISE(ABORT,'issue_parent_workspace') END;
  SELECT CASE WHEN EXISTS(WITH RECURSIVE ancestors(id) AS (SELECT NEW.parent_issue_id UNION SELECT r.parent_issue_id FROM issue_parents r JOIN ancestors a ON r.issue_id=a.id) SELECT 1 FROM ancestors WHERE id=NEW.issue_id) THEN RAISE(ABORT,'issue_parent_cycle') END;
END;
-- A linked issue cannot move to a team in another workspace.
CREATE TRIGGER issues_parent_team_guard BEFORE UPDATE OF team_id ON issues
WHEN NEW.team_id<>OLD.team_id
BEGIN
  SELECT CASE WHEN EXISTS(SELECT 1 FROM issue_parents r JOIN issues p ON p.id=r.parent_issue_id JOIN teams pt ON pt.id=p.team_id JOIN teams nt ON nt.id=NEW.team_id WHERE r.issue_id=NEW.id AND pt.workspace_id<>nt.workspace_id)
    OR EXISTS(SELECT 1 FROM issue_parents r JOIN issues c ON c.id=r.issue_id JOIN teams ct ON ct.id=c.team_id JOIN teams nt ON nt.id=NEW.team_id WHERE r.parent_issue_id=NEW.id AND ct.workspace_id<>nt.workspace_id) THEN RAISE(ABORT,'issue_parent_workspace') END;
END;
CREATE TRIGGER teams_parent_workspace_guard BEFORE UPDATE OF workspace_id ON teams
WHEN NEW.workspace_id<>OLD.workspace_id
BEGIN
  SELECT CASE WHEN EXISTS(SELECT 1 FROM issue_parents r JOIN issues c ON c.id=r.issue_id JOIN issues p ON p.id=r.parent_issue_id JOIN teams ct ON ct.id=c.team_id JOIN teams pt ON pt.id=p.team_id WHERE
    (c.team_id=NEW.id AND p.team_id<>NEW.id AND pt.workspace_id<>NEW.workspace_id) OR
    (p.team_id=NEW.id AND c.team_id<>NEW.id AND ct.workspace_id<>NEW.workspace_id)) THEN RAISE(ABORT,'issue_parent_workspace') END;
END;
