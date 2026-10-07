-- Named automation attribution is additive; original operator actors and
-- intake decisions/timestamps remain unchanged.
ALTER TABLE issue_activity ADD COLUMN actor_name TEXT;
