-- Native restore publishes table copies with their row triggers suspended.
-- Quarantine historical receipts when the destination's restore status commits.
CREATE TRIGGER leadership_digest_restore_complete AFTER INSERT ON vector_restore_status BEGIN
 INSERT INTO leadership_digest_restore_holds(receipt_id) SELECT id FROM leadership_digest_receipts WHERE 1 ON CONFLICT(receipt_id) DO NOTHING;
END;
CREATE TRIGGER leadership_digest_restore_updated AFTER UPDATE OF effects_held ON vector_restore_status WHEN NEW.effects_held=1 BEGIN
 INSERT INTO leadership_digest_restore_holds(receipt_id) SELECT id FROM leadership_digest_receipts WHERE 1 ON CONFLICT(receipt_id) DO NOTHING;
END;
