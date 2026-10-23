-- TEAM-007: explicit request exposure; existing public teams stay open.
ALTER TABLE teams ADD COLUMN membership_mode TEXT NOT NULL DEFAULT 'open' CHECK(membership_mode IN('open','invite_only'));
ALTER TABLE teams ADD COLUMN requests_enabled INTEGER NOT NULL DEFAULT 0 CHECK(requests_enabled IN(0,1));
CREATE TABLE team_join_requests (
 team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
 requester_id TEXT NOT NULL REFERENCES operators(id) ON DELETE CASCADE,
 state TEXT NOT NULL CHECK(state IN('pending','approved','declined')),
 decided_by TEXT REFERENCES operators(id) ON DELETE SET NULL,
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL,
 decided_at TEXT,
 PRIMARY KEY(team_id,requester_id)
);
