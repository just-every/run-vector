-- NOTIFY-007. Forward-only channel choices and durable digest envelopes.
-- Retain receipts, terminal outcomes and local slots on compatible-source rollback.
CREATE TABLE notification_channel_defaults (
 workspace_id TEXT NOT NULL REFERENCES workspace_settings(id) ON DELETE CASCADE,
 kind TEXT NOT NULL CHECK(kind IN ('assignment','mention','comment','thread_reopened','intake_return','unblocked','due_reminder','status','completed','canceled','duplicate','archived','urgent','blocking','due_changed','reminder')),
 email_mode TEXT NOT NULL CHECK(email_mode IN ('off','immediate','hourly','daily')),
 slack_enabled INTEGER NOT NULL CHECK(slack_enabled IN (0,1)), PRIMARY KEY(workspace_id,kind)
);
CREATE TABLE notification_channel_overrides (
 operator_id TEXT NOT NULL REFERENCES operators(id) ON DELETE CASCADE,
 kind TEXT NOT NULL CHECK(kind IN ('assignment','mention','comment','thread_reopened','intake_return','unblocked','due_reminder','status','completed','canceled','duplicate','archived','urgent','blocking','due_changed','reminder')),
 email_mode TEXT NOT NULL CHECK(email_mode IN ('off','immediate','hourly','daily')),
 slack_enabled INTEGER NOT NULL CHECK(slack_enabled IN (0,1)), PRIMARY KEY(operator_id,kind)
);
CREATE TABLE notification_channel_receipts (
 notification_id TEXT PRIMARY KEY REFERENCES notifications(id) ON DELETE CASCADE
);
-- Enabling routing never creates mail or Slack for historical Inbox rows.
INSERT INTO notification_channel_receipts SELECT id FROM notifications;
ALTER TABLE notification_deliveries ADD COLUMN email_mode TEXT NOT NULL DEFAULT 'immediate'
 CHECK(email_mode IN ('immediate','hourly','daily'));
