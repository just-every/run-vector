-- Additive: archived issues keep every row and link; lists and default search leave them out (AUTO-003).
ALTER TABLE issues ADD COLUMN archived_at TEXT;
CREATE INDEX issues_archived_idx ON issues(archived_at);
CREATE TABLE team_housekeeping (
 team_id TEXT PRIMARY KEY REFERENCES teams(id) ON DELETE CASCADE,
 close_after_days INTEGER CHECK(close_after_days IS NULL OR close_after_days BETWEEN 1 AND 3650),
 archive_after_days INTEGER CHECK(archive_after_days IS NULL OR archive_after_days BETWEEN 1 AND 3650),
 exempt_bugs INTEGER NOT NULL DEFAULT 1 CHECK(exempt_bugs IN (0,1)),
 revision TEXT NOT NULL,
 updated_at TEXT NOT NULL
);
