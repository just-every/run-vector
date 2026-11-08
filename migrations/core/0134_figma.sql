-- App configuration history is portable; app, member and OAuth state secrets
-- use the existing excluded installation vault and require fresh entry.
CREATE TABLE vector_figma_installations (
 workspace_id TEXT PRIMARY KEY REFERENCES workspace_settings(id) ON DELETE CASCADE,
 configured_at TEXT NOT NULL
);

-- Durable capture identity prevents a restored or deleted issue from being
-- recreated by a plugin replay. No provider credential or comment is retained.
CREATE TABLE vector_figma_captures (
 workspace_id TEXT NOT NULL REFERENCES workspace_settings(id) ON DELETE CASCADE,
 operator_id TEXT NOT NULL,
 capture_id TEXT NOT NULL,
 fingerprint TEXT NOT NULL,
 issue_id TEXT REFERENCES issues(id) ON DELETE SET NULL,
 created_at TEXT NOT NULL,
 PRIMARY KEY(workspace_id,operator_id,capture_id)
);

CREATE TRIGGER vector_figma_person_removed AFTER UPDATE OF removed_at ON operators
WHEN NEW.removed_at IS NOT NULL BEGIN
 DELETE FROM vector_integration_secret_keys
 WHERE identity='figma-member:'||OLD.workspace_id||':'||OLD.id
 OR substr(identity,1,length('figma-state:'||OLD.workspace_id||':'||OLD.id||':'))='figma-state:'||OLD.workspace_id||':'||OLD.id||':';
END;
CREATE TRIGGER vector_figma_person_deleted BEFORE DELETE ON operators BEGIN
 DELETE FROM vector_integration_secret_keys
 WHERE identity='figma-member:'||OLD.workspace_id||':'||OLD.id
 OR substr(identity,1,length('figma-state:'||OLD.workspace_id||':'||OLD.id||':'))='figma-state:'||OLD.workspace_id||':'||OLD.id||':';
END;
