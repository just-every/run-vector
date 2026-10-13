-- Destination-only authority/effect review; archive records keep their source history.
CREATE TABLE vector_restore_status (
 id INTEGER PRIMARY KEY CHECK(id=1), import_id TEXT NOT NULL, effects_held INTEGER NOT NULL CHECK(effects_held IN(0,1)), reviewed_at TEXT
);
CREATE TABLE vector_restore_operator_grants (
 auth_id TEXT PRIMARY KEY REFERENCES oa_operators(id), approved_at TEXT NOT NULL
);
CREATE TABLE vector_restore_mail_holds (
 delivery_id TEXT PRIMARY KEY REFERENCES notification_deliveries(id) ON DELETE CASCADE
);
-- Import completion, derived index rebuild and effect quarantine share D1's commit.
CREATE TRIGGER vector_restore_complete AFTER UPDATE OF phase ON rer_portability_jobs
 WHEN NEW.kind='import' AND NEW.phase='complete' AND OLD.phase!='complete'
 BEGIN
 SELECT CASE WHEN EXISTS(
  SELECT 1 FROM issue_files f WHERE f.deleted_at IS NULL AND NOT EXISTS(
   SELECT 1 FROM json_each(NEW.metadata,'$.manifest.objects') object
   WHERE json_extract(object.value,'$.bucket')='FILES'
   AND json_extract(object.value,'$.key')=f.blob_key
   AND json_extract(object.value,'$.size')=f.bytes
   AND (f.content_sha256 IS NULL OR json_extract(object.value,'$.sha256')=f.content_sha256)
  )
 ) THEN RAISE(ABORT,'archive_attachment_reference') END;
 INSERT INTO vector_restore_status(id,import_id,effects_held) VALUES(1,NEW.id,1)
 ON CONFLICT(id) DO UPDATE SET import_id=excluded.import_id,effects_held=1,reviewed_at=NULL;
 DELETE FROM vector_restore_operator_grants;
 INSERT INTO vector_restore_operator_grants(auth_id,approved_at)
 SELECT m.auth_id,strftime('%Y-%m-%dT%H:%M:%fZ','now') FROM workspace_installation w
 JOIN vector_auth_operators m ON m.operator_id=w.setup_operator_id
 JOIN operators o ON o.id=w.setup_operator_id JOIN oa_operators a ON a.id=m.auth_id
 WHERE o.removed_at IS NULL AND a.status='active';
 INSERT INTO vector_restore_mail_holds(delivery_id) SELECT id FROM notification_deliveries WHERE 1 ON CONFLICT DO NOTHING;
 DELETE FROM search_issues;
 INSERT INTO search_issues(id,text) SELECT id,text FROM search_issue_documents;
 DELETE FROM search_projects;
 INSERT INTO search_projects(id,name) SELECT id,name FROM projects;
 DELETE FROM search_views;
 INSERT INTO search_views(id,name) SELECT id,name FROM saved_views;
 END;
-- A new native invitation is an explicit access grant, not restored membership.
CREATE TRIGGER vector_restore_new_invitation AFTER INSERT ON oa_operators
 WHEN NEW.status='invited' AND EXISTS(SELECT 1 FROM vector_restore_status)
 BEGIN
 INSERT INTO vector_restore_operator_grants(auth_id,approved_at) VALUES(NEW.id,strftime('%Y-%m-%dT%H:%M:%fZ','now')) ON CONFLICT DO NOTHING;
 END;
