-- ROLE-009 (team.permissions.v1): each team decides who manages its settings
-- (default Team owners only) and who manages its cycles and templates (default
-- All team members). Owners and Admins pass both and Guests fail both,
-- whatever their value.
ALTER TABLE teams ADD COLUMN settings_permission TEXT NOT NULL DEFAULT 'team_owners' CHECK(settings_permission IN ('team_owners','all_members'));
ALTER TABLE teams ADD COLUMN planning_permission TEXT NOT NULL DEFAULT 'all_members' CHECK(planning_permission IN ('team_owners','all_members'));
