-- Retain provenance without a foreign key to a deletable subject or person.
ALTER TABLE audit_records ADD COLUMN workspace_id TEXT;
ALTER TABLE audit_records ADD COLUMN actor_kind TEXT;
ALTER TABLE audit_records ADD COLUMN actor_reference TEXT;

UPDATE audit_records SET workspace_id=COALESCE(
 (SELECT workspace_id FROM operators WHERE id=actor_operator_id),
 (SELECT workspace_id FROM teams WHERE id=subject_id),
 (SELECT workspace_id FROM projects WHERE id=subject_id),
 (SELECT t.workspace_id FROM issues i JOIN teams t ON t.id=i.team_id WHERE i.id=subject_id),
 (SELECT id FROM workspace_settings WHERE (SELECT count(*) FROM workspace_settings)=1)),
 actor_kind=CASE WHEN actor_operator_id IS NOT NULL THEN 'person'
  WHEN action IN ('cycle.closed','cycle.created.automation','due_reminder.delivered','personal_reminder.delivered','issue.auto_closed','issue.auto_archived') THEN 'automation' ELSE 'unknown' END,
 actor_reference=CASE WHEN actor_operator_id IS NOT NULL THEN 'person:'||actor_operator_id
  WHEN action IN ('cycle.closed','cycle.created.automation','due_reminder.delivered','personal_reminder.delivered','issue.auto_closed','issue.auto_archived') THEN 'automation:'||action ELSE 'unknown:'||id END;

CREATE TRIGGER vector_audit_provenance AFTER INSERT ON audit_records
WHEN NEW.workspace_id IS NULL OR NEW.actor_kind IS NULL OR NEW.actor_reference IS NULL BEGIN
 UPDATE audit_records SET workspace_id=COALESCE(NEW.workspace_id,
  (SELECT workspace_id FROM operators WHERE id=NEW.actor_operator_id),
  (SELECT workspace_id FROM teams WHERE id=NEW.subject_id),
  (SELECT workspace_id FROM projects WHERE id=NEW.subject_id),
  (SELECT t.workspace_id FROM issues i JOIN teams t ON t.id=i.team_id WHERE i.id=NEW.subject_id),
  (SELECT id FROM workspace_settings WHERE (SELECT count(*) FROM workspace_settings)=1)),
 actor_kind=COALESCE(NEW.actor_kind,CASE WHEN NEW.actor_operator_id IS NOT NULL THEN 'person' ELSE 'automation' END),
 actor_reference=COALESCE(NEW.actor_reference,CASE WHEN NEW.actor_operator_id IS NOT NULL THEN 'person:'||NEW.actor_operator_id ELSE 'automation:'||NEW.action END)
 WHERE id=NEW.id;
END;
CREATE INDEX vector_audit_workspace_time ON audit_records(workspace_id,created_at,id);
-- Privacy erasure may null the live-person link or redact the old display label.
-- Opaque references, action and event time remain immutable.
CREATE TRIGGER vector_audit_immutable BEFORE UPDATE ON audit_records
WHEN NEW.id IS NOT OLD.id OR NEW.action IS NOT OLD.action OR NEW.subject_id IS NOT OLD.subject_id
 OR NEW.created_at IS NOT OLD.created_at
 OR (OLD.workspace_id IS NOT NULL AND NEW.workspace_id IS NOT OLD.workspace_id)
 OR (OLD.actor_kind IS NOT NULL AND NEW.actor_kind IS NOT OLD.actor_kind)
 OR (OLD.actor_reference IS NOT NULL AND NEW.actor_reference IS NOT OLD.actor_reference)
BEGIN SELECT RAISE(ABORT,'AUDIT_APPEND_ONLY'); END;
CREATE TRIGGER vector_audit_retained BEFORE DELETE ON audit_records
BEGIN SELECT RAISE(ABORT,'AUDIT_APPEND_ONLY'); END;

-- Native sign-in commits a durable event with its session, before product
-- projection of an accepted invitation. Auth IDs are opaque, never bearer data.
CREATE TRIGGER vector_audit_signin AFTER INSERT ON oa_sessions BEGIN
 INSERT INTO audit_records(id,actor_operator_id,action,subject_identifier,subject_id,created_at,updated_at,workspace_id,actor_kind,actor_reference)
 SELECT 'signin:'||NEW.id,m.operator_id,'auth.signed_in','auth:'||NEW.operator_id,'auth:'||NEW.operator_id,
  strftime('%Y-%m-%dT%H:%M:%fZ',NEW.created_at/1000.0,'unixepoch'),strftime('%Y-%m-%dT%H:%M:%fZ',NEW.created_at/1000.0,'unixepoch'),
  COALESCE(o.workspace_id,(SELECT id FROM workspace_settings WHERE (SELECT count(*) FROM workspace_settings)=1)),'person','auth:'||NEW.operator_id
 FROM oa_operators a LEFT JOIN vector_auth_operators m ON m.auth_id=a.id LEFT JOIN operators o ON o.id=m.operator_id WHERE a.id=NEW.operator_id;
