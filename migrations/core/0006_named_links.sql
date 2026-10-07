CREATE TABLE issue_links (
 id TEXT PRIMARY KEY,
 issue_id TEXT NOT NULL REFERENCES issues(id),
 comment_id TEXT REFERENCES issue_comments(id),
 actor_operator_id TEXT NOT NULL REFERENCES operators(id),
 name TEXT,
 url TEXT,
 deleted_at TEXT,
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL,
 CHECK ((deleted_at IS NULL AND name IS NOT NULL AND url IS NOT NULL)
     OR (deleted_at IS NOT NULL AND name IS NULL AND url IS NULL))
);
CREATE INDEX issue_links_issue_idx ON issue_links(issue_id,deleted_at,created_at);
CREATE INDEX issue_links_comment_idx ON issue_links(comment_id,deleted_at);
