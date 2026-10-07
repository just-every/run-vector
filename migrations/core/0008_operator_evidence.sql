-- Preserve existing source evidence and its assertions byte-for-byte.
ALTER TABLE evidence_revisions ADD COLUMN origin_kind TEXT NOT NULL DEFAULT 'source' CHECK(origin_kind IN ('source','operator'));
ALTER TABLE evidence_revisions ADD COLUMN actor_operator_id TEXT REFERENCES operators(id);
ALTER TABLE evidence_revisions ADD COLUMN link TEXT;
ALTER TABLE evidence_revisions ADD COLUMN customer_reports_json TEXT NOT NULL DEFAULT '[]';
