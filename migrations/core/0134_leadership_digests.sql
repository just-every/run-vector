CREATE TABLE leadership_digest_preferences (
 operator_id TEXT PRIMARY KEY REFERENCES operators(id) ON DELETE CASCADE,
 email_enabled INTEGER NOT NULL DEFAULT 0 CHECK(email_enabled IN(0,1)),
 slack_enabled INTEGER NOT NULL DEFAULT 0 CHECK(slack_enabled IN(0,1)),
 revision TEXT NOT NULL
);
CREATE TABLE leadership_digest_receipts (
 id TEXT PRIMARY KEY,
 workspace_id TEXT NOT NULL REFERENCES workspace_settings(id),
 recipient_id TEXT NOT NULL REFERENCES operators(id) ON DELETE CASCADE,
 slot TEXT NOT NULL, channel TEXT NOT NULL CHECK(channel IN('email','slack')),
 status TEXT NOT NULL CHECK(status IN('pending','claimed','retry','accepted','failed','suppressed','uncertain')),
 attempts INTEGER NOT NULL DEFAULT 0, claim_token TEXT, claimed_at TEXT,
 next_attempt_at TEXT, reason TEXT, snapshot_json TEXT NOT NULL DEFAULT '{}',
 preference_revision TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
 UNIQUE(workspace_id,recipient_id,slot,channel)
);
CREATE INDEX leadership_digest_due ON leadership_digest_receipts(status,next_attempt_at);
CREATE TABLE leadership_digest_restore_holds (
 receipt_id TEXT PRIMARY KEY REFERENCES leadership_digest_receipts(id) ON DELETE CASCADE
);
CREATE TRIGGER leadership_digest_restore_hold AFTER INSERT ON leadership_digest_receipts
 WHEN EXISTS(SELECT 1 FROM rer_portability_state WHERE applying=1)
 BEGIN INSERT OR IGNORE INTO leadership_digest_restore_holds(receipt_id) VALUES(NEW.id); END;
CREATE TRIGGER leadership_digest_recipient_erased AFTER UPDATE OF removed_at ON operators
 WHEN NEW.removed_at IS NOT NULL AND OLD.removed_at IS NULL
 BEGIN
 DELETE FROM leadership_digest_preferences WHERE operator_id=NEW.id;
 DELETE FROM leadership_digest_receipts WHERE recipient_id=NEW.id;
 END;
