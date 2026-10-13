-- Search is maintained in the source transaction: a failed index write aborts
-- the mutation, so committed source text cannot leave a stale search document.
CREATE INDEX issues_identifier_nocase ON issues(identifier COLLATE NOCASE);
CREATE INDEX issue_labels_label_search ON issue_labels(label_id,issue_id);
CREATE INDEX teams_workspace_search ON teams(workspace_id,archived_at);
CREATE INDEX operators_workspace_search ON operators(workspace_id,removed_at);
CREATE INDEX cycles_team_search ON cycles(team_id,closed_at);
CREATE INDEX saved_views_workspace_search ON saved_views(workspace_id,is_shared,owner_operator_id);

CREATE TABLE search_index_state (
 id INTEGER PRIMARY KEY CHECK(id=1),
 last_successful_index_at TEXT NOT NULL
);
INSERT INTO search_index_state VALUES(1,strftime('%Y-%m-%dT%H:%M:%fZ','now'));

CREATE VIRTUAL TABLE search_issues USING fts5(text, tokenize='unicode61 remove_diacritics 2', prefix='2 3 4');
CREATE VIRTUAL TABLE search_projects USING fts5(name, tokenize='unicode61 remove_diacritics 2', prefix='2 3 4');
CREATE VIRTUAL TABLE search_views USING fts5(name, tokenize='unicode61 remove_diacritics 2', prefix='2 3 4');

CREATE VIEW search_issue_documents AS
SELECT i.rowid AS rowid, i.id AS issue_id,
 i.identifier || ' ' || i.title || ' ' || i.description || ' ' ||
 coalesce(i.expected_outcome,'') || ' ' || coalesce(i.customer_impact,'') || ' ' ||
 coalesce((SELECT group_concat(c.body,' ') FROM issue_comments c
   WHERE c.issue_id=i.id AND c.deleted_at IS NULL),'') || ' ' ||
 coalesce((SELECT group_concat(e.summary,' ') FROM evidence_revisions e WHERE e.issue_id=i.id),'') || ' ' ||
 coalesce((SELECT p.name FROM projects p WHERE p.id=i.project_id AND p.workspace_id=t.workspace_id),'') || ' ' ||
 coalesce((SELECT group_concat(l.name,' ') FROM issue_labels il JOIN labels l ON l.id=il.label_id
   WHERE il.issue_id=i.id AND l.workspace_id=t.workspace_id),'') AS text
FROM issues i JOIN teams t ON t.id=i.team_id;

INSERT INTO search_issues(rowid,text) SELECT rowid,text FROM search_issue_documents;
INSERT INTO search_projects(rowid,name) SELECT rowid,name FROM projects;
INSERT INTO search_views(rowid,name) SELECT rowid,name FROM saved_views;

CREATE TRIGGER search_issue_insert AFTER INSERT ON issues BEGIN
 INSERT INTO search_issues(rowid,text) SELECT rowid,text FROM search_issue_documents WHERE issue_id=NEW.id;
 UPDATE search_index_state SET last_successful_index_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=1;
END;

CREATE TRIGGER search_issue_update AFTER UPDATE OF identifier,title,description,expected_outcome,customer_impact,project_id,team_id ON issues BEGIN
 DELETE FROM search_issues WHERE rowid=OLD.rowid;
 INSERT INTO search_issues(rowid,text) SELECT rowid,text FROM search_issue_documents WHERE issue_id=NEW.id;
 UPDATE search_index_state SET last_successful_index_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=1;
END;

CREATE TRIGGER search_issue_delete AFTER DELETE ON issues BEGIN
 DELETE FROM search_issues WHERE rowid=OLD.rowid;
 UPDATE search_index_state SET last_successful_index_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=1;
END;

