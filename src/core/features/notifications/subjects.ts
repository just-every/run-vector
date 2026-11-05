/** Both subjects use the request's current visibility projections before paging
 * or counting. Document events are Inbox-only until channel integrations ship. */
export const inboxSubjects=`SELECT n.id,n.event_id eventId,i.identifier,i.title,NULL documentId,NULL projectId,NULL projectUpdateId,n.actor_name actor,
 (SELECT kind FROM issue_activity WHERE id=n.event_id) sourceEventKind,n.causes_json causesJson,n.created_at createdAt,n.read_at readAt,
 s.until_at snoozedUntil,s.until_change snoozeOnChange,COALESCE(s.returned_at,n.created_at) visibleAt,
 (s.notification_id IS NOT NULL AND s.returned_at IS NULL) snoozed
 FROM notifications n JOIN issues i ON i.id=n.issue_id JOIN teams t ON t.id=i.team_id
 JOIN operators o ON o.id=n.recipient_id AND o.workspace_id=t.workspace_id
 LEFT JOIN notification_snoozes s ON s.notification_id=n.id
 WHERE n.recipient_id=?
 UNION ALL
 SELECT n.id,n.event_id,'Document',d.title,d.id,NULL,NULL,n.actor_name,NULL,'["mention"]',n.created_at,n.read_at,NULL,0,n.created_at,0
 FROM document_notifications n JOIN documents d ON d.id=n.document_id
 JOIN operators o ON o.id=n.recipient_id AND o.workspace_id=d.workspace_id AND o.removed_at IS NULL
 WHERE n.recipient_id=?
 UNION ALL
 SELECT n.id,u.id,'Project',p.name,NULL,p.id,u.id,author.name,NULL,'["project_update"]',n.created_at,n.read_at,NULL,0,n.created_at,0
 FROM project_update_notifications n JOIN project_updates u ON u.id=n.update_id AND u.project_id=n.project_id
 JOIN projects p ON p.id=u.project_id
 JOIN operators o ON o.id=n.recipient_id AND o.workspace_id=p.workspace_id AND o.removed_at IS NULL
 LEFT JOIN operators author ON author.id=u.author_operator_id
 WHERE n.recipient_id=?`;
