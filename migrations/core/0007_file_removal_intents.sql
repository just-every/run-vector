-- A deletion request is durable before any R2 work. deleted_at alone is not a
-- physical-erasure receipt for old pending uploads.
ALTER TABLE issue_files ADD COLUMN writer_settled INTEGER NOT NULL DEFAULT 1 CHECK(writer_settled IN (0,1));
ALTER TABLE issue_files ADD COLUMN removal_requested_at TEXT;
ALTER TABLE issue_files ADD COLUMN removal_actor_operator_id TEXT REFERENCES operators(id);
ALTER TABLE issue_files ADD COLUMN removal_confirmed_at TEXT;
ALTER TABLE issue_files ADD COLUMN cleanup_error TEXT;
ALTER TABLE issue_files ADD COLUMN content_sha256 TEXT;

UPDATE issue_files SET writer_settled=0 WHERE state='pending';
-- Preserve old timestamps/history and retain exact keys for orphan recovery.
UPDATE issue_files SET removal_requested_at=deleted_at WHERE deleted_at IS NOT NULL;
CREATE INDEX issue_files_removal_idx ON issue_files(removal_confirmed_at,removal_requested_at,updated_at);
