-- Local dev identity support from Base's operator-auth (schema/dev-sessions.sql
-- at the pinned Base commit). Base's file assumes nothing refers to oa_sessions,
-- but Vector's vector_operator_auth_remove trigger (0011) updates it, and SQLite
-- cannot rename over a trigger body that names the table. This edition's copy
-- therefore drops that trigger around the rebuild and recreates it unchanged.
-- SQLite cannot change a CHECK in place, so oa_sessions is rebuilt with 'dev'
-- admitted, keeping every row, column, index and constraint. The statements are
-- also safe on a store created from the current schema/operator-auth.sql.
DROP TRIGGER IF EXISTS vector_operator_auth_remove;
CREATE TABLE oa_sessions_dev_rebuild (
 id TEXT PRIMARY KEY, token_hash TEXT NOT NULL UNIQUE,
 operator_id TEXT NOT NULL REFERENCES oa_operators(id), operator_version INTEGER NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN ('native','review','oidc','password','dev')),
 source_token_id TEXT UNIQUE REFERENCES oa_tokens(id),
 created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, revoked_at INTEGER
);
INSERT INTO oa_sessions_dev_rebuild(id,token_hash,operator_id,operator_version,kind,source_token_id,created_at,expires_at,revoked_at)
 SELECT id,token_hash,operator_id,operator_version,kind,source_token_id,created_at,expires_at,revoked_at FROM oa_sessions;
DROP TABLE oa_sessions;
ALTER TABLE oa_sessions_dev_rebuild RENAME TO oa_sessions;
CREATE INDEX oa_sessions_operator ON oa_sessions(operator_id);
CREATE TABLE IF NOT EXISTS oa_dev_credentials (
 credential TEXT NOT NULL, id TEXT NOT NULL, created_at INTEGER NOT NULL,
 PRIMARY KEY(credential, id)
);
-- This runs in the very same transaction as OPS-004 transfers and anonymisation.
CREATE TRIGGER vector_operator_auth_remove AFTER UPDATE OF removed_at ON operators
 WHEN OLD.removed_at IS NULL AND NEW.removed_at IS NOT NULL
 BEGIN
 UPDATE oa_tokens SET revoked_at=CAST(unixepoch('now')*1000 AS INTEGER)
 WHERE operator_id IN(SELECT auth_id FROM vector_auth_operators WHERE operator_id=NEW.id)
 OR issuer_id IN(SELECT auth_id FROM vector_auth_operators WHERE operator_id=NEW.id);
 UPDATE oa_sessions SET revoked_at=CAST(unixepoch('now')*1000 AS INTEGER)
 WHERE operator_id IN(SELECT auth_id FROM vector_auth_operators WHERE operator_id=NEW.id);
 UPDATE oa_operators SET status='inactive',email=NEW.email,display_name='Removed operator'
 WHERE id IN(SELECT auth_id FROM vector_auth_operators WHERE operator_id=NEW.id);
 END;
