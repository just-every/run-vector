-- Hold HTTP restore authority at publication, not at every Base guard.
-- Base (rer 0.2.71) fences each lease-held batch with one rer_portability_guard
-- row, including the failure settlement after a refused publication. Checking
-- authority on that fence while applying also refused the settlement, so a
-- revoked restore kept its owned objects and stayed applying. Guards are deleted
-- at the end of every batch, so a guard row already present means this batch
-- inserts its own guards after its fence: publication, which inserts them before
-- replacing any included table. Check authority there, with the pre-restore state.
DROP TRIGGER vector_http_restore_commit_guard;
CREATE TRIGGER vector_http_restore_commit_guard BEFORE INSERT ON rer_portability_guard
 WHEN EXISTS(SELECT 1 FROM rer_portability_guard)
 AND EXISTS(SELECT 1 FROM vector_http_restore r JOIN rer_portability_state p ON p.import_job=r.import_id WHERE p.applying=1)
 BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM vector_http_restore_eligible)
 THEN RAISE(ABORT,'restore_authority_changed') END;
 END;