CREATE TRIGGER search_issue_comments_insert AFTER INSERT ON issue_comments BEGIN
 DELETE FROM search_issues WHERE rowid IN (SELECT rowid FROM issues WHERE id=NEW.issue_id);
 INSERT INTO search_issues(rowid,text) SELECT rowid,text FROM search_issue_documents WHERE issue_id IN (SELECT id FROM issues WHERE id=NEW.issue_id);
 UPDATE search_index_state SET last_successful_index_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=1;
END;

CREATE TRIGGER search_issue_comments_update AFTER UPDATE OF body,deleted_at,issue_id ON issue_comments BEGIN
 DELETE FROM search_issues WHERE rowid IN (SELECT rowid FROM issues WHERE id IN (OLD.issue_id,NEW.issue_id));
 INSERT INTO search_issues(rowid,text) SELECT rowid,text FROM search_issue_documents WHERE issue_id IN (SELECT id FROM issues WHERE id IN (OLD.issue_id,NEW.issue_id));
 UPDATE search_index_state SET last_successful_index_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=1;
END;

CREATE TRIGGER search_issue_comments_delete AFTER DELETE ON issue_comments BEGIN
 DELETE FROM search_issues WHERE rowid IN (SELECT rowid FROM issues WHERE id=OLD.issue_id);
 INSERT INTO search_issues(rowid,text) SELECT rowid,text FROM search_issue_documents WHERE issue_id IN (SELECT id FROM issues WHERE id=OLD.issue_id);
 UPDATE search_index_state SET last_successful_index_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=1;
END;

CREATE TRIGGER search_evidence_revisions_insert AFTER INSERT ON evidence_revisions BEGIN
 DELETE FROM search_issues WHERE rowid IN (SELECT rowid FROM issues WHERE id=NEW.issue_id);
 INSERT INTO search_issues(rowid,text) SELECT rowid,text FROM search_issue_documents WHERE issue_id IN (SELECT id FROM issues WHERE id=NEW.issue_id);
 UPDATE search_index_state SET last_successful_index_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=1;
END;

CREATE TRIGGER search_evidence_revisions_update AFTER UPDATE OF summary,issue_id ON evidence_revisions BEGIN
 DELETE FROM search_issues WHERE rowid IN (SELECT rowid FROM issues WHERE id IN (OLD.issue_id,NEW.issue_id));
 INSERT INTO search_issues(rowid,text) SELECT rowid,text FROM search_issue_documents WHERE issue_id IN (SELECT id FROM issues WHERE id IN (OLD.issue_id,NEW.issue_id));
 UPDATE search_index_state SET last_successful_index_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=1;
END;

CREATE TRIGGER search_evidence_revisions_delete AFTER DELETE ON evidence_revisions BEGIN
 DELETE FROM search_issues WHERE rowid IN (SELECT rowid FROM issues WHERE id=OLD.issue_id);
 INSERT INTO search_issues(rowid,text) SELECT rowid,text FROM search_issue_documents WHERE issue_id IN (SELECT id FROM issues WHERE id=OLD.issue_id);
 UPDATE search_index_state SET last_successful_index_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=1;
END;

CREATE TRIGGER search_issue_labels_insert AFTER INSERT ON issue_labels BEGIN
 DELETE FROM search_issues WHERE rowid IN (SELECT rowid FROM issues WHERE id=NEW.issue_id);
 INSERT INTO search_issues(rowid,text) SELECT rowid,text FROM search_issue_documents WHERE issue_id IN (SELECT id FROM issues WHERE id=NEW.issue_id);
 UPDATE search_index_state SET last_successful_index_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=1;
END;

CREATE TRIGGER search_issue_labels_update AFTER UPDATE OF issue_id,label_id ON issue_labels BEGIN
 DELETE FROM search_issues WHERE rowid IN (SELECT rowid FROM issues WHERE id IN (OLD.issue_id,NEW.issue_id));
 INSERT INTO search_issues(rowid,text) SELECT rowid,text FROM search_issue_documents WHERE issue_id IN (SELECT id FROM issues WHERE id IN (OLD.issue_id,NEW.issue_id));
 UPDATE search_index_state SET last_successful_index_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=1;