CREATE TABLE notification_digest_batches (
 id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES workspace_settings(id) ON DELETE CASCADE,
 recipient_id TEXT NOT NULL REFERENCES operators(id) ON DELETE CASCADE,
 cadence TEXT NOT NULL CHECK(cadence IN ('hourly','daily')), slot TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('pending','claimed','retry','accepted','development','uncertain','failed','suppressed')),
 attempts INTEGER NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 3),
 claim_token TEXT,claimed_at TEXT,next_attempt_at TEXT,reason TEXT,
 created_at TEXT NOT NULL,updated_at TEXT NOT NULL,
 UNIQUE(workspace_id,recipient_id,cadence,slot)
);
CREATE INDEX notification_digest_due ON notification_digest_batches(status,next_attempt_at,created_at);
-- A payload-free reservation of each actual local dispatch window. A batch may
-- retry in its own window or reserve a later one; another batch may never share it.
CREATE TABLE notification_digest_windows (
 workspace_id TEXT NOT NULL REFERENCES workspace_settings(id) ON DELETE CASCADE,
 recipient_id TEXT NOT NULL REFERENCES operators(id) ON DELETE CASCADE,
 cadence TEXT NOT NULL CHECK(cadence IN ('hourly','daily')),slot TEXT NOT NULL,
 batch_id TEXT REFERENCES notification_digest_batches(id) ON DELETE SET NULL,
 PRIMARY KEY(workspace_id,recipient_id,cadence,slot)
);
CREATE TABLE notification_digest_items (
 notification_id TEXT PRIMARY KEY REFERENCES notification_deliveries(notification_id) ON DELETE CASCADE,
 batch_id TEXT NOT NULL REFERENCES notification_digest_batches(id) ON DELETE CASCADE
);
CREATE INDEX notification_digest_members ON notification_digest_items(batch_id,notification_id);
CREATE TABLE notification_digest_attempts (
 id TEXT PRIMARY KEY,batch_id TEXT NOT NULL REFERENCES notification_digest_batches(id) ON DELETE CASCADE,
 number INTEGER NOT NULL CHECK(number BETWEEN 1 AND 3),status TEXT NOT NULL,reason TEXT,
 started_at TEXT NOT NULL,settled_at TEXT,UNIQUE(batch_id,number)
);
-- Shared current policy for ordinary, scheduled and SQL-trigger notifications.
CREATE VIEW notification_channel_routes AS
 SELECT n.id notification_id,o.id recipient_id,t.workspace_id,
 CASE (SELECT MIN(CASE COALESCE((SELECT email_mode FROM notification_channel_overrides WHERE operator_id=o.id AND kind=cause.value),(SELECT email_mode FROM notification_channel_defaults WHERE workspace_id=t.workspace_id AND kind=cause.value),CASE WHEN cause.value IN ('assignment','mention') THEN 'immediate' ELSE 'off' END) WHEN 'immediate' THEN 0 WHEN 'hourly' THEN 1 WHEN 'daily' THEN 2 ELSE 3 END) FROM json_each(n.causes_json) cause WHERE NOT EXISTS(SELECT 1 FROM notification_type_mutes mute WHERE mute.operator_id=o.id AND mute.kind=cause.value)) WHEN 0 THEN 'immediate' WHEN 1 THEN 'hourly' WHEN 2 THEN 'daily' ELSE 'off' END email_mode,
 COALESCE((SELECT email_enabled FROM notification_preferences WHERE operator_id=o.id),1) email_enabled,
 EXISTS(SELECT 1 FROM json_each(n.causes_json) cause WHERE NOT EXISTS(SELECT 1 FROM notification_type_mutes mute WHERE mute.operator_id=o.id AND mute.kind=cause.value) AND COALESCE((SELECT slack_enabled FROM notification_channel_overrides WHERE operator_id=o.id AND kind=cause.value),(SELECT slack_enabled FROM notification_channel_defaults WHERE workspace_id=t.workspace_id AND kind=cause.value),EXISTS(SELECT 1 FROM vector_slack_member_links legacy,json_each(legacy.dm_kinds) selected WHERE legacy.operator_id=o.id AND selected.value=cause.value),0)=1) slack_enabled,
 (SELECT json_group_array(cause.value) FROM json_each(n.causes_json) cause WHERE NOT EXISTS(SELECT 1 FROM notification_type_mutes mute WHERE mute.operator_id=o.id AND mute.kind=cause.value) AND COALESCE((SELECT email_mode FROM notification_channel_overrides WHERE operator_id=o.id AND kind=cause.value),(SELECT email_mode FROM notification_channel_defaults WHERE workspace_id=t.workspace_id AND kind=cause.value),CASE WHEN cause.value IN ('assignment','mention') THEN 'immediate' ELSE 'off' END)<>'off') mail_causes_json
 FROM notifications n JOIN issues i ON i.id=n.issue_id JOIN teams t ON t.id=i.team_id
 JOIN operators o ON o.id=n.recipient_id AND o.workspace_id=t.workspace_id
 WHERE o.removed_at IS NULL
 AND NOT EXISTS(SELECT 1 FROM vector_auth_operators mapping JOIN oa_operators native ON native.id=mapping.auth_id WHERE mapping.operator_id=o.id AND native.status<>'active')
 AND (o.role<>'guest' OR EXISTS(SELECT 1 FROM team_members visible WHERE visible.operator_id=o.id AND visible.team_id=i.team_id))
 AND (n.actor_id IS NULL OR n.actor_id<>o.id)
 AND NOT EXISTS(SELECT 1 FROM issue_notification_mutes mute WHERE mute.issue_id=i.id AND mute.operator_id=o.id);
