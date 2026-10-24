-- ROLE-013: widen product roles in place, retaining child foreign keys and revisions.

DROP TRIGGER vector_preserve_installation_owner_role;

DROP TRIGGER vector_preserve_last_owner_role;

DROP TRIGGER vector_preserve_last_owner_removal;

DROP TRIGGER browse_operators_update;

DROP TRIGGER vector_development_capture;

DROP TRIGGER vector_invitation_requires_role;

DROP TRIGGER vector_audit_invitation;

DROP TRIGGER vector_http_restore_admit;

DROP TRIGGER vector_http_restore_commit_guard;

DROP VIEW notification_digest_messages;

DROP VIEW notification_mail_messages;

DROP VIEW notification_mail_admission;

DROP VIEW notification_channel_routes;

DROP VIEW vector_http_restore_eligible;

CREATE TABLE vector_role_upgrade AS SELECT id,role FROM operators;

ALTER TABLE operators DROP COLUMN role;

ALTER TABLE operators ADD COLUMN role TEXT NOT NULL DEFAULT 'owner' CHECK(role IN ('owner','admin','member','guest','viewer'));

UPDATE operators SET role=(SELECT saved.role FROM vector_role_upgrade saved WHERE saved.id=operators.id);

DROP TABLE vector_role_upgrade;

CREATE TABLE vector_invitation_roles_next (token_id TEXT PRIMARY KEY,role TEXT NOT NULL CHECK(role IN ('owner','admin','member','guest','viewer')),inviter_operator_id TEXT NOT NULL,created_at TEXT NOT NULL,team_ids_json TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(team_ids_json) AND json_type(team_ids_json)='array'),CHECK(role<>'guest' OR json_array_length(team_ids_json)>0));

INSERT INTO vector_invitation_roles_next SELECT token_id,role,inviter_operator_id,created_at,team_ids_json FROM vector_invitation_roles;

DROP TABLE vector_invitation_roles;

ALTER TABLE vector_invitation_roles_next RENAME TO vector_invitation_roles;

CREATE VIEW vector_http_restore_eligible AS
 SELECT r.id FROM vector_http_restore r
 JOIN operators product ON product.id=r.actor_id AND product.removed_at IS NULL AND product.role='owner'
 JOIN vector_http_bootstrap b ON b.id=1
 JOIN vector_http_bootstrap_current c ON c.snapshot=b.snapshot
 JOIN vector_auth_operators m ON m.operator_id=r.actor_id AND m.auth_id=r.auth_id
 JOIN oa_operators a ON a.id=r.auth_id AND a.status='active' AND a.version=r.operator_version
 JOIN oa_sessions s ON s.id=r.session_id AND s.operator_id=a.id AND s.operator_version=a.version
 JOIN oa_tokens t ON t.id=r.source_token_id AND t.id=s.source_token_id AND t.operator_id=a.id AND t.operator_version=a.version
 WHERE s.kind='native' AND s.revoked_at IS NULL
 AND s.expires_at>CAST((julianday('now')-2440587.5)*86400000 AS INTEGER)
 AND t.kind='magic' AND t.consumed_at IS NOT NULL AND t.revoked_at IS NULL AND t.issuer_id IS NULL
 AND (SELECT count(*) FROM oa_sessions)=1 AND (SELECT count(*) FROM oa_tokens)=1
 AND NOT EXISTS(SELECT 1 FROM oa_external_identities)
 AND NOT EXISTS(SELECT 1 FROM oa_dev_credentials)
 AND NOT EXISTS(SELECT 1 FROM oa_invitation_cancellations)
 AND NOT EXISTS(SELECT 1 FROM operator_sessions)
 AND NOT EXISTS(SELECT 1 FROM magic_links)
 AND NOT EXISTS(SELECT 1 FROM vector_restore_status)
 AND NOT EXISTS(SELECT 1 FROM vector_restore_operator_grants)
 AND NOT EXISTS(SELECT 1 FROM integration_tokens)
 AND NOT EXISTS(SELECT 1 FROM vector_integration_secret_keys);

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
 AND (o.role='owner' OR (o.role<>'guest' AND t.is_private=0) OR EXISTS(SELECT 1 FROM team_members visible WHERE visible.operator_id=o.id AND visible.team_id=i.team_id))
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

