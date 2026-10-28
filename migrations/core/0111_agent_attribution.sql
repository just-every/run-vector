-- Transaction-local context. mutationDatabase inserts and consumes the singleton
-- in the same D1 batch as the native write. Never archive this transient table.
CREATE TABLE vector_agent_context (
 id INTEGER PRIMARY KEY CHECK(id=1),
 agent_id TEXT NOT NULL, agent_name TEXT NOT NULL,
 person_id TEXT NOT NULL, person_name TEXT NOT NULL,
 consent_reference TEXT,
 approvers_json TEXT NOT NULL CHECK(json_valid(approvers_json) AND json_type(approvers_json)='array'),
 prepared_by TEXT NOT NULL CHECK(prepared_by=agent_name||' for '||person_name)
);

-- Retain names and opaque references at the time of the effect. Revocation or
-- later renaming cannot rewrite history. Native issue erasure still cascades.
CREATE TABLE vector_agent_activity_attribution (
 event_id TEXT PRIMARY KEY REFERENCES issue_activity(id) ON DELETE CASCADE,
 agent_id TEXT NOT NULL, agent_name TEXT NOT NULL,
 person_id TEXT NOT NULL, person_name TEXT NOT NULL,
 consent_reference TEXT,
 approvers_json TEXT NOT NULL CHECK(json_valid(approvers_json) AND json_type(approvers_json)='array'),
 prepared_by TEXT NOT NULL CHECK(prepared_by=agent_name||' for '||person_name),
 created_at TEXT NOT NULL
);
CREATE TABLE vector_agent_comment_attribution (
 comment_id TEXT PRIMARY KEY REFERENCES issue_comments(id) ON DELETE CASCADE,
 agent_id TEXT NOT NULL, agent_name TEXT NOT NULL,
 person_id TEXT NOT NULL, person_name TEXT NOT NULL,
 consent_reference TEXT,
 approvers_json TEXT NOT NULL CHECK(json_valid(approvers_json) AND json_type(approvers_json)='array'),
 prepared_by TEXT NOT NULL CHECK(prepared_by=agent_name||' for '||person_name),
 created_at TEXT NOT NULL
);
CREATE TABLE vector_agent_project_activity_attribution (
 event_id TEXT PRIMARY KEY REFERENCES project_activity(id) ON DELETE CASCADE,
 agent_id TEXT NOT NULL, agent_name TEXT NOT NULL,
 person_id TEXT NOT NULL, person_name TEXT NOT NULL,
 consent_reference TEXT,
 approvers_json TEXT NOT NULL CHECK(json_valid(approvers_json) AND json_type(approvers_json)='array'),
 prepared_by TEXT NOT NULL CHECK(prepared_by=agent_name||' for '||person_name),
 created_at TEXT NOT NULL
);
CREATE TABLE vector_agent_document_revision_attribution (
 revision_id TEXT PRIMARY KEY REFERENCES document_revisions(id) ON DELETE CASCADE,
 agent_id TEXT NOT NULL, agent_name TEXT NOT NULL,
 person_id TEXT NOT NULL, person_name TEXT NOT NULL,
 consent_reference TEXT,
 approvers_json TEXT NOT NULL CHECK(json_valid(approvers_json) AND json_type(approvers_json)='array'),
 prepared_by TEXT NOT NULL CHECK(prepared_by=agent_name||' for '||person_name),
 created_at TEXT NOT NULL
);
CREATE TABLE vector_agent_document_comment_attribution (
 comment_id TEXT PRIMARY KEY REFERENCES document_comments(id) ON DELETE CASCADE,
 agent_id TEXT NOT NULL, agent_name TEXT NOT NULL,
 person_id TEXT NOT NULL, person_name TEXT NOT NULL,
 consent_reference TEXT,
 approvers_json TEXT NOT NULL CHECK(json_valid(approvers_json) AND json_type(approvers_json)='array'),
 prepared_by TEXT NOT NULL CHECK(prepared_by=agent_name||' for '||person_name),
 created_at TEXT NOT NULL
);
CREATE TABLE vector_agent_audit_attribution (
 audit_id TEXT PRIMARY KEY REFERENCES audit_records(id) ON DELETE CASCADE,
 agent_id TEXT NOT NULL, agent_name TEXT NOT NULL,
 person_id TEXT NOT NULL, person_name TEXT NOT NULL,
 consent_reference TEXT,
 approvers_json TEXT NOT NULL CHECK(json_valid(approvers_json) AND json_type(approvers_json)='array'),
 prepared_by TEXT NOT NULL CHECK(prepared_by=agent_name||' for '||person_name),
 created_at TEXT NOT NULL
);
CREATE TRIGGER vector_agent_activity_immutable BEFORE UPDATE ON vector_agent_activity_attribution
BEGIN SELECT RAISE(ABORT,'AGENT_ATTRIBUTION_IMMUTABLE'); END;
CREATE TRIGGER vector_agent_comment_immutable BEFORE UPDATE ON vector_agent_comment_attribution
BEGIN SELECT RAISE(ABORT,'AGENT_ATTRIBUTION_IMMUTABLE'); END;
CREATE TRIGGER vector_agent_project_activity_immutable BEFORE UPDATE ON vector_agent_project_activity_attribution
BEGIN SELECT RAISE(ABORT,'AGENT_ATTRIBUTION_IMMUTABLE'); END;
CREATE TRIGGER vector_agent_document_revision_immutable BEFORE UPDATE ON vector_agent_document_revision_attribution
BEGIN SELECT RAISE(ABORT,'AGENT_ATTRIBUTION_IMMUTABLE'); END;
CREATE TRIGGER vector_agent_document_comment_immutable BEFORE UPDATE ON vector_agent_document_comment_attribution
BEGIN SELECT RAISE(ABORT,'AGENT_ATTRIBUTION_IMMUTABLE'); END;
CREATE TRIGGER vector_agent_audit_immutable BEFORE UPDATE ON vector_agent_audit_attribution
BEGIN SELECT RAISE(ABORT,'AGENT_ATTRIBUTION_IMMUTABLE'); END;
-- Current native member removal erases personal references. Extend that same
-- receipt, rather than letting a retained attribution resurrect an erased name.
-- Rows otherwise remain immutable; issue/comment erasure also cascades above.
CREATE TRIGGER vector_agent_person_erasure AFTER INSERT ON operator_removals
BEGIN
 UPDATE issue_activity SET actor_name=NULL WHERE id IN(
  SELECT event_id FROM vector_agent_activity_attribution WHERE person_id=NEW.operator_id);
 DELETE FROM vector_agent_activity_attribution WHERE person_id=NEW.operator_id
  OR EXISTS(SELECT 1 FROM json_each(approvers_json) WHERE json_extract(value,'$.id')=NEW.operator_id);
 DELETE FROM vector_agent_comment_attribution WHERE person_id=NEW.operator_id
  OR EXISTS(SELECT 1 FROM json_each(approvers_json) WHERE json_extract(value,'$.id')=NEW.operator_id);
 DELETE FROM vector_agent_project_activity_attribution WHERE person_id=NEW.operator_id
  OR EXISTS(SELECT 1 FROM json_each(approvers_json) WHERE json_extract(value,'$.id')=NEW.operator_id);
 DELETE FROM vector_agent_document_revision_attribution WHERE person_id=NEW.operator_id
  OR EXISTS(SELECT 1 FROM json_each(approvers_json) WHERE json_extract(value,'$.id')=NEW.operator_id);
 DELETE FROM vector_agent_document_comment_attribution WHERE person_id=NEW.operator_id
  OR EXISTS(SELECT 1 FROM json_each(approvers_json) WHERE json_extract(value,'$.id')=NEW.operator_id);
 DELETE FROM vector_agent_audit_attribution WHERE person_id=NEW.operator_id
  OR EXISTS(SELECT 1 FROM json_each(approvers_json) WHERE json_extract(value,'$.id')=NEW.operator_id);
