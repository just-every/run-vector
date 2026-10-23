ALTER TABLE github_automation_rules ADD COLUMN production_environment TEXT NOT NULL DEFAULT 'production';
CREATE TABLE github_push_proofs (
 repository_id TEXT NOT NULL REFERENCES vector_github_repositories(id),
 delivery_id TEXT NOT NULL,
 after_sha TEXT NOT NULL,
 ancestors_json TEXT NOT NULL,
 received_at TEXT NOT NULL,
 PRIMARY KEY(repository_id,delivery_id)
);
CREATE INDEX github_push_after ON github_push_proofs(repository_id,after_sha);
CREATE TABLE github_deployments (
 repository_id TEXT NOT NULL REFERENCES vector_github_repositories(id),
 deployment_id INTEGER NOT NULL,
 sha TEXT NOT NULL,
 environment TEXT NOT NULL,
 deployed_at TEXT NOT NULL,
 PRIMARY KEY(repository_id,deployment_id)
);
CREATE TABLE github_issue_environments (
 repository_id TEXT NOT NULL,
 deployment_id INTEGER NOT NULL,
 issue_id TEXT NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
 PRIMARY KEY(repository_id,deployment_id,issue_id),
 FOREIGN KEY(repository_id,deployment_id) REFERENCES github_deployments(repository_id,deployment_id)
);
CREATE INDEX github_environment_issue ON github_issue_environments(issue_id);
