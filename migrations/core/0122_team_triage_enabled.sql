-- Turning triage off keeps pending work, decisions, evidence and deferrals.
ALTER TABLE teams ADD COLUMN triage_enabled INTEGER NOT NULL DEFAULT 1 CHECK(triage_enabled IN(0,1));
