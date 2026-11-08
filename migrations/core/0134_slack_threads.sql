-- SLACK-002: one signed Slack thread maps to exactly one native comment root.
-- Installation epoch and link epoch are opaque custody, never credentials.
CREATE TABLE vector_slack_threads (
 root_comment_id TEXT PRIMARY KEY REFERENCES issue_comments(id) ON DELETE CASCADE,
 issue_id TEXT NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
 workspace_id TEXT NOT NULL, installation_at TEXT NOT NULL,
 slack_team_id TEXT NOT NULL, channel_id TEXT NOT NULL, thread_ts TEXT NOT NULL,
 destination_id TEXT NOT NULL, operator_id TEXT NOT NULL REFERENCES operators(id),
 slack_user_id TEXT NOT NULL, linked_at TEXT NOT NULL,
 permalink TEXT NOT NULL, created_at TEXT NOT NULL,
 UNIQUE(workspace_id,slack_team_id,channel_id,thread_ts)
);
CREATE INDEX vector_slack_threads_issue ON vector_slack_threads(issue_id);
CREATE TABLE vector_slack_thread_messages (
 workspace_id TEXT NOT NULL, slack_team_id TEXT NOT NULL, channel_id TEXT NOT NULL,
 message_ts TEXT NOT NULL, comment_id TEXT NOT NULL,
 PRIMARY KEY(workspace_id,slack_team_id,channel_id,message_ts)
);
CREATE TABLE vector_slack_thread_holds (root_comment_id TEXT PRIMARY KEY);
CREATE TRIGGER vector_slack_threads_restore_insert AFTER INSERT ON vector_restore_status BEGIN
 INSERT OR IGNORE INTO vector_slack_thread_holds SELECT root_comment_id FROM vector_slack_threads;
END;
CREATE TRIGGER vector_slack_threads_restore_update AFTER UPDATE OF import_id ON vector_restore_status BEGIN
 INSERT OR IGNORE INTO vector_slack_thread_holds SELECT root_comment_id FROM vector_slack_threads;
END;
-- A status transition is captured by its native activity identity, even when
-- another status transition happens before transport. No comment text is queued.
CREATE TRIGGER vector_slack_thread_status AFTER INSERT ON issue_activity
WHEN NEW.kind<>'issue.imported' AND json_extract(NEW.next_value_json,'$.statusId') IS NOT NULL
 AND json_extract(NEW.next_value_json,'$.statusId') IS NOT json_extract(NEW.previous_value_json,'$.statusId')
 AND NEW.kind<>'issue.created' AND NOT EXISTS(SELECT 1 FROM vector_restore_status WHERE effects_held=1)
BEGIN
 INSERT INTO vector_webhook_events(id,workspace_id,destination_id,event,body,created_at)
 SELECT NEW.id||':slack-thread:'||m.root_comment_id,m.workspace_id,'slack-thread','slack.thread',
 json_object('issueId',m.issue_id,'rootId',m.root_comment_id,'kind','status','statusId',json_extract(NEW.next_value_json,'$.statusId'),'actorId',NEW.actor_operator_id),NEW.created_at
 FROM vector_slack_threads m WHERE m.issue_id=NEW.issue_id
 AND NOT EXISTS(SELECT 1 FROM vector_slack_thread_holds h WHERE h.root_comment_id=m.root_comment_id)
 ON CONFLICT(id) DO NOTHING;
END;
CREATE TRIGGER vector_slack_thread_resolution AFTER INSERT ON issue_activity
WHEN NEW.kind='thread.resolved' AND NOT EXISTS(SELECT 1 FROM vector_restore_status WHERE effects_held=1)
BEGIN
 INSERT INTO vector_webhook_events(id,workspace_id,destination_id,event,body,created_at)
 SELECT NEW.id||':slack-thread:'||m.root_comment_id,m.workspace_id,'slack-thread','slack.thread',
 json_object('issueId',m.issue_id,'rootId',m.root_comment_id,'kind','resolved','actorId',NEW.actor_operator_id),NEW.created_at
 FROM vector_slack_threads m WHERE m.root_comment_id=json_extract(NEW.next_value_json,'$.id') AND m.issue_id=NEW.issue_id
 AND NOT EXISTS(SELECT 1 FROM vector_slack_thread_holds h WHERE h.root_comment_id=m.root_comment_id)
 ON CONFLICT(id) DO NOTHING;
END;
