/** Evaluated within the closure INSERT, before rollover, so later edits cannot alter the report.
 * The same expression serves the live read. `c` is the owning cycle in both queries. */
export const cycleReportFactsSql = `json_object(
 'memberships',(SELECT json_group_array(json_object('id',id,'identifier',identifier,'direction',direction,'at',occurred_at))
   FROM (SELECT * FROM cycle_membership_events WHERE cycle_id=c.id ORDER BY julianday(occurred_at),id)),
 'issues',(SELECT json_group_array(json_object(
   'identifier',i.identifier,'category',s.category,'createdAt',i.created_at,
   'assigneeId',i.assignee_operator_id,'assigneeName',o.name,
   'transitions',(SELECT json_group_array(json_object('id',a.id,'at',a.created_at,'previousCategory',previous.category))
     FROM issue_activity a LEFT JOIN workflow_statuses previous ON previous.id=json_extract(a.previous_value_json,'$.statusId')
     WHERE a.issue_id=i.id AND json_type(a.previous_value_json,'$.statusId') IS NOT NULL
       AND json_type(a.next_value_json,'$.statusId') IS NOT NULL
     ORDER BY julianday(a.created_at),a.id)))
   FROM issues i JOIN workflow_statuses s ON s.id=i.status_id LEFT JOIN operators o ON o.id=i.assignee_operator_id
   WHERE i.cycle_id=c.id OR EXISTS(SELECT 1 FROM cycle_membership_events e WHERE e.cycle_id=c.id AND e.identifier=i.identifier)))`;
