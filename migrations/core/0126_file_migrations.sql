CREATE TABLE vector_file_migrations (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspace_settings(id),
  source TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'open' CHECK(state IN ('open','finished')),
  version INTEGER NOT NULL DEFAULT 1,
  accepted_version INTEGER,
  accepted_fingerprint TEXT,
  finished_by TEXT REFERENCES operators(id),
  finished_at TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(workspace_id,source)
);
CREATE TABLE vector_migration_runs (
  job_id TEXT PRIMARY KEY REFERENCES ik_jobs(id) ON DELETE CASCADE,
  migration_id TEXT NOT NULL REFERENCES vector_file_migrations(id),
  created_at TEXT NOT NULL
);
CREATE INDEX vector_migration_runs_migration ON vector_migration_runs(migration_id);
CREATE TABLE vector_migration_references (
  id TEXT PRIMARY KEY,
  migration_id TEXT NOT NULL REFERENCES vector_file_migrations(id),
  job_id TEXT NOT NULL REFERENCES ik_jobs(id) ON DELETE CASCADE,
  source_row INTEGER NOT NULL,
  source_id TEXT NOT NULL,
  target_source_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('parent','dependencies','duplicateOf','blocks','related')),
  state TEXT NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','omitted'))
);
CREATE INDEX vector_migration_references_migration ON vector_migration_references(migration_id,state);
CREATE TRIGGER vector_migration_run_progress AFTER UPDATE OF state,checkpoint ON ik_jobs
WHEN NEW.state<>OLD.state OR NEW.checkpoint<>OLD.checkpoint
BEGIN
  UPDATE vector_file_migrations SET version=version+1
  WHERE id IN (SELECT migration_id FROM vector_migration_runs WHERE job_id=NEW.id);
END;
CREATE TRIGGER vector_migration_run_retirement BEFORE DELETE ON ik_jobs
BEGIN
  UPDATE vector_file_migrations SET version=version+1
  WHERE id IN (SELECT migration_id FROM vector_migration_runs WHERE job_id=OLD.id);
END;
