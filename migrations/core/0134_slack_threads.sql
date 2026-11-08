-- Thread identity is domain history. Restores retain it inert, never reconnect it.
CREATE TABLE vector_slack_threads (
 id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, slack_team_id TEXT NOT NULL,
 channel_id TEXT NOT NULL, thread_ts TEXT NOT NULL, installation_at TEXT NOT NULL,
 destination_id TEXT NOT NULL, issue_id TEXT NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
 root_comment_id TEXT NOT NULL UNIQUE REFERENCES issue_comments(id) ON DELETE CASCADE,
 operator_id TEXT NOT NULL, linked_at TEXT NOT NULL, permalink TEXT NOT NULL,
 held INTEGER NOT NULL DEFAULT 0 CHECK(held IN(0,1)), created_at TEXT NOT NULL,
 UNIQUE(workspace_id,slack_team_id,channel_id,thread_ts)
);
CREATE TABLE vector_slack_thread_messages (
 thread_id TEXT NOT NULL REFERENCES vector_slack_threads(id) ON DELETE CASCADE,
 message_ts TEXT NOT NULL, comment_id TEXT NOT NULL REFERENCES issue_comments(id) ON DELETE CASCADE,
 PRIMARY KEY(thread_id,message_ts), UNIQUE(comment_id)
);
CREATE TABLE vector_slack_thread_events (
 id TEXT PRIMARY KEY, thread_id TEXT NOT NULL REFERENCES vector_slack_threads(id) ON DELETE CASCADE,
 kind TEXT NOT NULL CHECK(kind IN('reply','resolved','status')), source_id TEXT NOT NULL,
 actor_id TEXT, status_name TEXT, enqueued_at TEXT, held INTEGER NOT NULL DEFAULT 0 CHECK(held IN(0,1)), created_at TEXT NOT NULL
);
CREATE INDEX vector_slack_thread_pending ON vector_slack_thread_events(enqueued_at,held,created_at);
CREATE TRIGGER vector_slack_thread_reply AFTER INSERT ON issue_comments
WHEN NEW.parent_comment_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM vector_restore_status WHERE effects_held=1)
BEGIN
 INSERT INTO vector_slack_thread_events(id,thread_id,kind,source_id,actor_id,created_at)
 SELECT NEW.id||':slack-thread',m.id,'reply',NEW.id,NEW.actor_operator_id,NEW.created_at
 FROM vector_slack_threads m WHERE m.root_comment_id=NEW.parent_comment_id AND m.issue_id=NEW.issue_id AND m.held=0;
END;
CREATE TRIGGER vector_slack_thread_resolved AFTER INSERT ON issue_activity
WHEN NEW.kind='thread.resolved' AND NOT EXISTS(SELECT 1 FROM vector_restore_status WHERE effects_held=1)
BEGIN
 INSERT INTO vector_slack_thread_events(id,thread_id,kind,source_id,actor_id,created_at)
 SELECT NEW.id||':'||m.id,m.id,'resolved',NEW.id,NEW.actor_operator_id,NEW.created_at
 FROM vector_slack_threads m WHERE m.issue_id=NEW.issue_id AND m.root_comment_id=json_extract(NEW.next_value_json,'$.id') AND m.held=0;
END;
CREATE TRIGGER vector_slack_thread_status AFTER INSERT ON issue_activity
WHEN NEW.kind<>'issue.imported' AND NEW.kind<>'issue.created'
 AND json_extract(NEW.next_value_json,'$.statusId') IS NOT NULL
 AND json_extract(NEW.next_value_json,'$.statusId') IS NOT json_extract(NEW.previous_value_json,'$.statusId')
 AND NOT EXISTS(SELECT 1 FROM vector_restore_status WHERE effects_held=1)
BEGIN
 INSERT INTO vector_slack_thread_events(id,thread_id,kind,source_id,actor_id,status_name,created_at)
 SELECT NEW.id||':'||m.id,m.id,'status',NEW.id,NEW.actor_operator_id,s.name,NEW.created_at
 FROM vector_slack_threads m JOIN workflow_statuses s ON s.id=json_extract(NEW.next_value_json,'$.statusId')
 WHERE m.issue_id=NEW.issue_id AND m.held=0;
END;
CREATE TRIGGER vector_slack_threads_restored AFTER UPDATE OF phase ON rer_portability_jobs
WHEN NEW.kind='import' AND NEW.phase='complete' AND OLD.phase<>'complete'
BEGIN
 UPDATE vector_slack_threads SET held=1;
 UPDATE vector_slack_thread_events SET held=1;
END;
