-- Native creation starts after its real activity row. An imported snapshot
-- acquires no unplanned clock while the import transaction is publishing it.
DROP TRIGGER sla_issue_start;
CREATE TRIGGER sla_issue_created AFTER INSERT ON issue_activity WHEN NEW.kind='issue.created' BEGIN
 INSERT OR IGNORE INTO issue_sla_clocks(issue_id,team_id,rule_json,timezone,started_at,observed_at,elapsed_minutes,revision)
 SELECT i.id,i.team_id,r.body_json,w.timezone,max(i.updated_at,r.created_at),max(i.updated_at,r.created_at),0,lower(hex(randomblob(16)))
 FROM issues i JOIN teams t ON t.id=i.team_id JOIN team_slas r ON r.team_id=i.team_id JOIN workspace_settings w ON w.id=t.workspace_id
 JOIN workflow_statuses st ON st.id=i.status_id
 WHERE i.id=NEW.issue_id AND json_extract(r.body_json,'$.enabled')=1 AND (json_extract(r.body_json,'$.priority') IS NULL OR json_extract(r.body_json,'$.priority')=i.priority)
 AND (json_extract(r.body_json,'$.labelId') IS NULL OR EXISTS(SELECT 1 FROM issue_labels l WHERE l.issue_id=i.id AND l.label_id=json_extract(r.body_json,'$.labelId')))
 AND t.archived_at IS NULL AND i.archived_at IS NULL AND st.category NOT IN ('completed','canceled','duplicate')
 AND NOT EXISTS(SELECT 1 FROM vector_restore_status WHERE effects_held=1)
 AND NOT EXISTS(SELECT 1 FROM rer_portability_state WHERE applying=1);
END;
DROP TRIGGER sla_label_match;
CREATE TRIGGER sla_label_match AFTER INSERT ON issue_labels BEGIN
 INSERT OR IGNORE INTO issue_sla_clocks(issue_id,team_id,rule_json,timezone,started_at,observed_at,elapsed_minutes,revision)
 SELECT i.id,i.team_id,r.body_json,w.timezone,max(NEW.created_at,r.created_at),max(NEW.created_at,r.created_at),0,lower(hex(randomblob(16)))
 FROM issues i JOIN teams t ON t.id=i.team_id JOIN team_slas r ON r.team_id=i.team_id JOIN workspace_settings w ON w.id=t.workspace_id
 JOIN workflow_statuses st ON st.id=i.status_id
 WHERE i.id=NEW.issue_id AND NOT EXISTS(SELECT 1 FROM vector_import_revisions imported WHERE imported.issue_id=i.id) AND json_extract(r.body_json,'$.enabled')=1 AND (json_extract(r.body_json,'$.priority') IS NULL OR json_extract(r.body_json,'$.priority')=i.priority)
 AND (json_extract(r.body_json,'$.labelId') IS NULL OR EXISTS(SELECT 1 FROM issue_labels l WHERE l.issue_id=i.id AND l.label_id=json_extract(r.body_json,'$.labelId')))
 AND t.archived_at IS NULL AND i.archived_at IS NULL AND st.category NOT IN ('completed','canceled','duplicate')
 AND NOT EXISTS(SELECT 1 FROM vector_restore_status WHERE effects_held=1)
 AND NOT EXISTS(SELECT 1 FROM rer_portability_state WHERE applying=1);
END;
