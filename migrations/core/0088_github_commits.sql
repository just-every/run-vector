CREATE TABLE github_commit_links (
 repository_id TEXT NOT NULL REFERENCES vector_github_repositories(id),
 sha TEXT NOT NULL,
 issue_id TEXT NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
 author TEXT NOT NULL,
 subject TEXT NOT NULL,
 url TEXT NOT NULL,
 closing_applied INTEGER NOT NULL DEFAULT 0 CHECK(closing_applied IN (0,1)),
 received_at TEXT NOT NULL,
 PRIMARY KEY(repository_id,sha,issue_id)
);
CREATE INDEX github_commit_issue ON github_commit_links(issue_id,received_at);
