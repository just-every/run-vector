-- Expand durable administration history; existing product rows remain unchanged.
CREATE TABLE administration_audit_details (
  audit_id TEXT PRIMARY KEY REFERENCES audit_records(id),
  previous_value_json TEXT,
  next_value_json TEXT
);
CREATE TABLE team_issue_history (
  team_id TEXT PRIMARY KEY REFERENCES teams(id),
  first_issue_at TEXT NOT NULL
);
-- Prefixes can be released before the first issue, but allocated numbers can
-- never be reused, even when another team subsequently takes that prefix.
CREATE TABLE issue_prefix_sequences (
  workspace_id TEXT NOT NULL REFERENCES workspace_settings(id),
  identifier_prefix TEXT NOT NULL COLLATE NOCASE,
  last_sequence INTEGER NOT NULL CHECK (last_sequence > 0),
  updated_at TEXT NOT NULL,
  PRIMARY KEY (workspace_id,identifier_prefix)
);
INSERT INTO issue_prefix_sequences(workspace_id,identifier_prefix,last_sequence,updated_at)
SELECT workspace_id,identifier_prefix,MAX(last_sequence),MAX(updated_at) FROM (
  SELECT t.workspace_id,t.identifier_prefix,s.last_sequence,s.updated_at
  FROM team_issue_sequences s JOIN teams t ON t.id=s.team_id
  UNION ALL
  SELECT t.workspace_id,i.origin_prefix,i.sequence_number,i.updated_at
  FROM issues i JOIN teams t ON t.id=i.team_id
) GROUP BY workspace_id,identifier_prefix COLLATE NOCASE;
-- Before this migration, reservations are the only durable evidence of an
-- originating issue after deletion. Preserve that legacy history conservatively.
-- New reservations alone do not freeze a prefix; only committed issues do.
INSERT INTO team_issue_history(team_id,first_issue_at)
SELECT team_id,MIN(at) FROM (
  SELECT team_id,created_at AS at FROM issues
  UNION ALL SELECT team_id,updated_at AS at FROM team_issue_sequences
  UNION ALL SELECT json_extract(previous_value_json,'$.teamId'),created_at FROM issue_activity
    WHERE kind='issue.team_moved' AND json_valid(previous_value_json)
  UNION ALL SELECT json_extract(next_value_json,'$.teamId'),created_at FROM issue_activity
    WHERE kind='issue.team_moved' AND json_valid(next_value_json)
) WHERE team_id IN (SELECT id FROM teams) GROUP BY team_id;
CREATE TRIGGER remember_issue_team_insert AFTER INSERT ON issues BEGIN
  INSERT OR IGNORE INTO team_issue_history(team_id,first_issue_at) VALUES(NEW.team_id,NEW.created_at);
  INSERT INTO issue_prefix_sequences(workspace_id,identifier_prefix,last_sequence,updated_at)
    SELECT workspace_id,NEW.origin_prefix,NEW.sequence_number,NEW.updated_at FROM teams WHERE id=NEW.team_id
    ON CONFLICT(workspace_id,identifier_prefix) DO UPDATE
    SET last_sequence=excluded.last_sequence,updated_at=excluded.updated_at
    WHERE excluded.last_sequence>issue_prefix_sequences.last_sequence;
END;
CREATE TRIGGER remember_issue_team_move AFTER UPDATE OF team_id ON issues BEGIN
  INSERT OR IGNORE INTO team_issue_history(team_id,first_issue_at) VALUES(NEW.team_id,NEW.updated_at);
END;
CREATE TRIGGER team_prefix_valid_insert BEFORE INSERT ON teams
WHEN length(NEW.identifier_prefix) NOT BETWEEN 2 AND 10 OR NEW.identifier_prefix GLOB '*[^A-Z]*'
BEGIN SELECT RAISE(ABORT,'invalid_team_prefix'); END;
CREATE TRIGGER team_prefix_valid_update BEFORE UPDATE OF identifier_prefix ON teams
WHEN NEW.identifier_prefix<>OLD.identifier_prefix COLLATE BINARY AND (length(NEW.identifier_prefix) NOT BETWEEN 2 AND 10 OR NEW.identifier_prefix GLOB '*[^A-Z]*')
BEGIN SELECT RAISE(ABORT,'invalid_team_prefix'); END;
CREATE TRIGGER team_prefix_history BEFORE UPDATE OF identifier_prefix ON teams
WHEN NEW.identifier_prefix<>OLD.identifier_prefix COLLATE BINARY AND (
 EXISTS(SELECT 1 FROM team_issue_history WHERE team_id=OLD.id) OR
 EXISTS(SELECT 1 FROM issues WHERE team_id=OLD.id))
BEGIN SELECT RAISE(ABORT,'team_prefix_frozen'); END;

-- Retain the existing per-team counter as a mirror for old application SQL.
-- These triggers share the reservation transaction and never create issue history.
CREATE TRIGGER remember_prefix_reservation_insert AFTER INSERT ON team_issue_sequences BEGIN
  INSERT INTO issue_prefix_sequences(workspace_id,identifier_prefix,last_sequence,updated_at)
    SELECT workspace_id,identifier_prefix,NEW.last_sequence,NEW.updated_at FROM teams WHERE id=NEW.team_id
    ON CONFLICT(workspace_id,identifier_prefix) DO UPDATE
    SET last_sequence=excluded.last_sequence,updated_at=excluded.updated_at
    WHERE excluded.last_sequence>issue_prefix_sequences.last_sequence;
END;
CREATE TRIGGER remember_prefix_reservation_update AFTER UPDATE OF last_sequence ON team_issue_sequences BEGIN
  INSERT INTO issue_prefix_sequences(workspace_id,identifier_prefix,last_sequence,updated_at)
    SELECT workspace_id,identifier_prefix,NEW.last_sequence,NEW.updated_at FROM teams WHERE id=NEW.team_id
    ON CONFLICT(workspace_id,identifier_prefix) DO UPDATE
    SET last_sequence=excluded.last_sequence,updated_at=excluded.updated_at
    WHERE excluded.last_sequence>issue_prefix_sequences.last_sequence;
END;
CREATE TRIGGER sync_new_team_prefix_sequence AFTER INSERT ON teams BEGIN
  INSERT INTO team_issue_sequences(team_id,last_sequence,updated_at)
    SELECT NEW.id,last_sequence,updated_at FROM issue_prefix_sequences
    WHERE workspace_id=NEW.workspace_id AND identifier_prefix=NEW.identifier_prefix;
END;
CREATE TRIGGER sync_changed_team_prefix_sequence AFTER UPDATE OF identifier_prefix ON teams
WHEN NEW.identifier_prefix<>OLD.identifier_prefix COLLATE BINARY BEGIN
  DELETE FROM team_issue_sequences WHERE team_id=NEW.id;
  INSERT INTO team_issue_sequences(team_id,last_sequence,updated_at)
    SELECT NEW.id,last_sequence,updated_at FROM issue_prefix_sequences
    WHERE workspace_id=NEW.workspace_id AND identifier_prefix=NEW.identifier_prefix;
END;
