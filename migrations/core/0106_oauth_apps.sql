-- OAuth credentials and consent are local to this installation and excluded from archives.
CREATE TABLE vector_oauth_apps (
 id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, name TEXT NOT NULL,
 redirect_uris TEXT NOT NULL, scopes TEXT NOT NULL, secret_hash TEXT NOT NULL,
 created_by TEXT NOT NULL, created_at INTEGER NOT NULL
);
CREATE TABLE vector_oauth_codes (
 code_hash TEXT PRIMARY KEY, app_id TEXT NOT NULL, workspace_id TEXT NOT NULL,
 operator_id TEXT NOT NULL, redirect_uri TEXT NOT NULL, scopes TEXT NOT NULL,
 challenge TEXT, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL,
 used_at INTEGER, grant_id TEXT, session_id TEXT NOT NULL
);
CREATE TABLE vector_oauth_grants (
 id TEXT PRIMARY KEY, app_id TEXT NOT NULL, workspace_id TEXT NOT NULL,
 operator_id TEXT NOT NULL, scopes TEXT NOT NULL, namespace TEXT NOT NULL UNIQUE,
 token_id TEXT, created_at INTEGER NOT NULL, revoked_at INTEGER
);
CREATE INDEX vector_oauth_grants_inventory ON vector_oauth_grants(workspace_id,created_at);
DROP TRIGGER vector_integration_token_profile;
CREATE TRIGGER vector_integration_token_profile AFTER INSERT ON integration_tokens BEGIN
 INSERT INTO vector_integration_tokens(namespace,token_id,workspace_id,operator_id,name,scopes,created_at,expires_at,revoked_at)
 SELECT NEW.namespace,NEW.id,o.workspace_id,o.id,NEW.name,NEW.scopes,NEW.created_at,NEW.expires_at,NEW.revoked_at
 FROM operators o WHERE o.removed_at IS NULL AND (
 NEW.namespace='vector:'||o.workspace_id||':'||o.id OR EXISTS(
 SELECT 1 FROM vector_oauth_grants g WHERE g.namespace=NEW.namespace AND g.operator_id=o.id AND g.workspace_id=o.workspace_id AND g.revoked_at IS NULL));
 SELECT CASE WHEN EXISTS(SELECT 1 FROM vector_integration_tokens WHERE namespace=NEW.namespace AND token_id=NEW.id)
 THEN 1 ELSE json('native token issuer unavailable') END;
END;
