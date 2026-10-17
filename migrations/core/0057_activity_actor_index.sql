-- WORK-004 Activity reads one member's own recent changes newest first.
CREATE INDEX issue_activity_actor_idx ON issue_activity(actor_operator_id,created_at);
