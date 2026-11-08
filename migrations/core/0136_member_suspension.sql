-- removed_at remains the shared inactive admission fence. Only suspended_at
-- distinguishes reversible suspension from legacy anonymous removal.
ALTER TABLE operators ADD COLUMN suspended_at TEXT;
ALTER TABLE operators ADD COLUMN suspended_by TEXT REFERENCES operators(id);
CREATE TABLE member_lifecycle_events (
 id TEXT PRIMARY KEY,
 operator_id TEXT NOT NULL REFERENCES operators(id),
 workspace_id TEXT NOT NULL REFERENCES workspace_settings(id),
 actor_operator_id TEXT NOT NULL REFERENCES operators(id),
 successor_operator_id TEXT REFERENCES operators(id),
 action TEXT NOT NULL CHECK(action IN ('suspended','left','reactivated')),
 method TEXT NOT NULL CHECK(method IN ('settings','self','invitation')),
 assignments TEXT CHECK(assignments IN ('keep','unassign')),
 created_at TEXT NOT NULL
);
CREATE INDEX member_lifecycle_member ON member_lifecycle_events(operator_id,created_at,id);

DROP TRIGGER vector_operator_auth_remove;
CREATE TRIGGER vector_operator_auth_remove AFTER UPDATE OF removed_at ON operators
 WHEN OLD.removed_at IS NULL AND NEW.removed_at IS NOT NULL BEGIN
 UPDATE oa_tokens SET revoked_at=COALESCE(revoked_at,CAST(unixepoch('now')*1000 AS INTEGER))
 WHERE operator_id IN(SELECT auth_id FROM vector_auth_operators WHERE operator_id=NEW.id)
 OR issuer_id IN(SELECT auth_id FROM vector_auth_operators WHERE operator_id=NEW.id);
 UPDATE oa_sessions SET revoked_at=COALESCE(revoked_at,CAST(unixepoch('now')*1000 AS INTEGER))
 WHERE operator_id IN(SELECT auth_id FROM vector_auth_operators WHERE operator_id=NEW.id);
 UPDATE oa_operators SET status='inactive',email=NEW.email,display_name=NEW.name
 WHERE id IN(SELECT auth_id FROM vector_auth_operators WHERE operator_id=NEW.id) AND NEW.suspended_at IS NOT NULL;
 UPDATE oa_operators SET status='inactive',email=NEW.email,display_name='Removed operator'
 WHERE id IN(SELECT auth_id FROM vector_auth_operators WHERE operator_id=NEW.id) AND NEW.suspended_at IS NULL;
 UPDATE vector_oauth_grants SET revoked_at=COALESCE(revoked_at,CAST(unixepoch('now')*1000 AS INTEGER)) WHERE operator_id=NEW.id;
 DELETE FROM vector_oauth_codes WHERE operator_id=NEW.id;
 UPDATE agent_door_agents SET revoked=1 WHERE sponsor=NEW.id;
 UPDATE calendar_feed_tokens SET revoked_at=COALESCE(revoked_at,NEW.removed_at) WHERE creator_id=NEW.id;
END;

-- Suspension preserves personal choices and follows. Pending digest batches
-- are cancelled, and existing active-recipient views refuse any future send.
DROP TRIGGER notification_channel_member_erasure;
CREATE TRIGGER notification_channel_member_erasure AFTER UPDATE OF removed_at ON operators
 WHEN NEW.removed_at IS NOT NULL BEGIN
 DELETE FROM notification_channel_overrides WHERE operator_id=NEW.id AND NEW.suspended_at IS NULL;
 DELETE FROM rer_mail_development_outbox WHERE json_extract(message,'$.deliveryId') IN(SELECT id FROM notification_digest_batches WHERE recipient_id=NEW.id);
 DELETE FROM notification_digest_windows WHERE recipient_id=NEW.id;
 DELETE FROM notification_digest_batches WHERE recipient_id=NEW.id;
END;
DROP TRIGGER subscription_operator_removed;
CREATE TRIGGER subscription_operator_removed AFTER UPDATE OF removed_at ON operators
 WHEN NEW.removed_at IS NOT NULL AND NEW.suspended_at IS NULL BEGIN
 DELETE FROM subject_subscriptions WHERE operator_id=NEW.id;
 DELETE FROM subscription_event_receipts WHERE operator_id=NEW.id;
END;
DROP TRIGGER subscription_operator_suspended;
CREATE TRIGGER subscription_operator_suspended AFTER UPDATE OF status ON oa_operators
 WHEN NEW.status<>'active' AND NOT EXISTS(SELECT 1 FROM vector_auth_operators m JOIN operators o ON o.id=m.operator_id WHERE m.auth_id=NEW.id AND o.suspended_at IS NOT NULL) BEGIN
 DELETE FROM subject_subscriptions WHERE operator_id IN(SELECT operator_id FROM vector_auth_operators WHERE auth_id=NEW.id);
 DELETE FROM subscription_event_receipts WHERE operator_id IN(SELECT operator_id FROM vector_auth_operators WHERE auth_id=NEW.id);
END;
