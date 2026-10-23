-- Team rules are portable configuration; provider credentials remain excluded.
CREATE TABLE github_automation_rules (
 team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
 trigger TEXT NOT NULL CHECK(trigger IN ('draft','review','merged','deploy')),
 status_id TEXT REFERENCES workflow_statuses(id) ON DELETE SET NULL,
 allow_reopen INTEGER NOT NULL DEFAULT 0 CHECK(allow_reopen IN (0,1)),
 version INTEGER NOT NULL,
 updated_at TEXT NOT NULL,
 PRIMARY KEY(team_id,trigger)
);
ALTER TABLE vector_github_pull_requests ADD COLUMN merge_sha TEXT;
ALTER TABLE vector_github_issue_links ADD COLUMN relation TEXT NOT NULL DEFAULT 'reference';
