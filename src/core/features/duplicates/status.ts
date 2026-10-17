/** Both sides of history may record the last nonterminal state. Prefer the
 * newest activity and its next value, and require a status in the current team. */
export const duplicateRestoreStatus = `COALESCE(
  (SELECT s.id FROM workflow_statuses s WHERE s.id=i.status_id AND s.team_id=i.team_id AND s.category NOT IN ('completed','canceled','duplicate')),
  (SELECT s.id FROM issue_activity a JOIN workflow_statuses s ON s.id=json_extract(a.next_value_json,'$.statusId') OR s.id=json_extract(a.previous_value_json,'$.statusId')
    WHERE a.issue_id=i.id AND s.team_id=i.team_id AND s.category NOT IN ('completed','canceled','duplicate')
    ORDER BY a.created_at DESC,a.id DESC,CASE WHEN s.id=json_extract(a.next_value_json,'$.statusId') THEN 0 ELSE 1 END LIMIT 1),
  (SELECT id FROM workflow_statuses WHERE team_id=i.team_id AND category='backlog' ORDER BY position,id LIMIT 1))`;

export const defaultDuplicateStatus = `(SELECT id FROM workflow_statuses WHERE team_id=i.team_id AND category='duplicate' ORDER BY position,id LIMIT 1)`;