END;
CREATE TRIGGER vector_audit_invitation AFTER INSERT ON vector_invitation_roles BEGIN
 INSERT INTO audit_records(id,actor_operator_id,action,subject_identifier,subject_id,created_at,updated_at)
 SELECT 'invite:'||NEW.token_id,NEW.inviter_operator_id,'operator.invited','auth:'||t.operator_id,'auth:'||t.operator_id,NEW.created_at,NEW.created_at FROM oa_tokens t WHERE t.id=NEW.token_id;
END;
CREATE TRIGGER vector_audit_token_issued AFTER INSERT ON vector_integration_tokens BEGIN
 INSERT INTO audit_records(id,actor_operator_id,action,subject_identifier,subject_id,created_at,updated_at,workspace_id)
 VALUES('token-issued:'||NEW.token_id,NEW.operator_id,'token.issued',NEW.token_id,NEW.token_id,
 strftime('%Y-%m-%dT%H:%M:%fZ',NEW.created_at/1000.0,'unixepoch'),strftime('%Y-%m-%dT%H:%M:%fZ',NEW.created_at/1000.0,'unixepoch'),NEW.workspace_id);
END;
CREATE TRIGGER vector_audit_token_revoked AFTER UPDATE OF revoked_at ON vector_integration_tokens
WHEN OLD.revoked_at IS NULL AND NEW.revoked_at IS NOT NULL BEGIN
 INSERT INTO audit_records(id,actor_operator_id,action,subject_identifier,subject_id,created_at,updated_at,workspace_id)
 VALUES('token-revoked:'||NEW.token_id,COALESCE((SELECT actor_operator_id FROM operator_removals WHERE operator_id=NEW.operator_id),NEW.operator_id),'token.revoked',NEW.token_id,NEW.token_id,
 strftime('%Y-%m-%dT%H:%M:%fZ',NEW.revoked_at/1000.0,'unixepoch'),strftime('%Y-%m-%dT%H:%M:%fZ',NEW.revoked_at/1000.0,'unixepoch'),NEW.workspace_id);
END;
CREATE TRIGGER vector_audit_import_started AFTER INSERT ON ik_jobs BEGIN
 INSERT INTO audit_records(id,actor_operator_id,action,subject_identifier,subject_id,created_at,updated_at,workspace_id)
 VALUES('import:'||NEW.id,NEW.principal_id,'import.started',NEW.id,NEW.id,strftime('%Y-%m-%dT%H:%M:%fZ','now'),strftime('%Y-%m-%dT%H:%M:%fZ','now'),NEW.destination);
END;
CREATE TRIGGER vector_audit_import_state AFTER UPDATE OF state ON ik_jobs WHEN NEW.state<>OLD.state BEGIN
 INSERT INTO audit_records(id,actor_operator_id,action,subject_identifier,subject_id,created_at,updated_at,workspace_id)
 VALUES('import-state:'||lower(hex(randomblob(16))),NEW.principal_id,'import.'||NEW.state,NEW.id,NEW.id,strftime('%Y-%m-%dT%H:%M:%fZ','now'),strftime('%Y-%m-%dT%H:%M:%fZ','now'),NEW.destination);
END;
CREATE TRIGGER vector_audit_archive_started AFTER INSERT ON rer_portability_jobs BEGIN
 INSERT INTO audit_records(id,actor_operator_id,action,subject_identifier,subject_id,created_at,updated_at,workspace_id,actor_kind,actor_reference)
 VALUES('archive:'||NEW.id,NEW.actor,'archive.'||NEW.kind||'.started',NEW.id,NEW.id,strftime('%Y-%m-%dT%H:%M:%fZ','now'),strftime('%Y-%m-%dT%H:%M:%fZ','now'),
 COALESCE((SELECT workspace_id FROM operators WHERE id=NEW.actor),(SELECT id FROM workspace_settings WHERE (SELECT count(*) FROM workspace_settings)=1)),'person','person:'||NEW.actor);
END;
CREATE TRIGGER vector_audit_archive_completed AFTER UPDATE OF phase ON rer_portability_jobs WHEN NEW.phase='complete' AND OLD.phase<>'complete' BEGIN
 INSERT INTO audit_records(id,actor_operator_id,action,subject_identifier,subject_id,created_at,updated_at,workspace_id,actor_kind,actor_reference)
 VALUES('archive-complete:'||NEW.id,NEW.actor,'archive.'||NEW.kind||'.completed',NEW.id,NEW.id,strftime('%Y-%m-%dT%H:%M:%fZ','now'),strftime('%Y-%m-%dT%H:%M:%fZ','now'),
 COALESCE((SELECT workspace_id FROM operators WHERE id=NEW.actor),(SELECT id FROM workspace_settings WHERE (SELECT count(*) FROM workspace_settings)=1)),'person','person:'||NEW.actor);
