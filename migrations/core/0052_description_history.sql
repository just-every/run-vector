-- Immutable description values. Older activity did not record issue versions;
-- unknown historical versions stay NULL rather than inventing concurrency data.
CREATE TABLE issue_description_revisions (
 id TEXT PRIMARY KEY,
 issue_id TEXT NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
 description TEXT NOT NULL,
 actor_operator_id TEXT REFERENCES operators(id),
 actor_name TEXT,
 created_at TEXT NOT NULL,
 version INTEGER CHECK(version IS NULL OR version>0)
);
CREATE INDEX issue_description_revisions_issue ON issue_description_revisions(issue_id,created_at);
-- Older source/import creation events sometimes omitted description. The first
-- edit's previous value still preserves that original description.
INSERT INTO issue_description_revisions(id,issue_id,description,actor_operator_id,actor_name,created_at,version)
 SELECT 'initial:'||a.id,a.issue_id,json_extract(a.previous_value_json,'$.description'),
   (SELECT actor_operator_id FROM issue_activity WHERE issue_id=a.issue_id ORDER BY created_at,rowid LIMIT 1),
   (SELECT actor_name FROM issue_activity WHERE issue_id=a.issue_id ORDER BY created_at,rowid LIMIT 1),
   i.created_at,NULL
 FROM issue_activity a JOIN issues i ON i.id=a.issue_id
 WHERE json_type(a.previous_value_json,'$.description')='text'
 AND a.id=(SELECT first.id FROM issue_activity first WHERE first.issue_id=a.issue_id AND json_type(first.next_value_json,'$.description')='text' ORDER BY first.created_at,first.rowid LIMIT 1)
 AND NOT EXISTS(SELECT 1 FROM issue_activity initial WHERE initial.issue_id=a.issue_id AND initial.kind='issue.created' AND json_type(initial.next_value_json,'$.description')='text');
INSERT INTO issue_description_revisions(id,issue_id,description,actor_operator_id,actor_name,created_at,version)
 SELECT a.id,a.issue_id,json_extract(a.next_value_json,'$.description'),a.actor_operator_id,a.actor_name,a.created_at,NULL
 FROM issue_activity a WHERE json_type(a.next_value_json,'$.description')='text'
 AND (a.kind='issue.created' OR json_extract(a.previous_value_json,'$.description') IS NOT json_extract(a.next_value_json,'$.description'))
 ORDER BY a.created_at,a.id;
-- Establish an exact current-version checkpoint for pre-upgrade checklist clicks.
-- A repeated current value does not add a duplicate revision.
UPDATE issue_description_revisions SET version=(SELECT version FROM issues WHERE id=issue_id)
 WHERE id=(SELECT r.id FROM issue_description_revisions r WHERE r.issue_id=issue_description_revisions.issue_id ORDER BY r.created_at DESC,r.rowid DESC LIMIT 1)
 AND description=(SELECT description FROM issues WHERE id=issue_id);
INSERT INTO issue_description_revisions(id,issue_id,description,created_at,version)
 SELECT 'baseline:'||i.id,i.id,i.description,i.updated_at,i.version FROM issues i
 WHERE NOT EXISTS(SELECT 1 FROM issue_description_revisions r WHERE r.issue_id=i.id AND r.version=i.version);

-- Native creation, operator intake, imported issues and signed source intake all
-- write their first activity in their issue transaction. Edit plans write the
-- changed description activity before updating the issue's version.
CREATE TRIGGER issue_description_activity AFTER INSERT ON issue_activity
 WHEN NOT EXISTS(SELECT 1 FROM issue_description_revisions WHERE issue_id=NEW.issue_id)
 OR json_type(NEW.next_value_json,'$.descriptionRestore')='object'
 OR (json_type(NEW.next_value_json,'$.description')='text'
   AND json_extract(NEW.previous_value_json,'$.description') IS NOT json_extract(NEW.next_value_json,'$.description'))
 BEGIN
 INSERT INTO issue_description_revisions(id,issue_id,description,actor_operator_id,actor_name,created_at,version)
 SELECT NEW.id,i.id,
   CASE WHEN json_type(NEW.next_value_json,'$.description')='text' THEN json_extract(NEW.next_value_json,'$.description') ELSE i.description END,
   NEW.actor_operator_id,NEW.actor_name,NEW.created_at,
   i.version+CASE WHEN NEW.kind='issue.updated' OR (json_type(NEW.next_value_json,'$.description')='text' AND i.description IS NOT json_extract(NEW.next_value_json,'$.description')) THEN 1 ELSE 0 END
 FROM issues i WHERE i.id=NEW.issue_id;
 END;
