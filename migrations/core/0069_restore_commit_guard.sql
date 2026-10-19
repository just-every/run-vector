-- Hold HTTP restore authority at the commit itself, not at every Base guard.
-- Base (rer 0.2.71) fences each lease-held batch with a rer_portability_guard row,
-- including failure settlement after a refused commit. Checking authority on
-- every guard while applying also refused that settlement, so a revoked restore
-- kept its owned objects and stayed applying. The commit is the job's move to
-- complete, in the same atomic batch as the restored rows; refuse that instead.
DROP TRIGGER vector_http_restore_commit_guard;
CREATE TRIGGER vector_http_restore_commit_guard BEFORE UPDATE OF phase ON rer_portability_jobs
 WHEN NEW.kind='import' AND NEW.phase='complete' AND OLD.phase!='complete'
 AND EXISTS(SELECT 1 FROM vector_http_restore WHERE import_id=NEW.id)
 BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM vector_http_restore_eligible)
 THEN RAISE(ABORT,'restore_authority_changed') END;
 END;