END;
-- AUTO-003's committed activity is the authority for this event, not a Cron
-- attempt. No entry is recorded for an ineligible or rolled-back candidate.
CREATE TRIGGER vector_audit_housekeeping AFTER INSERT ON issue_activity
WHEN NEW.kind IN ('issue.auto_closed','issue.auto_archived') BEGIN
 INSERT INTO audit_records(id,actor_operator_id,action,subject_identifier,subject_id,created_at,updated_at,actor_kind,actor_reference)
 VALUES('housekeeping:'||NEW.id,NULL,NEW.kind,NEW.issue_id,NEW.issue_id,NEW.created_at,NEW.created_at,'automation','automation:housekeeping');
END;
CREATE TRIGGER vector_audit_source_run AFTER INSERT ON vector_source_receipts BEGIN
 INSERT INTO audit_records(id,actor_operator_id,action,subject_identifier,subject_id,created_at,updated_at,workspace_id,actor_kind,actor_reference)
 SELECT 'source:'||lower(hex(randomblob(16))),NULL,'integration.source_received',NEW.issue_id,NEW.issue_id,NEW.received_at,NEW.received_at,s.workspace_id,'integration','integration:'||s.id
 FROM vector_integration_sources s WHERE s.id=NEW.source_id;
END;
CREATE TRIGGER vector_audit_member_joined AFTER INSERT ON operators BEGIN
 INSERT INTO audit_records(id,actor_operator_id,action,subject_identifier,subject_id,created_at,updated_at,workspace_id,actor_kind,actor_reference)
 VALUES('joined:'||NEW.id,NEW.id,'operator.joined',NEW.id,NEW.id,NEW.created_at,NEW.created_at,NEW.workspace_id,'person','person:'||NEW.id);
END;
CREATE TRIGGER vector_audit_auth_settings AFTER INSERT ON oa_auth_audit
WHEN NEW.action<>'owner:signin-link' BEGIN
 INSERT INTO audit_records(id,actor_operator_id,action,subject_identifier,subject_id,created_at,updated_at,workspace_id,actor_kind,actor_reference)
 SELECT 'auth-audit:'||NEW.id,m.operator_id,'auth.'||NEW.action,'auth-settings','auth-settings',
 strftime('%Y-%m-%dT%H:%M:%fZ',NEW.created_at/1000.0,'unixepoch'),strftime('%Y-%m-%dT%H:%M:%fZ',NEW.created_at/1000.0,'unixepoch'),
 COALESCE(o.workspace_id,(SELECT id FROM workspace_settings WHERE (SELECT count(*) FROM workspace_settings)=1)),'person','auth:'||NEW.actor_id
 FROM oa_operators a LEFT JOIN vector_auth_operators m ON m.auth_id=a.id LEFT JOIN operators o ON o.id=m.operator_id WHERE a.id=NEW.actor_id;
END;
-- A pristine destination now has the installation owner's join and single
-- native sign-in events. Only these exact derived records are replaceable;
-- ordinary audit activity still prevents bootstrap restoration.
CREATE VIEW vector_http_restore_audit_pristine AS SELECT 1 AS admitted
WHERE NOT EXISTS(SELECT 1 FROM audit_records a WHERE NOT (
 EXISTS(SELECT 1 FROM operators o JOIN workspace_installation i ON i.setup_operator_id=o.id
  WHERE a.id='joined:'||o.id AND a.action='operator.joined' AND a.subject_id=o.id
  AND a.actor_reference='person:'||o.id AND a.actor_kind='person' AND a.actor_operator_id=o.id
  AND a.workspace_id=o.workspace_id AND a.created_at=o.created_at)
 OR EXISTS(SELECT 1 FROM oa_sessions s JOIN vector_auth_operators m ON m.auth_id=s.operator_id
  JOIN operators o ON o.id=m.operator_id JOIN workspace_installation i ON i.setup_operator_id=o.id
  WHERE a.id='signin:'||s.id AND a.action='auth.signed_in' AND a.subject_id='auth:'||s.operator_id
  AND a.actor_reference='auth:'||s.operator_id AND a.actor_kind='person' AND a.actor_operator_id=o.id
  AND a.workspace_id=o.workspace_id AND a.created_at=strftime('%Y-%m-%dT%H:%M:%fZ',s.created_at/1000.0,'unixepoch'))
 OR EXISTS(SELECT 1 FROM operators o JOIN workspace_installation i ON i.setup_operator_id=o.id
  WHERE a.id='archive:'||a.subject_id AND a.action='archive.import.started'
  AND a.actor_operator_id=o.id AND a.actor_reference='person:'||o.id
  AND a.actor_kind='person' AND a.workspace_id=o.workspace_id)
));
CREATE TRIGGER vector_http_restore_audit_commit_guard BEFORE INSERT ON rer_portability_guard
WHEN EXISTS(SELECT 1 FROM vector_http_restore r JOIN rer_portability_state p ON p.import_job=r.import_id WHERE p.applying=1)
BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM vector_http_restore_audit_pristine)
 THEN RAISE(ABORT,'restore_authority_changed') END;
END;
