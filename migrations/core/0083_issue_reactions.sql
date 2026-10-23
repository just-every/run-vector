CREATE TABLE issue_reactions (
 issue_id TEXT NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
 subject_id TEXT NOT NULL,
 operator_id TEXT NOT NULL REFERENCES operators(id) ON DELETE CASCADE,
 emoji TEXT NOT NULL,
 created_at TEXT NOT NULL,
 PRIMARY KEY(issue_id,subject_id,operator_id,emoji)
);
CREATE TRIGGER issue_reactions_comment_deleted AFTER UPDATE OF deleted_at ON issue_comments
WHEN NEW.deleted_at IS NOT NULL BEGIN
 DELETE FROM issue_reactions WHERE issue_id=NEW.issue_id AND subject_id=NEW.id;
END;
CREATE TRIGGER issue_reactions_comment_erased AFTER DELETE ON issue_comments BEGIN
 DELETE FROM issue_reactions WHERE issue_id=OLD.issue_id AND subject_id=OLD.id;
END;
