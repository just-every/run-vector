-- Bind explicit Slack mappings to the workspace verified by auth.test.
ALTER TABLE vector_slack_installations ADD COLUMN slack_team_id TEXT;
