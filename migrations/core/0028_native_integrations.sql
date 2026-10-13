-- Safe profiles survive restore; active bearer hashes and encrypted signing
-- credentials are excluded by Vector's archive policy.
CREATE TABLE vector_integration_tokens (
 namespace TEXT NOT NULL,token_id TEXT NOT NULL,workspace_id TEXT NOT NULL,operator_id TEXT NOT NULL,
 name TEXT NOT NULL,scopes TEXT NOT NULL,created_at INTEGER NOT NULL,expires_at INTEGER,revoked_at INTEGER,
 PRIMARY KEY(namespace,token_id)
);
CREATE TRIGGER vector_integration_token_profile AFTER INSERT ON integration_tokens BEGIN
 INSERT INTO vector_integration_tokens(namespace,token_id,workspace_id,operator_id,name,scopes,created_at,expires_at,revoked_at)
 SELECT NEW.namespace,NEW.id,o.workspace_id,o.id,NEW.name,NEW.scopes,NEW.created_at,NEW.expires_at,NEW.revoked_at
 FROM operators o WHERE NEW.namespace='vector:'||o.workspace_id||':'||o.id AND o.removed_at IS NULL;
 SELECT CASE WHEN EXISTS(SELECT 1 FROM vector_integration_tokens WHERE namespace=NEW.namespace AND token_id=NEW.id)
 THEN 1 ELSE json('native token issuer unavailable') END;
END;
CREATE TRIGGER vector_integration_token_revoke AFTER UPDATE OF revoked_at ON integration_tokens BEGIN
 UPDATE vector_integration_tokens SET revoked_at=NEW.revoked_at WHERE namespace=NEW.namespace AND token_id=NEW.id;
END;
CREATE TRIGGER vector_integration_removed_operator AFTER UPDATE OF removed_at ON operators WHEN NEW.removed_at IS NOT NULL BEGIN
 UPDATE integration_tokens SET revoked_at=COALESCE(revoked_at,CAST((julianday('now')-2440587.5)*86400000 AS INTEGER))
 WHERE namespace IN(SELECT namespace FROM vector_integration_tokens WHERE operator_id=NEW.id);
END;
CREATE TABLE vector_integration_sources (
 id TEXT PRIMARY KEY,workspace_id TEXT NOT NULL,source_id TEXT NOT NULL,name TEXT NOT NULL,team_id TEXT NOT NULL,
 version INTEGER NOT NULL DEFAULT 1,enabled INTEGER NOT NULL DEFAULT 1,revoked_at TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,
 UNIQUE(workspace_id,source_id)
);
CREATE TABLE vector_integration_secret_keys (
 identity TEXT NOT NULL,slot TEXT NOT NULL,encrypted TEXT NOT NULL,valid_until INTEGER,
 PRIMARY KEY(identity,slot)
);
CREATE TABLE vector_source_records (
 source_id TEXT NOT NULL,record_id TEXT NOT NULL,issue_id TEXT NOT NULL,created_at TEXT NOT NULL,
 PRIMARY KEY(source_id,record_id)
);
CREATE TABLE vector_source_receipts (
 source_id TEXT NOT NULL,record_id TEXT NOT NULL,revision_id TEXT NOT NULL,payload_hash TEXT NOT NULL,
 issue_id TEXT NOT NULL,evidence_id TEXT NOT NULL,received_at TEXT NOT NULL,
 PRIMARY KEY(source_id,record_id,revision_id)
);
ALTER TABLE evidence_revisions ADD COLUMN source_id TEXT;
ALTER TABLE evidence_revisions ADD COLUMN source_record_id TEXT;
ALTER TABLE evidence_revisions ADD COLUMN source_revision_id TEXT;
CREATE TABLE vector_webhook_destinations (
 id TEXT PRIMARY KEY,workspace_id TEXT NOT NULL,name TEXT NOT NULL,url TEXT NOT NULL,
 enabled INTEGER NOT NULL DEFAULT 1,revoked_at TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL
);
CREATE TABLE vector_webhook_events (
 id TEXT PRIMARY KEY,workspace_id TEXT NOT NULL,destination_id TEXT NOT NULL,event TEXT NOT NULL,
 body TEXT NOT NULL,created_at TEXT NOT NULL,enqueued_at TEXT
);
CREATE TRIGGER vector_native_webhook_event AFTER INSERT ON issue_activity
WHEN NEW.kind<>'issue.imported' AND NEW.kind IN ('issue.created','issue.updated','issue.status_changed')
 AND (NOT EXISTS(SELECT 1 FROM vector_restore_status) OR EXISTS(SELECT 1 FROM vector_restore_status WHERE effects_held=0))
