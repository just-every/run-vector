-- Local step-up confirmation (inviting an operator, switching to an owner
-- persona) mails a one-use link keyed by its oa_step_up_challenges row. The 0021
-- capture admitted only oa_tokens and notification deliveries, so the local
-- outbox silently dropped every step-up message. Admit a live, unconsumed
-- challenge for its own active operator; revoke it with its challenge.
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
 OR EXISTS(SELECT 1 FROM notification_deliveries d JOIN operators o ON o.id=d.recipient_id
   JOIN notifications n ON n.id=d.notification_id JOIN issues i ON i.id=n.issue_id JOIN teams team ON team.id=i.team_id
   WHERE d.id=json_extract(NEW.message,'$.deliveryId') AND d.status='claimed'
   AND o.removed_at IS NULL AND NOT EXISTS(SELECT 1 FROM vector_auth_operators mapping JOIN oa_operators native ON native.id=mapping.auth_id WHERE mapping.operator_id=o.id AND native.status<>'active') AND o.workspace_id=team.workspace_id AND o.email=json_extract(NEW.message,'$.to[0]')
   AND (d.actor_id IS NULL OR d.actor_id<>o.id)
   AND COALESCE((SELECT email_enabled FROM notification_preferences WHERE operator_id=o.id),1)=1
   AND NOT EXISTS(SELECT 1 FROM issue_notification_mutes m WHERE m.issue_id=i.id AND m.operator_id=o.id)
   AND EXISTS(SELECT 1 FROM json_each(n.causes_json) cause WHERE cause.value IN ('assignment','mention')
     AND NOT EXISTS(SELECT 1 FROM notification_type_mutes mute WHERE mute.operator_id=o.id AND mute.kind=cause.value))
   AND json_extract(NEW.message,'$.text')=d.identifier||': '||d.title||char(10)||'By: '||COALESCE(d.actor_name,'Vector')||char(10)||char(10)||d.app_link||char(10)||'Sign in to view this issue.')
) BEGIN SELECT RAISE(IGNORE); END;
CREATE TRIGGER vector_development_step_up_revoke AFTER UPDATE OF expires_at ON oa_step_up_challenges
WHEN NEW.expires_at<=OLD.created_at
BEGIN DELETE FROM rer_mail_development_outbox WHERE json_extract(message,'$.deliveryId')=NEW.id; END;
