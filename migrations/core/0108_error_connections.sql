-- Provider profiles and replay history are portable; credentials use the excluded secret store.
CREATE TABLE vector_error_connections (
 source_id TEXT PRIMARY KEY REFERENCES vector_integration_sources(id),
 provider TEXT NOT NULL CHECK(provider IN ('sentry','datadog')),
 regression_rule TEXT NOT NULL CHECK(regression_rule IN ('reopen','comment','ignore')),
 actor_id TEXT NOT NULL REFERENCES operators(id),
 UNIQUE(source_id,provider)
);
