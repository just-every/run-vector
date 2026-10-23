-- ISSUE-027: live subjects, with a single retained backlink activity per pair.
-- References are admitted by the existing issues.write command, in its batch.
CREATE TABLE issue_reference_subjects (
 source_issue_id TEXT NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
 target_issue_id TEXT NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
 subject_kind TEXT NOT NULL CHECK(subject_kind IN ('description','comment')),
 subject_id TEXT NOT NULL,
 created_at TEXT NOT NULL,
 PRIMARY KEY(source_issue_id,target_issue_id,subject_kind,subject_id),
 CHECK(source_issue_id<>target_issue_id),
 CHECK(subject_kind<>'description' OR subject_id=source_issue_id)
);
CREATE INDEX issue_reference_subjects_target ON issue_reference_subjects(target_issue_id);
CREATE INDEX issue_reference_subjects_subject ON issue_reference_subjects(source_issue_id,subject_kind,subject_id);

CREATE TRIGGER issue_reference_added AFTER INSERT ON issue_reference_subjects BEGIN
 INSERT INTO issue_activity(id,issue_id,actor_operator_id,kind,next_value_json,created_at,updated_at)
 SELECT 'reference:'||NEW.source_issue_id||':'||NEW.target_issue_id,NEW.target_issue_id,NULL,'issue.mentioned',
  json_object('sourceIssueId',source.id,'identifier',source.identifier,'removed',json('false')),NEW.created_at,NEW.created_at
 FROM issues source WHERE source.id=NEW.source_issue_id
 ON CONFLICT(id) DO UPDATE SET next_value_json=json_set(issue_activity.next_value_json,'$.removed',json('false')),updated_at=excluded.updated_at
 WHERE issue_activity.kind='issue.mentioned' AND json_extract(issue_activity.next_value_json,'$.removed')=1;
END;
CREATE TRIGGER issue_reference_removed AFTER DELETE ON issue_reference_subjects BEGIN
 UPDATE issue_activity SET next_value_json=json_set(next_value_json,'$.removed',json(CASE WHEN EXISTS(
   SELECT 1 FROM issue_reference_subjects WHERE source_issue_id=OLD.source_issue_id AND target_issue_id=OLD.target_issue_id)
   THEN 'false' ELSE 'true' END)),updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
 WHERE id='reference:'||OLD.source_issue_id||':'||OLD.target_issue_id AND kind='issue.mentioned';
END;
-- Clear obsolete subjects even on erasure/undo paths. Native content writes
-- reinsert the newly parsed subjects later in the same transaction.
CREATE TRIGGER issue_reference_description_changed AFTER UPDATE OF description ON issues
WHEN NEW.description IS NOT OLD.description BEGIN
 DELETE FROM issue_reference_subjects WHERE source_issue_id=NEW.id AND subject_kind='description';
END;
CREATE TRIGGER issue_reference_comment_changed AFTER UPDATE OF body,deleted_at ON issue_comments
WHEN NEW.body IS NOT OLD.body OR NEW.deleted_at IS NOT OLD.deleted_at BEGIN
 DELETE FROM issue_reference_subjects WHERE source_issue_id=NEW.issue_id AND subject_kind='comment' AND subject_id=NEW.id;
END;
CREATE TRIGGER issue_reference_comment_deleted BEFORE DELETE ON issue_comments BEGIN
 DELETE FROM issue_reference_subjects WHERE source_issue_id=OLD.issue_id AND subject_kind='comment' AND subject_id=OLD.id;
END;
-- Hard deletion follows ISSUE-010: foreign activity cannot retain the erased
-- source identifier. Ordinary edits and comment deletion preserve their row.
CREATE TRIGGER issue_reference_issue_deleted BEFORE DELETE ON issues BEGIN
 DELETE FROM issue_reference_subjects WHERE source_issue_id=OLD.id OR target_issue_id=OLD.id;
 DELETE FROM issue_activity WHERE kind='issue.mentioned' AND json_extract(next_value_json,'$.sourceIssueId')=OLD.id;
END;
-- Current identifiers are authoritative (DATA-018 alias resolution is absent).
CREATE TRIGGER issue_reference_identifier_changed AFTER UPDATE OF identifier ON issues
WHEN NEW.identifier IS NOT OLD.identifier BEGIN
 DELETE FROM issue_reference_subjects WHERE target_issue_id=NEW.id;
 UPDATE issue_activity SET next_value_json=json_set(next_value_json,'$.identifier',NEW.identifier)
 WHERE kind='issue.mentioned' AND json_extract(next_value_json,'$.sourceIssueId')=NEW.id;
END;
