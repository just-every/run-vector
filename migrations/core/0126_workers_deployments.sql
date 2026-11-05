-- Authenticated deployment assertions and content-bound receipts survive rollback.
-- Credentials are never stored here; restored effects require explicit review.
CREATE TABLE vector_deployment_reports (
 id TEXT PRIMARY KEY,
 repository_id TEXT NOT NULL REFERENCES vector_github_repositories(id),
 provider TEXT NOT NULL CHECK(provider='cloudflare-workers'),
 account_id TEXT NOT NULL,
 worker_id TEXT NOT NULL,
 deployment_id TEXT NOT NULL,
 sha TEXT NOT NULL,
 environment TEXT NOT NULL,
 deployed_at TEXT NOT NULL,
 payload_hash TEXT NOT NULL,
 reported_by TEXT REFERENCES operators(id) ON DELETE SET NULL,
 received_at TEXT NOT NULL,
 UNIQUE(repository_id,provider,account_id,worker_id,deployment_id)
);
CREATE TABLE vector_issue_deployments (
 report_id TEXT NOT NULL REFERENCES vector_deployment_reports(id),
 issue_id TEXT NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
 PRIMARY KEY(report_id,issue_id)
);
CREATE INDEX vector_deployment_issue ON vector_issue_deployments(issue_id);
