-- Portable repository identity, PR links and content-bound replay history.
-- Signing credentials remain in the excluded integration secret table.
CREATE TABLE vector_bitbucket_repositories (
 id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES workspace_settings(id),
 repository TEXT NOT NULL, repository_uuid TEXT NOT NULL, name TEXT NOT NULL,
 enabled INTEGER NOT NULL DEFAULT 1, revoked_at TEXT,
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
 UNIQUE(workspace_id, repository_uuid)
);
CREATE TABLE vector_bitbucket_pull_requests (
 repository_id TEXT NOT NULL REFERENCES vector_bitbucket_repositories(id),
 number INTEGER NOT NULL, title TEXT NOT NULL, url TEXT NOT NULL,
 state TEXT NOT NULL CHECK(state IN ('OPEN','MERGED')),
 updated_at TEXT NOT NULL, received_at TEXT NOT NULL,
 PRIMARY KEY(repository_id,number)
);
CREATE TABLE vector_bitbucket_issue_links (
 repository_id TEXT NOT NULL, number INTEGER NOT NULL,
 issue_id TEXT NOT NULL REFERENCES issues(id) ON DELETE CASCADE, created_at TEXT NOT NULL,
 PRIMARY KEY(repository_id,number,issue_id),
 FOREIGN KEY(repository_id,number) REFERENCES vector_bitbucket_pull_requests(repository_id,number)
);
CREATE INDEX vector_bitbucket_links_issue ON vector_bitbucket_issue_links(issue_id);
CREATE TABLE vector_bitbucket_deliveries (
 repository_id TEXT NOT NULL REFERENCES vector_bitbucket_repositories(id),
 delivery_id TEXT NOT NULL, payload_hash TEXT NOT NULL, event_key TEXT NOT NULL,
 received_at TEXT NOT NULL, diagnostic TEXT NOT NULL,
 PRIMARY KEY(repository_id,delivery_id)
);
