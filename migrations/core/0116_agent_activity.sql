-- Native activity and workspace audit retain both sponsor and preparer.
ALTER TABLE issue_activity ADD COLUMN agent_id TEXT;
ALTER TABLE issue_activity ADD COLUMN agent_operation_id TEXT;
ALTER TABLE issue_activity ADD COLUMN agent_approvers_json TEXT CHECK(agent_approvers_json IS NULL OR json_valid(agent_approvers_json));
CREATE TRIGGER vector_agent_activity_audit AFTER INSERT ON issue_activity
WHEN NEW.agent_id IS NOT NULL BEGIN
 INSERT INTO audit_records(id,actor_operator_id,action,subject_identifier,subject_id,created_at,updated_at,workspace_id,actor_kind,actor_reference)
 SELECT 'agent:'||NEW.id,NEW.actor_operator_id,NEW.kind,i.identifier,i.id,NEW.created_at,NEW.updated_at,t.workspace_id,'agent','agent:'||NEW.agent_id
 FROM issues i JOIN teams t ON t.id=i.team_id WHERE i.id=NEW.issue_id;
END;
