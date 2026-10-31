-- Portable team defaults; deleting a default never changes created issues.
ALTER TABLE teams ADD COLUMN default_issue_template_json TEXT CHECK(default_issue_template_json IS NULL OR (json_valid(default_issue_template_json) AND json_type(default_issue_template_json)='object'));
