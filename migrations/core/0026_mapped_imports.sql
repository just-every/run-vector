-- Native revisions are attribution markers, never a substitute for full-value
-- and related-row predicates supplied by Vector's D1 target adapter.
CREATE TABLE vector_import_revisions (
 issue_id TEXT PRIMARY KEY REFERENCES issues(id) ON DELETE CASCADE,
 revision TEXT NOT NULL
);

-- Base may gather fewer whole entries to respect a request budget. Vector's
-- accepted import publishes its complete native batch or aborts that batch.
CREATE TRIGGER vector_import_whole_apply BEFORE UPDATE OF checkpoint ON ik_jobs
WHEN NEW.namespace LIKE 'vector-import:%' AND NEW.checkpoint>OLD.checkpoint AND NEW.checkpoint<>NEW.total
BEGIN SELECT RAISE(ABORT,'vector_import_atomic_limit'); END;

CREATE TRIGGER vector_import_whole_reversal AFTER INSERT ON ik_batches
WHEN NEW.action IN ('undo','rollback')
 AND EXISTS(SELECT 1 FROM ik_jobs WHERE id=NEW.job_id AND namespace LIKE 'vector-import:%')
 AND EXISTS(SELECT 1 FROM ik_provenance WHERE job_id=NEW.job_id AND reversed=0)
BEGIN SELECT RAISE(ABORT,'vector_import_atomic_limit'); END;

-- The run audit shares the native publication transaction. Reusing an import
-- or another run's identical source claims cannot mint another import event.
CREATE TRIGGER vector_import_run_audit AFTER UPDATE OF state ON ik_jobs
WHEN NEW.namespace LIKE 'vector-import:%' AND NEW.state='completed' AND OLD.state<>'completed'
 AND EXISTS(SELECT 1 FROM ik_sources WHERE job_id=NEW.id)
BEGIN
 INSERT INTO audit_records(id,actor_operator_id,action,subject_identifier,subject_id,created_at,updated_at)
 VALUES(NEW.id,NEW.principal_id,'issues.imported',NEW.namespace,NEW.id,
 strftime('%Y-%m-%dT%H:%M:%fZ','now'),strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;
