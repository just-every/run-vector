-- Additive workspace configuration and durable per-issue calendar receipts.
CREATE TABLE workspace_due_rules (
 id TEXT PRIMARY KEY,
 workspace_id TEXT NOT NULL UNIQUE REFERENCES workspace_settings(id),
 name TEXT NOT NULL,
 owner_operator_id TEXT REFERENCES operators(id) ON DELETE SET NULL,
 enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN (0,1)),
 version INTEGER NOT NULL DEFAULT 1,
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL
);
CREATE TABLE workspace_due_rule_runs (
 id TEXT NOT NULL UNIQUE,
 rule_id TEXT NOT NULL REFERENCES workspace_due_rules(id),
 issue_id TEXT NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
 due_date TEXT NOT NULL,
 recipient_id TEXT REFERENCES operators(id) ON DELETE SET NULL,
 cycle_id TEXT REFERENCES cycles(id) ON DELETE SET NULL,
 outcome TEXT NOT NULL CHECK(outcome IN ('succeeded','failed')),
 reason TEXT,
 notified INTEGER NOT NULL DEFAULT 0 CHECK(notified IN (0,1)),
 last_failure TEXT,
 failed_at TEXT,
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL,
 PRIMARY KEY(rule_id,issue_id,due_date)
);
CREATE INDEX workspace_due_runs_history ON workspace_due_rule_runs(rule_id,updated_at);
