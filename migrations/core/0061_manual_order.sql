-- Shared view ordering is domain data. Keep it on compatible-source rollback.
CREATE TABLE manual_order_scopes (
 workspace_id TEXT NOT NULL REFERENCES workspace_settings(id) ON DELETE CASCADE,
 scope_key TEXT NOT NULL,
 version INTEGER NOT NULL DEFAULT 0 CHECK(version>=0),
 PRIMARY KEY(workspace_id,scope_key)
);
CREATE TABLE manual_order_entries (
 workspace_id TEXT NOT NULL,
 scope_key TEXT NOT NULL,
 issue_id TEXT NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
 position REAL NOT NULL,
 PRIMARY KEY(workspace_id,scope_key,issue_id),
 FOREIGN KEY(workspace_id,scope_key) REFERENCES manual_order_scopes(workspace_id,scope_key) ON DELETE CASCADE
);
CREATE INDEX manual_order_entries_issue ON manual_order_entries(issue_id,scope_key);
CREATE INDEX manual_order_entries_position ON manual_order_entries(workspace_id,scope_key,position,issue_id);
CREATE TRIGGER manual_order_entry_insert AFTER INSERT ON manual_order_entries BEGIN
 UPDATE issue_list_revision SET revision=revision+1 WHERE id=1;
END;
CREATE TRIGGER manual_order_entry_update AFTER UPDATE ON manual_order_entries BEGIN
 UPDATE issue_list_revision SET revision=revision+1 WHERE id=1;
END;
CREATE TRIGGER manual_order_entry_delete AFTER DELETE ON manual_order_entries BEGIN
 UPDATE issue_list_revision SET revision=revision+1 WHERE id=1;
END;
CREATE TRIGGER manual_order_scope_update AFTER UPDATE OF version ON manual_order_scopes BEGIN
 UPDATE issue_list_revision SET revision=revision+1 WHERE id=1;
END;
CREATE TRIGGER manual_order_scope_delete AFTER DELETE ON manual_order_scopes BEGIN
 UPDATE issue_list_revision SET revision=revision+1 WHERE id=1;
END;
CREATE TRIGGER manual_order_view_delete AFTER DELETE ON saved_views BEGIN
 DELETE FROM manual_order_scopes WHERE workspace_id=OLD.workspace_id AND scope_key='view:'||OLD.id;
END;
CREATE TRIGGER manual_order_team_delete AFTER DELETE ON teams BEGIN
 DELETE FROM manual_order_scopes WHERE workspace_id=OLD.workspace_id AND scope_key='team:'||OLD.id;
END;
