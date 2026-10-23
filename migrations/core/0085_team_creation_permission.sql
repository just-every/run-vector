-- TEAM-008: public-team creation is restricted by default.
ALTER TABLE workspace_settings ADD COLUMN member_team_creation INTEGER NOT NULL DEFAULT 0 CHECK(member_team_creation IN(0,1));
