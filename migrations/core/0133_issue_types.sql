-- ISSUE-021: team type identities and required typed fields are portable domain state.
ALTER TABLE teams ADD COLUMN issue_types_enabled INTEGER NOT NULL DEFAULT 0 CHECK(issue_types_enabled IN (0,1));
CREATE TABLE issue_types (
 id TEXT PRIMARY KEY,
 team_id TEXT NOT NULL REFERENCES teams(id),
 default_key TEXT NOT NULL CHECK(default_key IN ('bug','feature','task','epic')),
 name TEXT NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 120),
 icon TEXT NOT NULL CHECK(length(icon) BETWEEN 1 AND 32),
 position INTEGER NOT NULL CHECK(position>=0),
 version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL,
 UNIQUE(team_id,default_key),
 UNIQUE(team_id,name COLLATE NOCASE)
);
CREATE TABLE issue_type_required_fields (
 type_id TEXT NOT NULL REFERENCES issue_types(id),
 field_id TEXT NOT NULL REFERENCES custom_field_definitions(id),
 PRIMARY KEY(type_id,field_id)
);
ALTER TABLE issues ADD COLUMN issue_type_id TEXT REFERENCES issue_types(id);
CREATE INDEX issues_type_idx ON issues(issue_type_id);
-- These guards enforce the admitted typed boundary at commit, including writers
-- which do not accept fields themselves, and roll the whole native batch back.
CREATE TRIGGER issue_type_insert BEFORE INSERT ON issues BEGIN
 SELECT CASE WHEN NEW.issue_type_id IS NOT NULL AND NOT EXISTS(
  SELECT 1 FROM issue_types ty JOIN teams t ON t.id=ty.team_id
  WHERE ty.id=NEW.issue_type_id AND t.id=NEW.team_id
 ) THEN RAISE(ABORT,'issue_type_unavailable') END;
 SELECT CASE WHEN EXISTS(SELECT 1 FROM issue_type_required_fields r
  WHERE r.type_id=NEW.issue_type_id AND NOT EXISTS(
   SELECT 1 FROM custom_field_definitions d JOIN custom_field_options o ON o.field_id=d.id
   JOIN json_each(NEW.custom_fields_json) v ON v.key=d.id AND v.value=o.id
   WHERE d.id=r.field_id AND d.team_id=NEW.team_id
  )) THEN RAISE(ABORT,'issue_type_required_field') END;
END;
CREATE TRIGGER issue_type_update BEFORE UPDATE OF team_id,issue_type_id,custom_fields_json ON issues BEGIN
 SELECT CASE WHEN NEW.issue_type_id IS NOT NULL AND NOT EXISTS(
  SELECT 1 FROM issue_types ty WHERE ty.id=NEW.issue_type_id AND ty.team_id=NEW.team_id
 ) THEN RAISE(ABORT,'issue_type_unavailable') END;
 SELECT CASE WHEN NEW.team_id IS OLD.team_id AND NEW.issue_type_id IS NOT OLD.issue_type_id AND NOT EXISTS(
  SELECT 1 FROM teams t WHERE t.id=NEW.team_id AND t.issue_types_enabled=1
 ) THEN RAISE(ABORT,'issue_type_unavailable') END;
 SELECT CASE WHEN EXISTS(SELECT 1 FROM issue_type_required_fields r
  WHERE r.type_id=NEW.issue_type_id AND NOT EXISTS(
   SELECT 1 FROM custom_field_definitions d JOIN custom_field_options o ON o.field_id=d.id
   JOIN json_each(NEW.custom_fields_json) v ON v.key=d.id AND v.value=o.id
   WHERE d.id=r.field_id AND d.team_id=NEW.team_id
  )) THEN RAISE(ABORT,'issue_type_required_field') END;
END;
CREATE TRIGGER issue_type_requirement_insert BEFORE INSERT ON issue_type_required_fields BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM issue_types ty JOIN custom_field_definitions d ON d.team_id=ty.team_id
  WHERE ty.id=NEW.type_id AND d.id=NEW.field_id AND d.type='single_select')
  THEN RAISE(ABORT,'issue_type_required_field') END;
 SELECT CASE WHEN EXISTS(SELECT 1 FROM issues i WHERE i.issue_type_id=NEW.type_id AND NOT EXISTS(
  SELECT 1 FROM custom_field_options o JOIN json_each(i.custom_fields_json) v ON v.key=o.field_id AND v.value=o.id
  WHERE o.field_id=NEW.field_id)) THEN RAISE(ABORT,'issue_type_required_field') END;
END;
CREATE TRIGGER issue_types_revision_update AFTER UPDATE ON issue_types BEGIN
 UPDATE issue_list_revision SET revision=revision+1 WHERE id=1;
END;
CREATE TRIGGER issue_types_team_revision AFTER UPDATE OF issue_types_enabled ON teams BEGIN
 UPDATE issue_list_revision SET revision=revision+1 WHERE id=1;
END;
