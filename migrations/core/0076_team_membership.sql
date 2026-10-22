-- ROLE-007: every team has a member list and one or more team owners. A
-- public team's membership never narrows what a workspace member sees.
CREATE TABLE team_members (
 team_id TEXT NOT NULL REFERENCES teams(id),
 operator_id TEXT NOT NULL REFERENCES operators(id),
 role TEXT NOT NULL CHECK(role IN ('owner','member')),
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL,
 PRIMARY KEY(team_id,operator_id)
);
CREATE INDEX team_members_operator ON team_members(operator_id);
-- Someone who left or was removed from a team keeps their assigned issues;
-- the team lists them for its owners to reassign until the person rejoins.
CREATE TABLE team_departures (
 team_id TEXT NOT NULL REFERENCES teams(id),
 operator_id TEXT NOT NULL REFERENCES operators(id),
 departed_at TEXT NOT NULL,
 PRIMARY KEY(team_id,operator_id)
);
-- Upgrade default: the installation owner owns every existing team; no other
-- membership is inferred.
INSERT INTO team_members(team_id,operator_id,role,created_at,updated_at)
 SELECT t.id,i.setup_operator_id,'owner',strftime('%Y-%m-%dT%H:%M:%fZ','now'),strftime('%Y-%m-%dT%H:%M:%fZ','now')
 FROM teams t JOIN workspace_installation i ON i.workspace_id=t.workspace_id
 JOIN operators o ON o.id=i.setup_operator_id AND o.removed_at IS NULL;
