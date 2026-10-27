-- An Owner or Admin approves one existing destination for one initiative and audience (INIT-001).
-- Identity is the provider, its workspace and the immutable channel identity, never a display name.
CREATE TABLE vector_initiative_destination_approvals (
 id TEXT PRIMARY KEY,
 workspace_id TEXT NOT NULL,
 initiative_id TEXT NOT NULL REFERENCES initiatives(id),
 provider TEXT NOT NULL CHECK(provider IN('slack','discord')),
 provider_workspace TEXT,
 channel_id TEXT NOT NULL,
 channel_name TEXT NOT NULL,
 source_destination_id TEXT REFERENCES vector_webhook_destinations(id),
 audience TEXT NOT NULL CHECK(audience='workspace'),
 approved_by TEXT NOT NULL,
 approved_at TEXT NOT NULL,
 CHECK((provider='discord')=(source_destination_id IS NOT NULL)),
 UNIQUE(workspace_id,initiative_id,provider,channel_id)
);
-- A binding saved through the scoped initiative capability names the approval that admitted it.
CREATE TABLE vector_initiative_scoped_bindings (
 destination_id TEXT PRIMARY KEY REFERENCES vector_webhook_destinations(id),
 workspace_id TEXT NOT NULL,
 initiative_id TEXT NOT NULL REFERENCES initiatives(id),
 approval_id TEXT NOT NULL,
 bound_by TEXT NOT NULL
);
CREATE TRIGGER vector_initiative_scoped_binding_removed AFTER DELETE ON vector_initiative_channel_bindings BEGIN
 DELETE FROM vector_initiative_scoped_bindings WHERE destination_id=OLD.destination_id;
END;
