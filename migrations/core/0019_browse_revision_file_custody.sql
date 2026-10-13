-- A conservative database revision fences every dependency of an issue list.
-- Read it together with counts and rows in a single D1 batch.
CREATE TABLE issue_list_revision (id INTEGER PRIMARY KEY CHECK(id=1), revision INTEGER NOT NULL);
INSERT INTO issue_list_revision VALUES(1,0);
CREATE TRIGGER browse_issues_insert AFTER INSERT ON issues BEGIN
 UPDATE issue_list_revision SET revision=revision+1 WHERE id=1;
END;
CREATE TRIGGER browse_issues_update AFTER UPDATE ON issues BEGIN
 UPDATE issue_list_revision SET revision=revision+1 WHERE id=1;
END;
CREATE TRIGGER browse_issues_delete AFTER DELETE ON issues BEGIN
 UPDATE issue_list_revision SET revision=revision+1 WHERE id=1;
END;
CREATE TRIGGER browse_teams_insert AFTER INSERT ON teams BEGIN
 UPDATE issue_list_revision SET revision=revision+1 WHERE id=1;
END;
CREATE TRIGGER browse_teams_update AFTER UPDATE ON teams BEGIN
 UPDATE issue_list_revision SET revision=revision+1 WHERE id=1;
END;
CREATE TRIGGER browse_teams_delete AFTER DELETE ON teams BEGIN
 UPDATE issue_list_revision SET revision=revision+1 WHERE id=1;
END;
CREATE TRIGGER browse_workflow_statuses_insert AFTER INSERT ON workflow_statuses BEGIN
 UPDATE issue_list_revision SET revision=revision+1 WHERE id=1;
END;
CREATE TRIGGER browse_workflow_statuses_update AFTER UPDATE ON workflow_statuses BEGIN
 UPDATE issue_list_revision SET revision=revision+1 WHERE id=1;
END;
CREATE TRIGGER browse_workflow_statuses_delete AFTER DELETE ON workflow_statuses BEGIN
 UPDATE issue_list_revision SET revision=revision+1 WHERE id=1;
END;
CREATE TRIGGER browse_operators_insert AFTER INSERT ON operators BEGIN
 UPDATE issue_list_revision SET revision=revision+1 WHERE id=1;
END;
CREATE TRIGGER browse_operators_update AFTER UPDATE ON operators BEGIN
 UPDATE issue_list_revision SET revision=revision+1 WHERE id=1;
END;
CREATE TRIGGER browse_operators_delete AFTER DELETE ON operators BEGIN
 UPDATE issue_list_revision SET revision=revision+1 WHERE id=1;
END;
CREATE TRIGGER browse_projects_insert AFTER INSERT ON projects BEGIN
 UPDATE issue_list_revision SET revision=revision+1 WHERE id=1;
END;
CREATE TRIGGER browse_projects_update AFTER UPDATE ON projects BEGIN
 UPDATE issue_list_revision SET revision=revision+1 WHERE id=1;
END;
CREATE TRIGGER browse_projects_delete AFTER DELETE ON projects BEGIN
 UPDATE issue_list_revision SET revision=revision+1 WHERE id=1;
END;
CREATE TRIGGER browse_cycles_insert AFTER INSERT ON cycles BEGIN
 UPDATE issue_list_revision SET revision=revision+1 WHERE id=1;
END;
CREATE TRIGGER browse_cycles_update AFTER UPDATE ON cycles BEGIN
 UPDATE issue_list_revision SET revision=revision+1 WHERE id=1;
END;
CREATE TRIGGER browse_cycles_delete AFTER DELETE ON cycles BEGIN
 UPDATE issue_list_revision SET revision=revision+1 WHERE id=1;
END;
CREATE TRIGGER browse_labels_insert AFTER INSERT ON labels BEGIN
 UPDATE issue_list_revision SET revision=revision+1 WHERE id=1;
END;
CREATE TRIGGER browse_labels_update AFTER UPDATE ON labels BEGIN
 UPDATE issue_list_revision SET revision=revision+1 WHERE id=1;
END;
CREATE TRIGGER browse_labels_delete AFTER DELETE ON labels BEGIN
 UPDATE issue_list_revision SET revision=revision+1 WHERE id=1;
END;
CREATE TRIGGER browse_issue_labels_insert AFTER INSERT ON issue_labels BEGIN
 UPDATE issue_list_revision SET revision=revision+1 WHERE id=1;
END;
CREATE TRIGGER browse_issue_labels_update AFTER UPDATE ON issue_labels BEGIN
 UPDATE issue_list_revision SET revision=revision+1 WHERE id=1;
END;
CREATE TRIGGER browse_issue_labels_delete AFTER DELETE ON issue_labels BEGIN
 UPDATE issue_list_revision SET revision=revision+1 WHERE id=1;
END;
CREATE TRIGGER browse_issue_dependencies_insert AFTER INSERT ON issue_dependencies BEGIN
 UPDATE issue_list_revision SET revision=revision+1 WHERE id=1;
END;
CREATE TRIGGER browse_issue_dependencies_update AFTER UPDATE ON issue_dependencies BEGIN
 UPDATE issue_list_revision SET revision=revision+1 WHERE id=1;
END;
CREATE TRIGGER browse_issue_dependencies_delete AFTER DELETE ON issue_dependencies BEGIN
 UPDATE issue_list_revision SET revision=revision+1 WHERE id=1;
END;
CREATE TRIGGER browse_issue_parents_insert AFTER INSERT ON issue_parents BEGIN
 UPDATE issue_list_revision SET revision=revision+1 WHERE id=1;
END;
CREATE TRIGGER browse_issue_parents_update AFTER UPDATE ON issue_parents BEGIN
 UPDATE issue_list_revision SET revision=revision+1 WHERE id=1;
END;
CREATE TRIGGER browse_issue_parents_delete AFTER DELETE ON issue_parents BEGIN
 UPDATE issue_list_revision SET revision=revision+1 WHERE id=1;
END;
CREATE TRIGGER browse_workspace_settings_insert AFTER INSERT ON workspace_settings BEGIN
 UPDATE issue_list_revision SET revision=revision+1 WHERE id=1;
END;
CREATE TRIGGER browse_workspace_settings_update AFTER UPDATE ON workspace_settings BEGIN
 UPDATE issue_list_revision SET revision=revision+1 WHERE id=1;
END;
CREATE TRIGGER browse_workspace_settings_delete AFTER DELETE ON workspace_settings BEGIN
 UPDATE issue_list_revision SET revision=revision+1 WHERE id=1;
END;

-- Independent custody outlives the issue and its discussion. No issue/actor FK:
-- cleanup is authorized by the committed reservation, not a deleted record.
CREATE TABLE detached_file_removals (
 id TEXT PRIMARY KEY, issue_id TEXT NOT NULL, identifier TEXT NOT NULL,
 actor_operator_id TEXT NOT NULL, blob_key TEXT NOT NULL UNIQUE,
 bytes INTEGER NOT NULL CHECK(bytes>0), writer_settled INTEGER NOT NULL CHECK(writer_settled IN (0,1)),
 content_sha256 TEXT, removal_requested_at TEXT NOT NULL,
 removal_actor_operator_id TEXT, removal_confirmed_at TEXT, deleted_at TEXT,
 cleanup_error TEXT, updated_at TEXT NOT NULL
);
CREATE INDEX detached_file_pending ON detached_file_removals(removal_confirmed_at,updated_at);
