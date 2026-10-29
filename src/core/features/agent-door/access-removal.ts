/** Count the existing native records the removal service deletes, anonymizes,
 * revokes, unassigns or transfers. These are native subject records, excluding
 * newly appended audit/activity/receipt rows. A row changed twice counts once.
 * Table and column names are closed source constants, never caller input. */
export async function removalEffects(db: D1Database, target: string) {
  const selections: Array<[string, string]> = [
    ['operators', 'id=?1 AND removed_at IS NULL'],
    ['operator_sessions', 'operator_id=?1'],
    ['magic_links', 'operator_id=?1'],
    ['rer_mail_development_outbox', "lower(json_extract(message,'$.to[0]'))=(SELECT lower(email) FROM main.operators WHERE id=?1)"],
    ['issues', "assignee_operator_id=?1 AND status_id IN(SELECT id FROM main.workflow_statuses WHERE category NOT IN('completed','canceled','duplicate'))"],
    ['projects', 'lead_operator_id=?1'],
    ['saved_views', 'owner_operator_id=?1'],
    ['list_preferences', 'operator_id=?1'],
    ['team_join_requests', 'requester_id=?1 OR decided_by=?1'],
    ['team_members', 'operator_id=?1'],
    ['team_departures', 'operator_id=?1'],
    ['audit_records', 'actor_operator_id=?1'],
    ['operator_removals', 'actor_operator_id=?1'],
    ['issue_description_revisions', 'actor_operator_id=?1'],
    ['issue_activity', "actor_operator_id=?1 OR json_extract(previous_value_json,'$.assigneeOperatorId')=?1 OR json_extract(next_value_json,'$.assigneeOperatorId')=?1"],
    ['project_activity', "actor_operator_id=?1 OR json_extract(previous_value_json,'$.leadOperatorId')=?1 OR json_extract(next_value_json,'$.leadOperatorId')=?1"],
    ...['issue_reminders'].map(table => [table, 'recipient_id=?1'] as [string, string]),
    ...['notifications', 'notification_candidates', 'notification_deliveries'].map(table => [table, 'recipient_id=?1 OR actor_id=?1'] as [string, string]),
    ...['issue_followers', 'issue_mentions', 'issue_notification_mutes', 'notification_preferences',
      'notification_type_mutes', 'operator_personal_time', 'operator_appearance'].map(table => [table, 'operator_id=?1'] as [string, string]),
  ];
  const sql = selections.map(([table, where]) => `SELECT count(*) AS n FROM main.${table} WHERE ${where}`).join(' UNION ALL ');
  const count = await db.prepare(`SELECT sum(n) AS affected FROM (${sql})`).bind(target).first<number>('affected');
  return count ?? 0;
}
