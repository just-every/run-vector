-- Additive ISSUE-014 policy; existing workspaces continue to allow Member creation.
ALTER TABLE workspace_settings ADD COLUMN member_label_creation INTEGER NOT NULL DEFAULT 1 CHECK(member_label_creation IN (0,1));
