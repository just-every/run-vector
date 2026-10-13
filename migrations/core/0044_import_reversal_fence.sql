-- Base import-kit d1ReversalFenceSchema (479094f), verbatim: indexed reversal
-- fences so each undo or rollback batch reads its next effects by key.
CREATE TABLE IF NOT EXISTS ik_d1_reversal_fences (job_id TEXT PRIMARY KEY REFERENCES ik_jobs(id) ON DELETE CASCADE,action TEXT NOT NULL,fence INTEGER NOT NULL,state_revision INTEGER NOT NULL,erased_records INTEGER NOT NULL,reused INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS ik_provenance_job ON ik_provenance(job_id,reversed,ordinal,effect_ordinal);
CREATE INDEX IF NOT EXISTS ik_provenance_source ON ik_provenance(source_identity,reversed);
CREATE INDEX IF NOT EXISTS ik_d1_history_source ON ik_d1_history(source_identity);
CREATE INDEX IF NOT EXISTS ik_sources_job ON ik_sources(job_id);
