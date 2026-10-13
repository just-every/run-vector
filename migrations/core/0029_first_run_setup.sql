-- Existing configured installations are complete. Fresh bootstrap records are
-- inserted after migrations and require the owner to review their first workspace.
ALTER TABLE workspace_installation ADD COLUMN setup_completed_at TEXT;
UPDATE workspace_installation SET setup_completed_at=updated_at;
