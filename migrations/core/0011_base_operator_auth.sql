-- Additive schema draft. Integrator assigns the next migration number; never
-- replace an applied migration. All epoch timestamps are milliseconds.
CREATE TABLE oa_operators (
 id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, display_name TEXT NOT NULL,
 role TEXT NOT NULL CHECK(role IN ('owner','admin','member')),
 status TEXT NOT NULL CHECK(status IN ('invited','active','inactive')),
 version INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL
);
CREATE TABLE oa_bootstrap (singleton INTEGER PRIMARY KEY CHECK(singleton=1), claim_id TEXT NOT NULL UNIQUE, claimed_at INTEGER NOT NULL);
CREATE TABLE oa_tokens (
 id TEXT PRIMARY KEY, token_hash TEXT NOT NULL UNIQUE,
 kind TEXT NOT NULL CHECK(kind IN ('magic','invite')),
 operator_id TEXT NOT NULL REFERENCES oa_operators(id), operator_version INTEGER NOT NULL,
 issuer_id TEXT REFERENCES oa_operators(id), issuer_version INTEGER,
 return_to TEXT NOT NULL, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL,
 consumed_at INTEGER, revoked_at INTEGER,
 CHECK((kind='invite' AND issuer_id IS NOT NULL AND issuer_version IS NOT NULL)
    OR (kind='magic' AND issuer_id IS NULL AND issuer_version IS NULL))
);
CREATE TABLE oa_sessions (
 id TEXT PRIMARY KEY, token_hash TEXT NOT NULL UNIQUE,
 operator_id TEXT NOT NULL REFERENCES oa_operators(id), operator_version INTEGER NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN ('native','review','oidc','password')),
 source_token_id TEXT UNIQUE REFERENCES oa_tokens(id),
 created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, revoked_at INTEGER
);
CREATE INDEX oa_sessions_operator ON oa_sessions(operator_id);
CREATE TABLE oa_external_identities (
 issuer TEXT NOT NULL, subject TEXT NOT NULL, operator_id TEXT NOT NULL REFERENCES oa_operators(id),
 PRIMARY KEY(issuer, subject)
);
CREATE TABLE oa_limits (key TEXT PRIMARY KEY, window INTEGER NOT NULL, count INTEGER NOT NULL);
CREATE TRIGGER oa_preserve_last_owner_update BEFORE UPDATE OF status,role ON oa_operators
 WHEN OLD.role='owner' AND OLD.status='active' AND (NEW.role!='owner' OR NEW.status!='active')
 AND (SELECT COUNT(*) FROM oa_operators WHERE role='owner' AND status='active') <= 1
 BEGIN SELECT RAISE(ABORT, 'last_owner'); END;
CREATE TRIGGER oa_preserve_last_owner_delete BEFORE DELETE ON oa_operators
 WHEN OLD.role='owner' AND OLD.status='active'
 AND (SELECT COUNT(*) FROM oa_operators WHERE role='owner' AND status='active') <= 1
 BEGIN SELECT RAISE(ABORT, 'last_owner'); END;
-- A status/role change invalidates every preexisting session and link, including
-- after a later reactivation. Keep this invariant for direct administrative SQL.
CREATE TRIGGER oa_operator_version AFTER UPDATE OF status,role ON oa_operators
 WHEN OLD.status != NEW.status OR OLD.role != NEW.role
 BEGIN UPDATE oa_operators SET version=OLD.version+1 WHERE id=NEW.id; END;

-- Vector's product IDs and applied native history remain intact. Every operator
-- has equal authority: Base owner is an implementation role, never a product role.
CREATE TABLE vector_auth_operators (
 auth_id TEXT PRIMARY KEY REFERENCES oa_operators(id),
 operator_id TEXT NOT NULL UNIQUE REFERENCES operators(id)
);
INSERT INTO oa_operators(id,email,display_name,role,status,created_at)
 SELECT id,lower(email),name,'owner',CASE WHEN removed_at IS NULL THEN 'active' ELSE 'inactive' END,
 CAST(unixepoch(created_at)*1000 AS INTEGER) FROM operators;
INSERT INTO vector_auth_operators(auth_id,operator_id) SELECT id,id FROM operators;
INSERT INTO oa_bootstrap(singleton,claim_id,claimed_at)
 SELECT 1,'vector-existing-operator-import',CAST(unixepoch('now')*1000 AS INTEGER)
 WHERE EXISTS(SELECT 1 FROM operators);
-- Configured first-owner bootstrap, explicit sample seeding and legacy imports
-- all use the existing product insert boundary. No request email creates a user.
CREATE TRIGGER vector_operator_auth_insert AFTER INSERT ON operators
 BEGIN
 INSERT INTO oa_operators(id,email,display_name,role,status,created_at)
 SELECT NEW.id,lower(NEW.email),NEW.name,'owner',CASE WHEN NEW.removed_at IS NULL THEN 'active' ELSE 'inactive' END,
 CAST(unixepoch(NEW.created_at)*1000 AS INTEGER)
 WHERE NOT EXISTS(SELECT 1 FROM oa_operators WHERE email=lower(NEW.email));
 INSERT INTO vector_auth_operators(auth_id,operator_id)
 SELECT id,NEW.id FROM oa_operators WHERE email=lower(NEW.email);
 INSERT INTO oa_bootstrap(singleton,claim_id,claimed_at) VALUES(1,'vector-configured-owner',CAST(unixepoch('now')*1000 AS INTEGER)) ON CONFLICT DO NOTHING;
 END;
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
