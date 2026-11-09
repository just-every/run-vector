/** Fence the live authority inputs around asynchronous projection. Project data
 * is scoped before aggregation; membership and subject withdrawal must also
 * remain unchanged until the projection's final admission query. */
export async function leadershipAuthorityStamp(db: D1Database, recipient: string, workspace: string) {
  return db.prepare(`SELECT json_object(
    'list', (SELECT revision FROM issue_list_revision WHERE id=1),
    'graph', (SELECT revision FROM initiative_graph WHERE workspace_id=?),
    'teams', (SELECT json_group_array(json_array(id,is_private)) FROM (SELECT id,is_private FROM teams WHERE workspace_id=? ORDER BY id)),
    'memberships', (SELECT json_group_array(team_id) FROM (SELECT team_id FROM team_members WHERE operator_id=? ORDER BY team_id)),
    'subscriptions', (SELECT json_group_array(id) FROM (SELECT id FROM subject_subscriptions WHERE operator_id=? AND subject_type='initiative' ORDER BY id))
    ) stamp`).bind(workspace,workspace,recipient,recipient).first<string>('stamp');
}
