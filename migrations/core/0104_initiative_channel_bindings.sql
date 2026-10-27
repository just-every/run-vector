-- Initiative subjects share destination custody and durable delivery history.
CREATE TABLE vector_initiative_channel_bindings (
 destination_id TEXT PRIMARY KEY REFERENCES vector_webhook_destinations(id),
 workspace_id TEXT NOT NULL, scope TEXT NOT NULL DEFAULT 'initiative' CHECK(scope='initiative'),
 object_id TEXT NOT NULL REFERENCES initiatives(id), channel_id TEXT NOT NULL, channel_name TEXT NOT NULL,
 events TEXT NOT NULL CHECK(json_valid(events)), created_by TEXT NOT NULL, suspended_reason TEXT,
 UNIQUE(workspace_id,scope,object_id)
);
-- Removal retires new subjects without changing any existing issue trigger.
CREATE TRIGGER vector_initiative_channel_operator_removed AFTER UPDATE OF removed_at ON operators
WHEN NEW.removed_at IS NOT NULL BEGIN
 UPDATE vector_webhook_destinations SET enabled=0,revoked_at=COALESCE(revoked_at,NEW.removed_at)
 WHERE id IN(SELECT destination_id FROM vector_initiative_channel_bindings WHERE created_by=NEW.id);
END;