CREATE VIEW notification_mail_admission AS
 SELECT d.*,o.email,r.mail_causes_json,
 COALESCE((SELECT CASE WHEN person.role='guest' THEN person.name||' (Guest)' ELSE person.name END FROM operators person WHERE person.id=d.actor_id),d.actor_name) current_actor_name,
 EXISTS(SELECT 1 FROM json_each(r.mail_causes_json) WHERE value='assignment') assignment,
 EXISTS(SELECT 1 FROM json_each(r.mail_causes_json) WHERE value='mention') mention
 FROM notification_deliveries d JOIN notification_channel_routes r ON r.notification_id=d.notification_id
 JOIN operators o ON o.id=d.recipient_id
 WHERE d.status='claimed' AND r.email_enabled=1 AND r.email_mode=d.email_mode
 AND NOT EXISTS(SELECT 1 FROM vector_restore_status WHERE effects_held=1)
 AND NOT EXISTS(SELECT 1 FROM rer_portability_state WHERE applying=1)
 AND NOT EXISTS(SELECT 1 FROM vector_restore_mail_holds hold WHERE hold.delivery_id=d.id);
CREATE VIEW notification_mail_messages AS
 SELECT d.id delivery_id,d.claim_token,d.email,d.current_actor_name actor_name,d.assignment,d.mention,
 d.identifier||': '||d.title subject,
 d.identifier||': '||d.title||char(10)||
 CASE WHEN d.assignment=1 AND d.mention=1 THEN 'This issue was assigned to you, and you were mentioned.'
 WHEN d.assignment=1 THEN 'This issue was assigned to you.'
 WHEN d.mention=1 THEN 'You were mentioned on this issue.'
 ELSE 'Events: '||(SELECT group_concat(value,', ') FROM json_each(d.mail_causes_json))||'.' END
 ||char(10)||'By: '||COALESCE(d.current_actor_name,'Vector')||char(10)||char(10)||d.app_link||char(10)||'Sign in to view this issue.' text
 FROM notification_mail_admission d;
CREATE VIEW notification_digest_messages AS
 SELECT b.id delivery_id,b.claim_token,o.email,
 'Vector notifications ('||count(m.delivery_id)||')' subject,
 json_group_array(m.identifier) identifiers_json,json_group_array(m.item_delivery_id) delivery_ids_json,
 'Your Vector notifications'||char(10)||char(10)||group_concat(m.text,char(10)||char(10)) text
 FROM notification_digest_batches b JOIN operators o ON o.id=b.recipient_id
 JOIN (SELECT item.batch_id,d.created_at,d.identifier,d.id item_delivery_id,m.* FROM notification_digest_items item
 JOIN notification_deliveries d ON d.notification_id=item.notification_id
 JOIN notification_mail_messages m ON m.delivery_id=d.id ORDER BY d.created_at,d.id) m
 ON m.batch_id=b.id AND m.claim_token=b.claim_token
 WHERE b.status='claimed' AND o.removed_at IS NULL GROUP BY b.id;
-- Keep Base's authentication admission and admit only the exact current product message.
DROP TRIGGER vector_development_capture;
CREATE TRIGGER vector_development_capture BEFORE INSERT ON rer_mail_development_outbox
WHEN NOT (
 EXISTS(SELECT 1 FROM oa_tokens t JOIN oa_operators o ON o.id=t.operator_id
   WHERE t.id=json_extract(NEW.message,'$.deliveryId') AND t.revoked_at IS NULL
   AND t.consumed_at IS NULL AND t.expires_at>CAST(unixepoch('now')*1000 AS INTEGER)
   AND o.version=t.operator_version AND o.status IN ('active','invited')
   AND o.email=json_extract(NEW.message,'$.to[0]')
   AND (t.issuer_id IS NULL OR EXISTS(SELECT 1 FROM oa_operators a WHERE a.id=t.issuer_id AND a.status='active' AND a.version=t.issuer_version)))
 OR EXISTS(SELECT 1 FROM oa_step_up_challenges c JOIN oa_operators o ON o.id=c.operator_id
   WHERE c.id=json_extract(NEW.message,'$.deliveryId') AND c.consumed_at IS NULL
   AND c.expires_at>CAST(unixepoch('now')*1000 AS INTEGER)
   AND o.version=c.operator_version AND o.status='active'
   AND o.email=json_extract(NEW.message,'$.to[0]'))

 OR EXISTS(SELECT 1 FROM notification_mail_messages m WHERE m.delivery_id=json_extract(NEW.message,'$.deliveryId')
 AND m.email=json_extract(NEW.message,'$.to[0]') AND m.subject=json_extract(NEW.message,'$.subject') AND m.text=json_extract(NEW.message,'$.text'))
 OR EXISTS(SELECT 1 FROM notification_digest_messages m WHERE m.delivery_id=json_extract(NEW.message,'$.deliveryId')
 AND m.email=json_extract(NEW.message,'$.to[0]') AND m.subject=json_extract(NEW.message,'$.subject') AND m.text=json_extract(NEW.message,'$.text'))
) BEGIN SELECT RAISE(IGNORE); END;
-- Erase an entire capture when any constituent is erased; terminal envelope stays fenced.
CREATE TRIGGER notification_digest_capture_erasure BEFORE DELETE ON notification_deliveries BEGIN
 DELETE FROM rer_mail_development_outbox WHERE json_extract(message,'$.deliveryId') IN
 (SELECT batch_id FROM notification_digest_items WHERE notification_id=OLD.notification_id);
