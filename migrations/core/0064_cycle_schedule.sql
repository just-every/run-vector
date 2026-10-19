CREATE TABLE team_cycle_schedules (
 team_id TEXT PRIMARY KEY REFERENCES teams(id) ON DELETE CASCADE,
 weeks INTEGER NOT NULL CHECK(weeks BETWEEN 1 AND 8),
 start_weekday INTEGER NOT NULL CHECK(start_weekday BETWEEN 0 AND 6),
 cooldown_weeks INTEGER NOT NULL CHECK(cooldown_weeks BETWEEN 0 AND 8),
 upcoming_count INTEGER NOT NULL CHECK(upcoming_count BETWEEN 1 AND 24),
 revision TEXT NOT NULL,
 generation INTEGER NOT NULL DEFAULT 0,
 updated_at TEXT NOT NULL
);
ALTER TABLE cycles ADD COLUMN schedule_revision TEXT;
