-- Portable configuration and once receipts; no credential is created for a rule.
CREATE TABLE automation_rules (
 id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES workspace_settings(id),
 team_id TEXT REFERENCES teams(id) ON DELETE CASCADE,
 owner_operator_id TEXT NOT NULL REFERENCES operators(id),
 name TEXT NOT NULL, label_id TEXT NOT NULL,
 priority TEXT NOT NULL CHECK(priority IN ('none','urgent','high','medium','low')),
 destination_id TEXT NOT NULL REFERENCES vector_webhook_destinations(id),
 monthly_budget INTEGER NOT NULL CHECK(monthly_budget>0 AND monthly_budget<=10000),
 enabled INTEGER NOT NULL CHECK(enabled IN (0,1)), version INTEGER NOT NULL CHECK(version>0),
 failure TEXT, failure_notified_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE automation_rule_runs (
 id TEXT PRIMARY KEY, rule_id TEXT NOT NULL REFERENCES automation_rules(id) ON DELETE CASCADE,
 rule_version INTEGER NOT NULL, event_id TEXT NOT NULL,
 issue_id TEXT NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
 state TEXT NOT NULL CHECK(state IN ('pending','succeeded','failed','budget_exhausted','stopped')),
 changes_json TEXT NOT NULL CHECK(json_valid(changes_json)), reason TEXT,
 created_at TEXT NOT NULL, completed_at TEXT, completion_token TEXT,
 UNIQUE(rule_id,event_id)
);
CREATE INDEX automation_pending ON automation_rule_runs(state,created_at,id);
CREATE TABLE automation_rule_usage (
 rule_id TEXT NOT NULL REFERENCES automation_rules(id) ON DELETE CASCADE,
 month TEXT NOT NULL, runs INTEGER NOT NULL CHECK(runs>=0), PRIMARY KEY(rule_id,month)
);
CREATE TABLE automation_rule_restore_holds (
 rule_id TEXT PRIMARY KEY REFERENCES automation_rules(id) ON DELETE CASCADE
);
CREATE TRIGGER automation_restore_hold AFTER INSERT ON vector_restore_status BEGIN
 INSERT OR IGNORE INTO automation_rule_restore_holds(rule_id) SELECT id FROM automation_rules;
END;
CREATE TRIGGER automation_restore_updated AFTER UPDATE OF effects_held ON vector_restore_status WHEN NEW.effects_held=1 BEGIN
 INSERT OR IGNORE INTO automation_rule_restore_holds(rule_id) SELECT id FROM automation_rules;
END;
