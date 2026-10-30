-- A document is the source; no issue is created or borrowed to carry it.
-- Removed references retain their identity until the document or issue is erased.
CREATE TABLE document_issue_references (
 document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
 target_issue_id TEXT NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
 removed INTEGER NOT NULL DEFAULT 0 CHECK(removed IN(0,1)),
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL,
 PRIMARY KEY(document_id,target_issue_id)
);
CREATE INDEX document_issue_references_target ON document_issue_references(target_issue_id);
CREATE TRIGGER document_issue_reference_added AFTER INSERT ON document_issue_references BEGIN
 INSERT INTO issue_activity(id,issue_id,actor_operator_id,kind,next_value_json,created_at,updated_at)
 SELECT 'document-reference:'||NEW.document_id||':'||NEW.target_issue_id,NEW.target_issue_id,NULL,'issue.mentioned',
  json_object('sourceDocumentId',d.id,'title',d.title,'removed',json(CASE WHEN NEW.removed=1 THEN 'true' ELSE 'false' END)),NEW.created_at,NEW.updated_at
 FROM documents d WHERE d.id=NEW.document_id
 ON CONFLICT(id) DO NOTHING;
END;
CREATE TRIGGER document_issue_reference_changed AFTER UPDATE OF removed ON document_issue_references BEGIN
 UPDATE issue_activity SET next_value_json=json_set(next_value_json,'$.removed',json(CASE WHEN NEW.removed=1 THEN 'true' ELSE 'false' END)),updated_at=NEW.updated_at
 WHERE id='document-reference:'||NEW.document_id||':'||NEW.target_issue_id AND kind='issue.mentioned';
END;
CREATE TRIGGER document_issue_reference_body_changed AFTER UPDATE OF body ON documents
WHEN NEW.body IS NOT OLD.body BEGIN
 UPDATE document_issue_references SET removed=1,updated_at=NEW.updated_at WHERE document_id=NEW.id AND removed=0;
END;
CREATE TRIGGER document_issue_reference_title_changed AFTER UPDATE OF title ON documents
WHEN NEW.title IS NOT OLD.title BEGIN
 UPDATE issue_activity SET next_value_json=json_set(next_value_json,'$.title',NEW.title),updated_at=NEW.updated_at
 WHERE kind='issue.mentioned' AND json_extract(next_value_json,'$.sourceDocumentId')=NEW.id;
END;
CREATE TRIGGER document_issue_reference_deleted BEFORE DELETE ON documents BEGIN
 DELETE FROM issue_activity WHERE kind='issue.mentioned' AND json_extract(next_value_json,'$.sourceDocumentId')=OLD.id;
END;
CREATE TRIGGER document_issue_reference_identifier_changed AFTER UPDATE OF identifier ON issues
WHEN NEW.identifier IS NOT OLD.identifier BEGIN
 UPDATE document_issue_references SET removed=1,updated_at=NEW.updated_at WHERE target_issue_id=NEW.id AND removed=0;
END;
