-- Explicit Owner choices outlive whole-run rollback without retaining raw
-- source labels in the immutable audit trail.
ALTER TABLE issue_alias_prefixes ADD COLUMN owner_configured INTEGER NOT NULL DEFAULT 0 CHECK(owner_configured IN (0,1));
UPDATE issue_alias_prefixes SET owner_configured=1 WHERE EXISTS(
  SELECT 1 FROM audit_records a WHERE a.workspace_id=issue_alias_prefixes.workspace_id
  AND a.action='data.alias_prefix_changed' AND a.subject_identifier=issue_alias_prefixes.prefix COLLATE NOCASE
);
