-- ISSUE-008 threads: a reply names its top-level comment; resolution lives on
-- the top-level comment. Additive columns only; existing comments stay
-- top-level and unresolved.
ALTER TABLE issue_comments ADD COLUMN parent_comment_id TEXT;
ALTER TABLE issue_comments ADD COLUMN resolved_at TEXT;
ALTER TABLE issue_comments ADD COLUMN resolved_by_operator_id TEXT;
CREATE INDEX issue_comments_parent_idx ON issue_comments(parent_comment_id,created_at);
