-- Forward-only operation provenance; older historical rows retain unknown identity.
-- Context and effects commit in the native D1 transaction. No queue capability is enabled.

ALTER TABLE vector_agent_context ADD COLUMN operation_id TEXT;

ALTER TABLE vector_agent_context ADD COLUMN idempotency_key TEXT;

ALTER TABLE vector_agent_context ADD COLUMN scopes_json TEXT CHECK(scopes_json IS NULL OR (json_valid(scopes_json) AND json_type(scopes_json)='array'));

ALTER TABLE vector_agent_context ADD COLUMN client_id TEXT;

ALTER TABLE vector_agent_activity_attribution ADD COLUMN operation_id TEXT;

ALTER TABLE vector_agent_activity_attribution ADD COLUMN idempotency_key TEXT;

ALTER TABLE vector_agent_activity_attribution ADD COLUMN scopes_json TEXT CHECK(scopes_json IS NULL OR (json_valid(scopes_json) AND json_type(scopes_json)='array'));

ALTER TABLE vector_agent_activity_attribution ADD COLUMN client_id TEXT;

ALTER TABLE vector_agent_comment_attribution ADD COLUMN operation_id TEXT;

ALTER TABLE vector_agent_comment_attribution ADD COLUMN idempotency_key TEXT;

ALTER TABLE vector_agent_comment_attribution ADD COLUMN scopes_json TEXT CHECK(scopes_json IS NULL OR (json_valid(scopes_json) AND json_type(scopes_json)='array'));

ALTER TABLE vector_agent_comment_attribution ADD COLUMN client_id TEXT;

ALTER TABLE vector_agent_project_activity_attribution ADD COLUMN operation_id TEXT;

ALTER TABLE vector_agent_project_activity_attribution ADD COLUMN idempotency_key TEXT;

ALTER TABLE vector_agent_project_activity_attribution ADD COLUMN scopes_json TEXT CHECK(scopes_json IS NULL OR (json_valid(scopes_json) AND json_type(scopes_json)='array'));

ALTER TABLE vector_agent_project_activity_attribution ADD COLUMN client_id TEXT;

ALTER TABLE vector_agent_document_revision_attribution ADD COLUMN operation_id TEXT;

ALTER TABLE vector_agent_document_revision_attribution ADD COLUMN idempotency_key TEXT;

ALTER TABLE vector_agent_document_revision_attribution ADD COLUMN scopes_json TEXT CHECK(scopes_json IS NULL OR (json_valid(scopes_json) AND json_type(scopes_json)='array'));

ALTER TABLE vector_agent_document_revision_attribution ADD COLUMN client_id TEXT;

ALTER TABLE vector_agent_document_comment_attribution ADD COLUMN operation_id TEXT;

ALTER TABLE vector_agent_document_comment_attribution ADD COLUMN idempotency_key TEXT;

ALTER TABLE vector_agent_document_comment_attribution ADD COLUMN scopes_json TEXT CHECK(scopes_json IS NULL OR (json_valid(scopes_json) AND json_type(scopes_json)='array'));

ALTER TABLE vector_agent_document_comment_attribution ADD COLUMN client_id TEXT;

ALTER TABLE vector_agent_audit_attribution ADD COLUMN operation_id TEXT;

ALTER TABLE vector_agent_audit_attribution ADD COLUMN idempotency_key TEXT;

ALTER TABLE vector_agent_audit_attribution ADD COLUMN scopes_json TEXT CHECK(scopes_json IS NULL OR (json_valid(scopes_json) AND json_type(scopes_json)='array'));

ALTER TABLE vector_agent_audit_attribution ADD COLUMN client_id TEXT;

DROP TRIGGER vector_agent_activity_context;

CREATE TRIGGER vector_agent_activity_context AFTER INSERT ON issue_activity
WHEN EXISTS(SELECT 1 FROM vector_agent_context WHERE person_id=NEW.actor_operator_id)
BEGIN
 INSERT INTO vector_agent_activity_attribution
 SELECT NEW.id,agent_id,agent_name,person_id,person_name,consent_reference,approvers_json,prepared_by,NEW.created_at,operation_id,idempotency_key,scopes_json,client_id
 FROM vector_agent_context WHERE person_id=NEW.actor_operator_id;
 UPDATE issue_activity SET actor_name=(SELECT prepared_by FROM vector_agent_context)
 WHERE id=NEW.id;
END;

DROP TRIGGER vector_agent_comment_context;

CREATE TRIGGER vector_agent_comment_context AFTER INSERT ON issue_comments
WHEN EXISTS(SELECT 1 FROM vector_agent_context WHERE person_id=NEW.actor_operator_id)
BEGIN
 INSERT INTO vector_agent_comment_attribution
 SELECT NEW.id,agent_id,agent_name,person_id,person_name,consent_reference,approvers_json,prepared_by,NEW.created_at,operation_id,idempotency_key,scopes_json,client_id
 FROM vector_agent_context WHERE person_id=NEW.actor_operator_id;
END;

DROP TRIGGER vector_agent_project_activity_context;

CREATE TRIGGER vector_agent_project_activity_context AFTER INSERT ON project_activity
WHEN EXISTS(SELECT 1 FROM vector_agent_context WHERE person_id=NEW.actor_operator_id)
BEGIN
 INSERT INTO vector_agent_project_activity_attribution
 SELECT NEW.id,agent_id,agent_name,person_id,person_name,consent_reference,approvers_json,prepared_by,NEW.created_at,operation_id,idempotency_key,scopes_json,client_id
 FROM vector_agent_context WHERE person_id=NEW.actor_operator_id;
END;

DROP TRIGGER vector_agent_document_revision_context;

CREATE TRIGGER vector_agent_document_revision_context AFTER INSERT ON document_revisions
WHEN EXISTS(SELECT 1 FROM vector_agent_context WHERE person_id=NEW.author_operator_id)
BEGIN
 INSERT INTO vector_agent_document_revision_attribution
 SELECT NEW.id,agent_id,agent_name,person_id,person_name,consent_reference,approvers_json,prepared_by,NEW.created_at,operation_id,idempotency_key,scopes_json,client_id
 FROM vector_agent_context WHERE person_id=NEW.author_operator_id;
END;

DROP TRIGGER vector_agent_document_comment_context;

CREATE TRIGGER vector_agent_document_comment_context AFTER INSERT ON document_comments
WHEN EXISTS(SELECT 1 FROM vector_agent_context WHERE person_id=NEW.author_operator_id)
BEGIN
 INSERT INTO vector_agent_document_comment_attribution
 SELECT NEW.id,agent_id,agent_name,person_id,person_name,consent_reference,approvers_json,prepared_by,NEW.created_at,operation_id,idempotency_key,scopes_json,client_id
 FROM vector_agent_context WHERE person_id=NEW.author_operator_id;
END;

DROP TRIGGER vector_agent_audit_context;

CREATE TRIGGER vector_agent_audit_context AFTER INSERT ON audit_records
WHEN EXISTS(SELECT 1 FROM vector_agent_context WHERE person_id=NEW.actor_operator_id)
BEGIN
 INSERT INTO vector_agent_audit_attribution
 SELECT NEW.id,agent_id,agent_name,person_id,person_name,consent_reference,approvers_json,prepared_by,NEW.created_at,operation_id,idempotency_key,scopes_json,client_id
 FROM vector_agent_context WHERE person_id=NEW.actor_operator_id;
END;
