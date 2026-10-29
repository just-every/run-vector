-- Non-secret settings are portable; sealed credentials remain excluded and need re-entry.
CREATE TABLE vector_model_providers (
 id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES workspace_settings(id),
 name TEXT NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('anthropic','self-hosted')),
 endpoint TEXT NOT NULL, model TEXT NOT NULL, terms_url TEXT, retention TEXT,
 confirmed_at TEXT, created_at TEXT NOT NULL
);
CREATE TABLE vector_model_policies (
 workspace_id TEXT NOT NULL REFERENCES workspace_settings(id),
 feature TEXT NOT NULL CHECK(feature IN ('triage','semantic-search','ask','drafting')),
 team_id TEXT NOT NULL DEFAULT '', enabled INTEGER NOT NULL CHECK(enabled IN (0,1)),
 provider_id TEXT REFERENCES vector_model_providers(id),
 PRIMARY KEY(workspace_id,feature,team_id)
);
