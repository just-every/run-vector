-- Destination-only admission. No credential hash, cookie or source secret is stored.
-- Only a bootstrap captured by this version in its original transaction is eligible.
CREATE TABLE vector_http_bootstrap (
 id INTEGER PRIMARY KEY CHECK(id=1), snapshot TEXT NOT NULL
);
CREATE VIEW vector_http_bootstrap_current AS SELECT json_array(
 (SELECT json_group_array(json_array("id","workspace_id","created_at")) FROM (SELECT * FROM workspace_bootstrap ORDER BY "id","workspace_id","created_at")),
 (SELECT json_group_array(json_array("id","name","timezone","created_at","updated_at","reminder_time")) FROM (SELECT * FROM workspace_settings ORDER BY "id","name","timezone","created_at","updated_at","reminder_time")),
 (SELECT json_group_array(json_array("workspace_id","setup_operator_id","created_at","updated_at","setup_completed_at")) FROM (SELECT * FROM workspace_installation ORDER BY "workspace_id","setup_operator_id","created_at","updated_at","setup_completed_at")),
 (SELECT json_group_array(json_array("id","workspace_id","name","email","removed_at","created_at","updated_at")) FROM (SELECT * FROM operators ORDER BY "id","workspace_id","name","email","removed_at","created_at","updated_at")),
 (SELECT json_group_array(json_array("id","email","display_name","role","status","version","created_at")) FROM (SELECT * FROM oa_operators ORDER BY "id","email","display_name","role","status","version","created_at")),
 (SELECT json_group_array(json_array("auth_id","operator_id")) FROM (SELECT * FROM vector_auth_operators ORDER BY "auth_id","operator_id")),
 (SELECT json_group_array(json_array("id","workspace_id","name","identifier_prefix","archived_at","created_at","updated_at")) FROM (SELECT * FROM teams ORDER BY "id","workspace_id","name","identifier_prefix","archived_at","created_at","updated_at")),
 (SELECT json_group_array(json_array("id","team_id","name","category","position","created_at","updated_at")) FROM (SELECT * FROM workflow_statuses ORDER BY "id","team_id","name","category","position","created_at","updated_at"))
) AS snapshot;
CREATE TABLE vector_http_restore (
 id INTEGER PRIMARY KEY CHECK(id=1), import_id TEXT UNIQUE,
 actor_id TEXT NOT NULL, auth_id TEXT NOT NULL, session_id TEXT NOT NULL,
 source_token_id TEXT NOT NULL, operator_version INTEGER NOT NULL
);
CREATE VIEW vector_http_restore_eligible AS
 SELECT r.id FROM vector_http_restore r
 JOIN vector_http_bootstrap b ON b.id=1
 JOIN vector_http_bootstrap_current c ON c.snapshot=b.snapshot
 JOIN vector_auth_operators m ON m.operator_id=r.actor_id AND m.auth_id=r.auth_id
 JOIN oa_operators a ON a.id=r.auth_id AND a.status='active' AND a.version=r.operator_version
 JOIN oa_sessions s ON s.id=r.session_id AND s.operator_id=a.id AND s.operator_version=a.version
 JOIN oa_tokens t ON t.id=r.source_token_id AND t.id=s.source_token_id AND t.operator_id=a.id AND t.operator_version=a.version
 WHERE s.kind='native' AND s.revoked_at IS NULL
 AND s.expires_at>CAST((julianday('now')-2440587.5)*86400000 AS INTEGER)
 AND t.kind='magic' AND t.consumed_at IS NOT NULL AND t.revoked_at IS NULL AND t.issuer_id IS NULL
 AND (SELECT count(*) FROM oa_sessions)=1 AND (SELECT count(*) FROM oa_tokens)=1
 AND NOT EXISTS(SELECT 1 FROM oa_external_identities)
 AND NOT EXISTS(SELECT 1 FROM oa_dev_credentials)
 AND NOT EXISTS(SELECT 1 FROM oa_invitation_cancellations)
 AND NOT EXISTS(SELECT 1 FROM operator_sessions)
 AND NOT EXISTS(SELECT 1 FROM magic_links)
 AND NOT EXISTS(SELECT 1 FROM vector_restore_status)
 AND NOT EXISTS(SELECT 1 FROM vector_restore_operator_grants)
 AND NOT EXISTS(SELECT 1 FROM integration_tokens)
 AND NOT EXISTS(SELECT 1 FROM vector_integration_secret_keys);
-- The bootstrap snapshot is captured only by the product's bootstrap transaction.
-- The admission INSERT is itself fenced by the current native request session.
CREATE TRIGGER vector_http_restore_admit AFTER INSERT ON vector_http_restore
 BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM vector_http_restore_eligible)
 THEN RAISE(ABORT,'restore_bootstrap_not_pristine') END;
 END;
CREATE TRIGGER vector_http_restore_bind AFTER INSERT ON rer_portability_jobs
 WHEN NEW.kind='import' AND EXISTS(SELECT 1 FROM vector_http_restore WHERE import_id IS NULL)
 BEGIN
 SELECT CASE WHEN NEW.actor!=(SELECT actor_id FROM vector_http_restore)
 THEN RAISE(ABORT,'restore_actor_changed') END;
 UPDATE vector_http_restore SET import_id=NEW.id WHERE id=1;
 END;
-- Base inserts these bookkeeping guards before replacing any included table.
-- This excluded-table trigger survives Base's included-table trigger suppression.
CREATE TRIGGER vector_http_restore_commit_guard BEFORE INSERT ON rer_portability_guard
 WHEN EXISTS(SELECT 1 FROM vector_http_restore r JOIN rer_portability_state p ON p.import_job=r.import_id WHERE p.applying=1)
 BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM vector_http_restore_eligible)
 THEN RAISE(ABORT,'restore_authority_changed') END;
 END;
-- Deferred NO ACTION FKs are resolved in the same commit as source identities.
-- This trigger is independent of the ordering of the existing quarantine triggers.
CREATE TRIGGER vector_http_restore_complete AFTER UPDATE OF phase ON rer_portability_jobs
 WHEN NEW.kind='import' AND NEW.phase='complete' AND OLD.phase!='complete'
 AND EXISTS(SELECT 1 FROM vector_http_restore WHERE import_id=NEW.id)
 BEGIN
 DELETE FROM oa_sessions WHERE id=(SELECT session_id FROM vector_http_restore WHERE import_id=NEW.id);
 DELETE FROM oa_tokens WHERE id=(SELECT source_token_id FROM vector_http_restore WHERE import_id=NEW.id);
 DELETE FROM vector_http_restore WHERE import_id=NEW.id;
 END;
CREATE TRIGGER vector_http_restore_abort AFTER UPDATE OF phase ON rer_portability_jobs
 WHEN NEW.kind='import' AND NEW.phase='aborted'
 BEGIN DELETE FROM vector_http_restore WHERE import_id=NEW.id; END;
