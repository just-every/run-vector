-- Native actors are domain identities. Credentials are installation state.
CREATE TABLE vector_app_actors (
 id TEXT PRIMARY KEY,
 workspace_id TEXT NOT NULL,
 name TEXT NOT NULL,
 installer_id TEXT NOT NULL,
 installer_name TEXT,
 team_id TEXT NOT NULL,
 scopes TEXT NOT NULL CHECK(json_valid(scopes)),
 state TEXT NOT NULL CHECK(state IN ('active','paused','revoked')),
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL
);
CREATE TABLE vector_app_actor_credentials (
 actor_id TEXT PRIMARY KEY REFERENCES vector_app_actors(id),
 token_hash TEXT NOT NULL UNIQUE,
 dev_only INTEGER NOT NULL CHECK(dev_only IN (0,1))
);
ALTER TABLE issue_activity ADD COLUMN app_actor_id TEXT;
ALTER TABLE issue_activity ADD COLUMN app_installer_id TEXT;
ALTER TABLE issue_activity ADD COLUMN app_installer_name TEXT;
ALTER TABLE audit_records ADD COLUMN app_actor_name TEXT;
ALTER TABLE audit_records ADD COLUMN app_installer_id TEXT;
ALTER TABLE audit_records ADD COLUMN app_installer_name TEXT;
CREATE TRIGGER vector_app_actor_audit AFTER INSERT ON issue_activity
WHEN NEW.app_actor_id IS NOT NULL BEGIN
 INSERT INTO audit_records(id,actor_operator_id,action,subject_identifier,subject_id,created_at,updated_at,workspace_id,actor_kind,actor_reference,app_actor_name,app_installer_id,app_installer_name)
 SELECT 'app-agent:'||NEW.id,NULL,NEW.kind,i.id,i.id,NEW.created_at,NEW.updated_at,t.workspace_id,'agent','app-agent:'||NEW.app_actor_id,NEW.actor_name,NEW.app_installer_id,NEW.app_installer_name
 FROM issues i JOIN teams t ON t.id=i.team_id WHERE i.id=NEW.issue_id;
END;
-- Native member erasure also revokes installed credentials and clears saved
-- installer names, without removing the agent's safe historical identity.
CREATE TRIGGER vector_app_actor_installer_erased AFTER UPDATE OF removed_at ON operators
WHEN OLD.removed_at IS NULL AND NEW.removed_at IS NOT NULL BEGIN
 DELETE FROM vector_app_actor_credentials WHERE actor_id IN(SELECT id FROM vector_app_actors WHERE installer_id=NEW.id);
 UPDATE vector_app_actors SET installer_name=NULL,state='revoked',updated_at=NEW.updated_at WHERE installer_id=NEW.id;
 UPDATE issue_activity SET app_installer_name=NULL WHERE app_installer_id=NEW.id;
 UPDATE audit_records SET app_installer_name=NULL WHERE app_installer_id=NEW.id;
END;