END;

CREATE TRIGGER vector_agent_activity_context AFTER INSERT ON issue_activity
WHEN EXISTS(SELECT 1 FROM vector_agent_context WHERE person_id=NEW.actor_operator_id)
BEGIN
 INSERT INTO vector_agent_activity_attribution
 SELECT NEW.id,agent_id,agent_name,person_id,person_name,consent_reference,approvers_json,prepared_by,NEW.created_at
 FROM vector_agent_context WHERE person_id=NEW.actor_operator_id;
 UPDATE issue_activity SET actor_name=(SELECT prepared_by FROM vector_agent_context)
 WHERE id=NEW.id;
END;
CREATE TRIGGER vector_agent_comment_context AFTER INSERT ON issue_comments
WHEN EXISTS(SELECT 1 FROM vector_agent_context WHERE person_id=NEW.actor_operator_id)
BEGIN
 INSERT INTO vector_agent_comment_attribution
 SELECT NEW.id,agent_id,agent_name,person_id,person_name,consent_reference,approvers_json,prepared_by,NEW.created_at
 FROM vector_agent_context WHERE person_id=NEW.actor_operator_id;
END;
CREATE TRIGGER vector_agent_project_activity_context AFTER INSERT ON project_activity
WHEN EXISTS(SELECT 1 FROM vector_agent_context WHERE person_id=NEW.actor_operator_id)
BEGIN
 INSERT INTO vector_agent_project_activity_attribution
 SELECT NEW.id,agent_id,agent_name,person_id,person_name,consent_reference,approvers_json,prepared_by,NEW.created_at
 FROM vector_agent_context WHERE person_id=NEW.actor_operator_id;
END;
CREATE TRIGGER vector_agent_document_revision_context AFTER INSERT ON document_revisions
WHEN EXISTS(SELECT 1 FROM vector_agent_context WHERE person_id=NEW.author_operator_id)
BEGIN
 INSERT INTO vector_agent_document_revision_attribution
 SELECT NEW.id,agent_id,agent_name,person_id,person_name,consent_reference,approvers_json,prepared_by,NEW.created_at
 FROM vector_agent_context WHERE person_id=NEW.author_operator_id;
