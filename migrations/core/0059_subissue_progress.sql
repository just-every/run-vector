-- Additive hierarchy order and opt-in team automation. Keep on compatible rollback.
ALTER TABLE issue_parents ADD COLUMN position INTEGER NOT NULL DEFAULT 0;
UPDATE issue_parents SET position=(SELECT count(*) FROM issue_parents sibling JOIN issues s ON s.id=sibling.issue_id JOIN issues c ON c.id=issue_parents.issue_id WHERE sibling.parent_issue_id=issue_parents.parent_issue_id AND s.identifier<=c.identifier);
CREATE INDEX issue_parents_order ON issue_parents(parent_issue_id,position,issue_id);
CREATE TABLE subissue_team_rules (
 team_id TEXT PRIMARY KEY REFERENCES teams(id) ON DELETE CASCADE,
 enabled INTEGER NOT NULL CHECK(enabled IN(0,1)), version INTEGER NOT NULL,
 updated_at TEXT NOT NULL
);
-- Ephemeral transaction plans, never a delivery queue. A committed event consumes
-- its own plan. Status writes plan every ancestor before updating any of them,
-- independent of SQLite recursive_triggers and UPDATE row order.
CREATE TABLE subissue_progress_events (
 id TEXT PRIMARY KEY, parent_issue_id TEXT NOT NULL, created_at TEXT NOT NULL,
 changes_json TEXT NOT NULL DEFAULT '[]'
);
CREATE TRIGGER subissue_progress_apply AFTER INSERT ON subissue_progress_events
BEGIN
 UPDATE subissue_progress_events SET changes_json=(
  WITH RECURSIVE planned(id,status_id,target_id) AS (
   SELECT p.id,p.status_id,
    CASE WHEN NOT EXISTS(SELECT 1 FROM issue_parents r JOIN issues c ON c.id=r.issue_id JOIN workflow_statuses s ON s.id=c.status_id WHERE r.parent_issue_id=p.id AND s.category<>'completed')
     THEN (SELECT id FROM workflow_statuses WHERE team_id=p.team_id AND category='completed' ORDER BY position,id LIMIT 1)
     WHEN ps.category='completed' THEN (SELECT id FROM workflow_statuses WHERE team_id=p.team_id AND category='unstarted' ORDER BY position,id LIMIT 1)
     ELSE p.status_id END
   FROM issues p JOIN workflow_statuses ps ON ps.id=p.status_id JOIN subissue_team_rules rule ON rule.team_id=p.team_id AND rule.enabled=1
   WHERE p.id=NEW.parent_issue_id AND ps.category IN('backlog','unstarted','started','completed')
    AND NOT EXISTS(SELECT 1 FROM rer_portability_state WHERE applying=1)
    AND NOT EXISTS(SELECT 1 FROM vector_restore_status WHERE effects_held=1)
    AND EXISTS(SELECT 1 FROM issue_parents WHERE parent_issue_id=p.id)
   UNION ALL
   SELECT p.id,p.status_id,
    CASE WHEN (SELECT category FROM workflow_statuses WHERE id=child.target_id)='completed'
     AND NOT EXISTS(SELECT 1 FROM issue_parents r JOIN issues c ON c.id=r.issue_id JOIN workflow_statuses s ON s.id=c.status_id WHERE r.parent_issue_id=p.id AND c.id<>child.id AND s.category<>'completed')
     THEN (SELECT id FROM workflow_statuses WHERE team_id=p.team_id AND category='completed' ORDER BY position,id LIMIT 1)
     WHEN ps.category='completed' THEN (SELECT id FROM workflow_statuses WHERE team_id=p.team_id AND category='unstarted' ORDER BY position,id LIMIT 1)
     ELSE p.status_id END
   FROM planned child JOIN issue_parents link ON link.issue_id=child.id JOIN issues p ON p.id=link.parent_issue_id
    JOIN workflow_statuses ps ON ps.id=p.status_id JOIN subissue_team_rules rule ON rule.team_id=p.team_id AND rule.enabled=1
   WHERE ps.category IN('backlog','unstarted','started','completed')
  ), cycle_selection AS (
   -- Capture the cycle before any ancestor changes. Only a newly completed,
   -- uncommitted parent participates in the team's completion membership rule.
   SELECT planned.*, CASE WHEN p.cycle_id IS NULL AND target.category='completed'
    THEN (SELECT c.id FROM cycles c JOIN teams t ON t.id=c.team_id
     WHERE c.team_id=p.team_id AND t.archived_at IS NULL AND t.auto_cycle_completed=1
      AND c.closed_at IS NULL AND c.starts_at<=NEW.created_at AND c.ends_at>NEW.created_at
     ORDER BY c.starts_at,c.id LIMIT 1) ELSE NULL END cycle_id
   FROM planned JOIN issues p ON p.id=planned.id LEFT JOIN workflow_statuses target ON target.id=planned.target_id
   WHERE planned.status_id IS NOT planned.target_id
  )
  SELECT json_group_array(json_object('activityId',lower(hex(randomblob(13))),'issueId',id,'previousStatusId',status_id,'statusId',target_id,
   'cycleId',cycle_id,'cycleActivityId', CASE WHEN cycle_id IS NOT NULL THEN lower(hex(randomblob(13))) ELSE NULL END )) FROM cycle_selection
 ) WHERE id=NEW.id;
 INSERT INTO issue_activity(id,issue_id,actor_operator_id,actor_name,kind,previous_value_json,next_value_json,created_at,updated_at)
 SELECT json_extract(j.value,'$.activityId'),i.id,NULL,'Sub-issue progress',
  CASE WHEN s.category='completed' THEN 'issue.subissue_completed' ELSE 'issue.subissue_reopened' END ,
  json_object('statusId',i.status_id,'completedAt',i.completed_at,'canceledAt',i.canceled_at),
  json_object('statusId',json_extract(j.value,'$.statusId'),'completedAt', CASE WHEN s.category='completed' THEN NEW.created_at ELSE NULL END ,'canceledAt',NULL,'automation','subissue_progress'),NEW.created_at,NEW.created_at
 FROM subissue_progress_events e,json_each(e.changes_json) j JOIN issues i ON i.id=json_extract(j.value,'$.issueId')
 LEFT JOIN workflow_statuses s ON s.id=json_extract(j.value,'$.statusId') WHERE e.id=NEW.id;
 INSERT INTO audit_records(id,actor_operator_id,action,subject_identifier,subject_id,created_at,updated_at)
 SELECT a.id,NULL,a.kind,i.identifier,i.id,NEW.created_at,NEW.created_at FROM subissue_progress_events e,json_each(e.changes_json) j
 JOIN issues i ON i.id=json_extract(j.value,'$.issueId') JOIN issue_activity a ON a.id=json_extract(j.value,'$.activityId') WHERE e.id=NEW.id;
 INSERT INTO issue_activity(id,issue_id,actor_operator_id,actor_name,kind,previous_value_json,next_value_json,created_at,updated_at)
 SELECT json_extract(j.value,'$.cycleActivityId'),i.id,NULL,'Cycle membership automation','issue.cycle_automatically_added',
  json_object('cycleId',NULL),json_object('cycleId',json_extract(j.value,'$.cycleId'),'feature','cycle.membership.v1'),NEW.created_at,NEW.created_at
 FROM subissue_progress_events e,json_each(e.changes_json) j JOIN issues i ON i.id=json_extract(j.value,'$.issueId')
 WHERE e.id=NEW.id AND json_extract(j.value,'$.cycleId') IS NOT NULL;
 INSERT INTO audit_records(id,actor_operator_id,action,subject_identifier,subject_id,created_at,updated_at)
 SELECT json_extract(j.value,'$.cycleActivityId'),NULL,'cycle.membership.v1',i.identifier,i.id,NEW.created_at,NEW.created_at
 FROM subissue_progress_events e,json_each(e.changes_json) j JOIN issues i ON i.id=json_extract(j.value,'$.issueId')
 WHERE e.id=NEW.id AND json_extract(j.value,'$.cycleId') IS NOT NULL;
 UPDATE issues SET status_id=(SELECT json_extract(j.value,'$.statusId') FROM subissue_progress_events e,json_each(e.changes_json) j WHERE e.id=NEW.id AND json_extract(j.value,'$.issueId')=issues.id),
  cycle_id=COALESCE((SELECT json_extract(j.value,'$.cycleId') FROM subissue_progress_events e,json_each(e.changes_json) j WHERE e.id=NEW.id AND json_extract(j.value,'$.issueId')=issues.id),cycle_id),
  completed_at= CASE WHEN (SELECT s.category FROM subissue_progress_events e,json_each(e.changes_json) j JOIN workflow_statuses s ON s.id=json_extract(j.value,'$.statusId') WHERE e.id=NEW.id AND json_extract(j.value,'$.issueId')=issues.id)='completed' THEN NEW.created_at ELSE NULL END ,
  canceled_at=NULL,deferred_until=NULL,version=version+1+ CASE WHEN EXISTS(SELECT 1 FROM subissue_progress_events e,json_each(e.changes_json) j WHERE e.id=NEW.id AND json_extract(j.value,'$.issueId')=issues.id AND json_extract(j.value,'$.cycleId') IS NOT NULL) THEN 1 ELSE 0 END ,updated_at=NEW.created_at
 WHERE id IN(SELECT json_extract(j.value,'$.issueId') FROM subissue_progress_events e,json_each(e.changes_json) j WHERE e.id=NEW.id);
 -- Automation uses the same active-recipient and mute rules as native status events.
 INSERT OR IGNORE INTO notifications(id,event_id,issue_id,recipient_id,actor_id,actor_name,causes_json,created_at)
 SELECT lower(hex(randomblob(16))),json_extract(j.value,'$.activityId'),i.id,o.id,NULL,'Sub-issue progress',
  json_array( CASE WHEN status.category='completed' THEN 'completed' ELSE 'status' END ),NEW.created_at
 FROM subissue_progress_events e,json_each(e.changes_json) j JOIN issues i ON i.id=json_extract(j.value,'$.issueId')
 JOIN teams team ON team.id=i.team_id JOIN workflow_statuses status ON status.id=i.status_id
 JOIN issue_followers follower ON follower.issue_id=i.id JOIN operators o ON o.id=follower.operator_id AND o.workspace_id=team.workspace_id
 WHERE e.id=NEW.id AND o.removed_at IS NULL
  AND NOT EXISTS(SELECT 1 FROM vector_auth_operators mapping JOIN oa_operators native ON native.id=mapping.auth_id WHERE mapping.operator_id=o.id AND native.status<>'active')
  AND NOT EXISTS(SELECT 1 FROM notification_events receipt WHERE receipt.event_id=json_extract(j.value,'$.activityId'))
  AND NOT EXISTS(SELECT 1 FROM issue_notification_mutes mute WHERE mute.issue_id=i.id AND mute.operator_id=o.id)
  AND NOT EXISTS(SELECT 1 FROM notification_type_mutes mute WHERE mute.operator_id=o.id AND mute.kind= CASE WHEN status.category='completed' THEN 'completed' ELSE 'status' END );
 INSERT OR IGNORE INTO notification_events(event_id,created_at)
 SELECT json_extract(j.value,'$.activityId'),NEW.created_at FROM subissue_progress_events e,json_each(e.changes_json) j WHERE e.id=NEW.id;
 DELETE FROM subissue_progress_events WHERE id=NEW.id;
END ;
CREATE TRIGGER subissue_status_progress AFTER UPDATE OF status_id ON issues
WHEN NEW.status_id<>OLD.status_id
 AND NOT EXISTS(SELECT 1 FROM rer_portability_state WHERE applying=1)
 AND NOT EXISTS(SELECT 1 FROM vector_restore_status WHERE effects_held=1)
 AND NOT EXISTS(SELECT 1 FROM subissue_progress_events e,json_each(e.changes_json) j WHERE json_extract(j.value,'$.issueId')=NEW.id)
BEGIN
 INSERT INTO subissue_progress_events(id,parent_issue_id,created_at)
 SELECT lower(hex(randomblob(13))),parent_issue_id,NEW.updated_at FROM issue_parents WHERE issue_id=NEW.id;
END ;