BEGIN
 INSERT INTO vector_webhook_events(id,workspace_id,destination_id,event,body,created_at)
 SELECT i.id||':'||i.version||':'||d.id||':'||CASE WHEN NEW.kind='issue.created' THEN 'created' WHEN s.category='completed' THEN 'completed' ELSE 'updated' END,
 t.workspace_id,d.id,CASE WHEN NEW.kind='issue.created' THEN 'issue.created' WHEN s.category='completed' THEN 'issue.completed' ELSE 'issue.updated' END,
 json_object('identifier',i.identifier,'version',i.version,'title',i.title,'status',s.category,'updatedAt',i.updated_at),NEW.created_at
 FROM issues i JOIN teams t ON t.id=i.team_id JOIN workflow_statuses s ON s.id=i.status_id
 JOIN vector_webhook_destinations d ON d.workspace_id=t.workspace_id AND d.enabled=1 AND d.revoked_at IS NULL
 WHERE i.id=NEW.issue_id ON CONFLICT(id) DO NOTHING;
END;
CREATE TABLE vector_github_repositories (
 id TEXT PRIMARY KEY,workspace_id TEXT NOT NULL,repository TEXT NOT NULL,name TEXT NOT NULL,
 enabled INTEGER NOT NULL DEFAULT 1,revoked_at TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,
 UNIQUE(workspace_id,repository)
);
CREATE TABLE vector_github_deliveries (
 repository_id TEXT NOT NULL,delivery_id TEXT NOT NULL,payload_hash TEXT NOT NULL,received_at TEXT NOT NULL,
 diagnostic TEXT NOT NULL,PRIMARY KEY(repository_id,delivery_id)
);
CREATE TABLE vector_github_pull_requests (
 repository_id TEXT NOT NULL,number INTEGER NOT NULL,title TEXT NOT NULL,url TEXT NOT NULL,state TEXT NOT NULL,
 updated_at TEXT NOT NULL,received_at TEXT NOT NULL,PRIMARY KEY(repository_id,number)
);
CREATE TABLE vector_github_issue_links (
 repository_id TEXT NOT NULL,number INTEGER NOT NULL,issue_id TEXT NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
 created_at TEXT NOT NULL,PRIMARY KEY(repository_id,number,issue_id)
);
-- Destination-only holds keep imported native queues and sending history inert.
CREATE TABLE vector_webhook_restore_holds (namespace TEXT NOT NULL,id TEXT NOT NULL,PRIMARY KEY(namespace,id));
CREATE TRIGGER vector_restore_integrations AFTER UPDATE OF phase ON rer_portability_jobs
WHEN NEW.kind='import' AND NEW.phase='complete' AND OLD.phase<>'complete' BEGIN
 DELETE FROM vector_integration_secret_keys;
 INSERT INTO vector_webhook_restore_holds(namespace,id) SELECT namespace,id FROM integration_deliveries WHERE 1 ON CONFLICT DO NOTHING;
 INSERT INTO vector_webhook_restore_holds(namespace,id) SELECT workspace_id,id FROM vector_webhook_events WHERE 1 ON CONFLICT DO NOTHING;
END;

-- A named constraint identifies a rolled-back bearer authority race, even
-- when rollback restores the issuer/token rows that caused the refusal.
CREATE TABLE vector_integration_authority_guard (id INTEGER PRIMARY KEY CHECK(id=1), admitted INTEGER NOT NULL CONSTRAINT vector_integration_authority CHECK(admitted=1));
INSERT INTO vector_integration_authority_guard(id,admitted) VALUES(1,1);
