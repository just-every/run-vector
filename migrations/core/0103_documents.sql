CREATE TABLE documents (
 id TEXT PRIMARY KEY,
 workspace_id TEXT NOT NULL REFERENCES workspace_settings(id),
 parent_kind TEXT NOT NULL CHECK(parent_kind IN ('project','issue','initiative','team')),
 parent_id TEXT NOT NULL,
 title TEXT NOT NULL,
 body TEXT NOT NULL DEFAULT '',
 author_operator_id TEXT NOT NULL REFERENCES operators(id),
 version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL
);
CREATE INDEX documents_parent ON documents(workspace_id,parent_kind,parent_id,updated_at,id);
CREATE TABLE document_revisions (
 id TEXT PRIMARY KEY,
 document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
 version INTEGER NOT NULL CHECK(version>0),
 title TEXT NOT NULL,
 body TEXT NOT NULL,
 author_operator_id TEXT NOT NULL REFERENCES operators(id),
 created_at TEXT NOT NULL,
 UNIQUE(document_id,version)
);
CREATE TABLE document_comments (
 id TEXT PRIMARY KEY,
 document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
 body TEXT NOT NULL,
 author_operator_id TEXT NOT NULL REFERENCES operators(id),
 created_at TEXT NOT NULL
);
CREATE INDEX document_comments_order ON document_comments(document_id,created_at,id);
CREATE TABLE issue_specifications (
 issue_id TEXT PRIMARY KEY REFERENCES issues(id) ON DELETE CASCADE,
 document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
 author_operator_id TEXT NOT NULL REFERENCES operators(id),
 updated_at TEXT NOT NULL
);
CREATE TRIGGER documents_issue_deleted AFTER DELETE ON issues BEGIN
 DELETE FROM documents WHERE parent_kind='issue' AND parent_id=OLD.id;
END;
CREATE TRIGGER documents_project_deleted AFTER DELETE ON projects BEGIN
 DELETE FROM documents WHERE parent_kind='project' AND parent_id=OLD.id;
END;
CREATE TRIGGER documents_initiative_deleted AFTER DELETE ON initiatives BEGIN
 DELETE FROM documents WHERE parent_kind='initiative' AND parent_id=OLD.id;
END;
CREATE TRIGGER documents_team_deleted AFTER DELETE ON teams BEGIN
 DELETE FROM documents WHERE parent_kind='team' AND parent_id=OLD.id;
END;
