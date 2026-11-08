-- Restore admission is installation state. Keep portable clock rows byte-for-byte.
CREATE TABLE issue_sla_restore_holds (
 issue_id TEXT PRIMARY KEY REFERENCES issues(id) ON DELETE CASCADE
);
DROP TRIGGER sla_restore_hold;
DROP TRIGGER sla_restore_updated;
CREATE TRIGGER sla_restore_hold AFTER INSERT ON vector_restore_status BEGIN
 INSERT INTO issue_sla_restore_holds(issue_id) SELECT id FROM issues WHERE 1 ON CONFLICT(issue_id) DO NOTHING;
END;
CREATE TRIGGER sla_restore_updated AFTER UPDATE OF effects_held ON vector_restore_status WHEN NEW.effects_held=1 BEGIN
 INSERT INTO issue_sla_restore_holds(issue_id) SELECT id FROM issues WHERE 1 ON CONFLICT(issue_id) DO NOTHING;
END;