END;
DROP TRIGGER vector_development_actor_erasure;
CREATE TRIGGER vector_development_actor_erasure AFTER UPDATE OF actor_name ON notification_deliveries
WHEN OLD.actor_name IS NOT NEW.actor_name BEGIN
 -- An immediate capture remains the one delivered message, with its actor
 -- anonymized. Rebuild from its issue/event facts so no old actor text survives.
 UPDATE rer_mail_development_outbox SET message=json_set(message,'$.text',
  NEW.identifier||': '||NEW.title||char(10)||
  (SELECT CASE
   WHEN EXISTS(SELECT 1 FROM json_each(n.causes_json) WHERE value='assignment')
    AND EXISTS(SELECT 1 FROM json_each(n.causes_json) WHERE value='mention') THEN 'This issue was assigned to you, and you were mentioned.'
   WHEN EXISTS(SELECT 1 FROM json_each(n.causes_json) WHERE value='assignment') THEN 'This issue was assigned to you.'
   WHEN EXISTS(SELECT 1 FROM json_each(n.causes_json) WHERE value='mention') THEN 'You were mentioned on this issue.'
   ELSE 'Events: '||(SELECT group_concat(value,', ') FROM json_each(n.causes_json))||'.' END
   FROM notifications n WHERE n.id=NEW.notification_id)
  ||char(10)||'By: '||COALESCE(NEW.actor_name,'Vector')||char(10)||char(10)||NEW.app_link||char(10)||'Sign in to view this issue.')
 WHERE json_extract(message,'$.deliveryId')=NEW.id AND NEW.email_mode='immediate';
 -- A digest may name several actors; removing its capture erases the affected
 -- snapshot without changing the terminal envelope or permitting another send.
 DELETE FROM rer_mail_development_outbox WHERE json_extract(message,'$.deliveryId')
  IN(SELECT batch_id FROM notification_digest_items WHERE notification_id=NEW.notification_id);
END;
CREATE TRIGGER notification_channel_member_erasure AFTER UPDATE OF removed_at ON operators
WHEN NEW.removed_at IS NOT NULL BEGIN
 DELETE FROM notification_channel_overrides WHERE operator_id=NEW.id;
 DELETE FROM rer_mail_development_outbox WHERE json_extract(message,'$.deliveryId') IN(SELECT id FROM notification_digest_batches WHERE recipient_id=NEW.id);
 DELETE FROM notification_digest_windows WHERE recipient_id=NEW.id;
 DELETE FROM notification_digest_batches WHERE recipient_id=NEW.id;
END;

-- Older archives have no channel receipts. Quarantine their Inbox history too,
-- so reviewing future effects cannot backfill newly supported event channels.
CREATE TRIGGER notification_channel_restore_complete AFTER UPDATE OF phase ON rer_portability_jobs
WHEN NEW.kind='import' AND NEW.phase='complete' AND OLD.phase!='complete' BEGIN
 INSERT OR IGNORE INTO notification_channel_receipts(notification_id) SELECT id FROM notifications;
END;