END;

CREATE TRIGGER search_issue_labels_delete AFTER DELETE ON issue_labels BEGIN
 DELETE FROM search_issues WHERE rowid IN (SELECT rowid FROM issues WHERE id=OLD.issue_id);
 INSERT INTO search_issues(rowid,text) SELECT rowid,text FROM search_issue_documents WHERE issue_id IN (SELECT id FROM issues WHERE id=OLD.issue_id);
 UPDATE search_index_state SET last_successful_index_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=1;
END;

CREATE TRIGGER search_projects_insert AFTER INSERT ON projects BEGIN
 INSERT INTO search_projects(rowid,name) VALUES(NEW.rowid,NEW.name);
 UPDATE search_index_state SET last_successful_index_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=1;
END;

CREATE TRIGGER search_projects_update AFTER UPDATE ON projects BEGIN
 DELETE FROM search_projects WHERE rowid=OLD.rowid;
 INSERT INTO search_projects(rowid,name) VALUES(NEW.rowid,NEW.name);
 DELETE FROM search_issues WHERE rowid IN (SELECT rowid FROM issues WHERE project_id=NEW.id);
 INSERT INTO search_issues(rowid,text) SELECT rowid,text FROM search_issue_documents WHERE issue_id IN (SELECT id FROM issues WHERE project_id=NEW.id);
 UPDATE search_index_state SET last_successful_index_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=1;
END;

CREATE TRIGGER search_projects_delete AFTER DELETE ON projects BEGIN
 DELETE FROM search_projects WHERE rowid=OLD.rowid;
 DELETE FROM search_issues WHERE rowid IN (SELECT rowid FROM issues WHERE project_id=OLD.id);
 INSERT INTO search_issues(rowid,text) SELECT rowid,text FROM search_issue_documents WHERE issue_id IN (SELECT id FROM issues WHERE project_id=OLD.id);
 UPDATE search_index_state SET last_successful_index_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=1;
END;

CREATE TRIGGER search_saved_views_insert AFTER INSERT ON saved_views BEGIN
 INSERT INTO search_views(rowid,name) VALUES(NEW.rowid,NEW.name);
 UPDATE search_index_state SET last_successful_index_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=1;
END;

CREATE TRIGGER search_saved_views_update AFTER UPDATE ON saved_views BEGIN
 DELETE FROM search_views WHERE rowid=OLD.rowid;
 INSERT INTO search_views(rowid,name) VALUES(NEW.rowid,NEW.name);
 UPDATE search_index_state SET last_successful_index_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=1;
END;

CREATE TRIGGER search_saved_views_delete AFTER DELETE ON saved_views BEGIN
 DELETE FROM search_views WHERE rowid=OLD.rowid;
 UPDATE search_index_state SET last_successful_index_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=1;
END;

CREATE TRIGGER search_label_update AFTER UPDATE OF name,workspace_id ON labels BEGIN
 DELETE FROM search_issues WHERE rowid IN (SELECT rowid FROM issues WHERE id IN (SELECT issue_id FROM issue_labels WHERE label_id=NEW.id));
 INSERT INTO search_issues(rowid,text) SELECT rowid,text FROM search_issue_documents WHERE issue_id IN (SELECT id FROM issues WHERE id IN (SELECT issue_id FROM issue_labels WHERE label_id=NEW.id));
 UPDATE search_index_state SET last_successful_index_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=1;
END;

CREATE TRIGGER search_team_workspace AFTER UPDATE OF workspace_id ON teams BEGIN
 DELETE FROM search_issues WHERE rowid IN (SELECT rowid FROM issues WHERE team_id=NEW.id);
 INSERT INTO search_issues(rowid,text) SELECT rowid,text FROM search_issue_documents WHERE issue_id IN (SELECT id FROM issues WHERE team_id=NEW.id);
 UPDATE search_index_state SET last_successful_index_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=1;
END;