CREATE TRIGGER vector_preserve_installation_owner_role BEFORE UPDATE OF role ON operators
 WHEN OLD.role='owner' AND NEW.role<>'owner'
 AND EXISTS(SELECT 1 FROM workspace_installation WHERE setup_operator_id=OLD.id)
 BEGIN SELECT RAISE(ABORT,'installation_owner'); END;

CREATE TRIGGER vector_preserve_last_owner_role BEFORE UPDATE OF role ON operators
 WHEN OLD.role='owner' AND NEW.role<>'owner' AND OLD.removed_at IS NULL
 AND (SELECT count(*) FROM operators WHERE workspace_id=OLD.workspace_id AND role='owner' AND removed_at IS NULL)<=1
 BEGIN SELECT RAISE(ABORT,'last_owner'); END;

CREATE TRIGGER vector_preserve_last_owner_removal BEFORE UPDATE OF removed_at ON operators
 WHEN OLD.removed_at IS NULL AND NEW.removed_at IS NOT NULL AND OLD.role='owner'
 AND (SELECT count(*) FROM operators WHERE workspace_id=OLD.workspace_id AND role='owner' AND removed_at IS NULL)<=1
 BEGIN SELECT RAISE(ABORT,'last_owner'); END;

CREATE TRIGGER browse_operators_update AFTER UPDATE ON operators BEGIN
 UPDATE issue_list_revision SET revision=revision+1 WHERE id=1;
END;

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

CREATE TRIGGER vector_invitation_requires_role BEFORE UPDATE OF consumed_at ON oa_tokens
 WHEN NEW.kind='invite' AND OLD.consumed_at IS NULL AND NEW.consumed_at IS NOT NULL
 AND NOT EXISTS(SELECT 1 FROM vector_invitation_roles grant_role
 JOIN vector_auth_operators mapping ON mapping.operator_id=grant_role.inviter_operator_id AND mapping.auth_id=NEW.issuer_id
 JOIN operators issuer ON issuer.id=grant_role.inviter_operator_id AND issuer.removed_at IS NULL
 JOIN workspace_settings workspace ON workspace.id=issuer.workspace_id
 WHERE grant_role.token_id=NEW.id AND (issuer.role='owner' OR issuer.role='admin' AND grant_role.role IN('member','guest','viewer') OR issuer.role='member' AND grant_role.role='member' AND workspace.member_invites=1))
 BEGIN SELECT RAISE(ABORT,'invitation_role_required'); END;

CREATE TRIGGER vector_audit_invitation AFTER INSERT ON vector_invitation_roles BEGIN
 INSERT INTO audit_records(id,actor_operator_id,action,subject_identifier,subject_id,created_at,updated_at)
 SELECT 'invite:'||NEW.token_id,NEW.inviter_operator_id,'operator.invited','auth:'||t.operator_id,'auth:'||t.operator_id,NEW.created_at,NEW.created_at FROM oa_tokens t WHERE t.id=NEW.token_id;
END;

CREATE TRIGGER vector_http_restore_admit AFTER INSERT ON vector_http_restore
 BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM vector_http_restore_eligible)
 THEN RAISE(ABORT,'restore_bootstrap_not_pristine') END;
 END;

CREATE TRIGGER vector_http_restore_commit_guard BEFORE INSERT ON rer_portability_guard
 WHEN EXISTS(SELECT 1 FROM rer_portability_guard)
 AND EXISTS(SELECT 1 FROM vector_http_restore r JOIN rer_portability_state p ON p.import_job=r.import_id WHERE p.applying=1)
 BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM vector_http_restore_eligible)
 THEN RAISE(ABORT,'restore_authority_changed') END;
 END;