END;
CREATE TRIGGER vector_agent_document_comment_context AFTER INSERT ON document_comments
WHEN EXISTS(SELECT 1 FROM vector_agent_context WHERE person_id=NEW.author_operator_id)
BEGIN
 INSERT INTO vector_agent_document_comment_attribution
 SELECT NEW.id,agent_id,agent_name,person_id,person_name,consent_reference,approvers_json,prepared_by,NEW.created_at
 FROM vector_agent_context WHERE person_id=NEW.author_operator_id;
END;
-- Do not rewrite audit_records' immutable actor reference or kind. Its native
-- person link continues to identify authorization; the reader projects the agent.
CREATE TRIGGER vector_agent_audit_context AFTER INSERT ON audit_records
WHEN EXISTS(SELECT 1 FROM vector_agent_context WHERE person_id=NEW.actor_operator_id)
BEGIN
 INSERT INTO vector_agent_audit_attribution
 SELECT NEW.id,agent_id,agent_name,person_id,person_name,consent_reference,approvers_json,prepared_by,NEW.created_at
 FROM vector_agent_context WHERE person_id=NEW.actor_operator_id;
END;
CREATE TRIGGER vector_agent_notification_candidate AFTER INSERT ON notification_candidates
WHEN EXISTS(SELECT 1 FROM vector_agent_activity_attribution WHERE event_id=NEW.event_id)
BEGIN
 UPDATE notification_candidates SET actor_name=(SELECT prepared_by FROM vector_agent_activity_attribution WHERE event_id=NEW.event_id)
 WHERE event_id=NEW.event_id AND issue_id=NEW.issue_id AND recipient_id=NEW.recipient_id AND kind=NEW.kind;
END;
CREATE TRIGGER vector_agent_notification AFTER INSERT ON notifications
WHEN EXISTS(SELECT 1 FROM vector_agent_activity_attribution WHERE event_id=NEW.event_id)
BEGIN
 UPDATE notifications SET actor_name=(SELECT prepared_by FROM vector_agent_activity_attribution WHERE event_id=NEW.event_id)
 WHERE id=NEW.id;
END;
CREATE TRIGGER vector_agent_notification_delivery AFTER INSERT ON notification_deliveries
WHEN EXISTS(SELECT 1 FROM notifications n JOIN vector_agent_activity_attribution a ON a.event_id=n.event_id WHERE n.id=NEW.notification_id)
BEGIN
 UPDATE notification_deliveries SET actor_name=(SELECT a.prepared_by FROM notifications n JOIN vector_agent_activity_attribution a ON a.event_id=n.event_id WHERE n.id=NEW.notification_id)
 WHERE id=NEW.id;
END;
-- Channel event triggers may run before the activity attribution trigger. Read
-- the same transaction context instead of depending on SQLite trigger order.
CREATE TRIGGER vector_agent_channel_context AFTER INSERT ON vector_webhook_events
WHEN NEW.event IN('triage.created','issue.created','issue.status_changed','initiative.created','initiative.updated','initiative.projects_changed')
 AND NEW.id NOT LIKE 'initiative-created:%'
 AND EXISTS(SELECT 1 FROM vector_webhook_destinations WHERE id=NEW.destination_id AND kind IN('slack','discord'))
 AND EXISTS(SELECT 1 FROM vector_agent_context WHERE person_id=json_extract(NEW.body,'$.actorId'))
BEGIN
 UPDATE vector_webhook_events SET body=json_set(body,'$.actor',(SELECT prepared_by FROM vector_agent_context))
 WHERE id=NEW.id;
END;

-- Only the display expression changes. Keep native current-recipient admission,
-- restore holds, claim identity and every delivery/uncertainty rule unchanged.
-- Dependent mail/digest views and development custody use this same projection.
DROP VIEW notification_mail_admission;
CREATE VIEW notification_mail_admission AS
 SELECT d.*,o.email,r.mail_causes_json,
 COALESCE((SELECT a.prepared_by FROM notifications n JOIN vector_agent_activity_attribution a ON a.event_id=n.event_id WHERE n.id=d.notification_id),
 (SELECT CASE WHEN person.role='guest' THEN person.name||' (Guest)' ELSE person.name END FROM operators person WHERE person.id=d.actor_id),d.actor_name) current_actor_name,
 EXISTS(SELECT 1 FROM json_each(r.mail_causes_json) WHERE value='assignment') assignment,
 EXISTS(SELECT 1 FROM json_each(r.mail_causes_json) WHERE value='mention') mention
 FROM notification_deliveries d JOIN notification_channel_routes r ON r.notification_id=d.notification_id
 JOIN operators o ON o.id=d.recipient_id
 WHERE d.status='claimed' AND r.email_enabled=1 AND r.email_mode=d.email_mode
 AND NOT EXISTS(SELECT 1 FROM vector_restore_status WHERE effects_held=1)
 AND NOT EXISTS(SELECT 1 FROM rer_portability_state WHERE applying=1)
 AND NOT EXISTS(SELECT 1 FROM vector_restore_mail_holds hold WHERE hold.delivery_id=d.id);
