-- A reviewed import run publishes in staged batches of a size measured at
-- preview. The run row is product bookkeeping; Base's job remains the record of
-- progress, custody and provenance.
CREATE TABLE vector_import_runs (
 job_id TEXT PRIMARY KEY,
 batch_size INTEGER NOT NULL CHECK(batch_size BETWEEN 1 AND 1000),
 last_error TEXT,
 last_error_at TEXT,
 created_at TEXT NOT NULL
);

-- Replaces 0026's one-batch rule. A staged run advances by exactly its batch
-- size, or by the remainder in its final batch, so "N of M batches" stays
-- exact. A run created before this migration still publishes whole.
DROP TRIGGER vector_import_whole_apply;
CREATE TRIGGER vector_import_staged_apply BEFORE UPDATE OF checkpoint ON ik_jobs
WHEN NEW.namespace LIKE 'vector-import:%' AND NEW.checkpoint>OLD.checkpoint
 AND NOT EXISTS(SELECT 1 FROM vector_import_runs r WHERE r.job_id=NEW.id
  AND (NEW.checkpoint-OLD.checkpoint=r.batch_size OR (NEW.checkpoint=NEW.total AND NEW.checkpoint-OLD.checkpoint<r.batch_size)))
 AND NOT (NEW.checkpoint=NEW.total AND NOT EXISTS(SELECT 1 FROM vector_import_runs WHERE job_id=NEW.id))
BEGIN SELECT RAISE(ABORT,'vector_import_batch_boundary'); END;

-- Whole-run rollback of a staged run takes several bounded reversal batches.
-- Vector refuses to start one while any imported issue has later native work,
-- and every reversal batch keeps Base's exact native snapshot guard.
DROP TRIGGER vector_import_whole_reversal;
