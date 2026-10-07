CREATE TABLE issue_comments (
 id TEXT PRIMARY KEY, issue_id TEXT NOT NULL REFERENCES issues(id), actor_operator_id TEXT NOT NULL REFERENCES operators(id),
 body TEXT, edited_at TEXT, deleted_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX issue_comments_issue_idx ON issue_comments(issue_id,created_at);
CREATE TABLE issue_files (
 id TEXT PRIMARY KEY, issue_id TEXT NOT NULL REFERENCES issues(id), actor_operator_id TEXT NOT NULL REFERENCES operators(id),
 name TEXT NOT NULL, content_type TEXT NOT NULL, bytes INTEGER NOT NULL CHECK(bytes>0), blob_key TEXT NOT NULL UNIQUE,
 deleted_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX issue_files_issue_idx ON issue_files(issue_id,created_at);
CREATE TABLE audit_records (
 id TEXT PRIMARY KEY, actor_operator_id TEXT, action TEXT NOT NULL, subject_identifier TEXT NOT NULL,
 subject_id TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
