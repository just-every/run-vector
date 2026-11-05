-- Installation-only credentials and tests. Portable restores require fresh configuration.
CREATE TABLE vector_google_configuration (
 singleton INTEGER PRIMARY KEY CHECK(singleton=1), client_id TEXT NOT NULL,
 secret TEXT NOT NULL, transaction_secret TEXT NOT NULL, generation INTEGER NOT NULL,
 enabled INTEGER NOT NULL CHECK(enabled IN(0,1)), tested INTEGER NOT NULL CHECK(tested IN(0,1)),
 test_session_id TEXT NOT NULL
);
CREATE TABLE vector_google_sessions (
 session_id TEXT PRIMARY KEY REFERENCES oa_sessions(id) ON DELETE CASCADE, generation INTEGER NOT NULL
);
-- Withdrawal or replacement revokes only Google sessions; linked Auth and email stay independent.
CREATE TRIGGER vector_google_configuration_change AFTER UPDATE OF generation ON vector_google_configuration
 BEGIN
 UPDATE oa_sessions SET revoked_at=COALESCE(revoked_at,CAST((julianday('now')-2440587.5)*86400000 AS INTEGER))
 WHERE id IN(SELECT session_id FROM vector_google_sessions);
 END;
CREATE TRIGGER vector_google_configuration_delete BEFORE DELETE ON vector_google_configuration
 BEGIN
 UPDATE oa_sessions SET revoked_at=COALESCE(revoked_at,CAST((julianday('now')-2440587.5)*86400000 AS INTEGER))
 WHERE id IN(SELECT session_id FROM vector_google_sessions);
 END;
