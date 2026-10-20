/** Ephemeral live facts only. None of this JSON is persisted by project reporting. */
export const projectReportFactsSql = `SELECT json_object(
 'createdAt',p.created_at,'recoveredAt',NULL,'timezone',w.timezone,
 'lifecycle',p.lifecycle,'archived',json(CASE WHEN p.archived_at IS NULL THEN 'false' ELSE 'true' END),
 'memberships',(SELECT json_group_array(json_object('id',id,'identifier',identifier,'direction',direction,'at',occurred_at))
  FROM (SELECT * FROM project_membership_events WHERE project_id=p.id ORDER BY julianday(occurred_at),id)),
 'issues',(SELECT json_group_array(json_object(
  'identifier',i.identifier,'member',json(CASE WHEN i.project_id=p.id THEN 'true' ELSE 'false' END),
  'category',s.category,'createdAt',i.created_at,
  'transitions',(SELECT json_group_array(json_object('id',id,'at',at,'previousCategory',previous_category,'category',category)) FROM (
   SELECT a.id,a.created_at AS at,previous.category AS previous_category,next.category AS category
   FROM issue_activity a
   LEFT JOIN workflow_statuses previous ON previous.id=json_extract(a.previous_value_json,'$.statusId')
   LEFT JOIN workflow_statuses next ON next.id=json_extract(a.next_value_json,'$.statusId')
   WHERE a.issue_id=i.id AND json_type(a.previous_value_json,'$.statusId') IS NOT NULL
    AND json_type(a.next_value_json,'$.statusId') IS NOT NULL
   ORDER BY julianday(a.created_at),a.id))))
  FROM issues i JOIN workflow_statuses s ON s.id=i.status_id
  WHERE i.project_id=p.id OR EXISTS(SELECT 1 FROM project_membership_events e WHERE e.project_id=p.id AND e.identifier=i.identifier))
 ) AS body FROM projects p JOIN workspace_settings w ON w.id=p.workspace_id WHERE p.id=?`;
