import type { FilterTerm } from './filter-operands';
const linkFields = ['duplicateof', 'duplicates', 'related', 'blocks', 'blockedby', 'release', 'git', 'creator', 'follower'];
export const isLinkField = (field: string) => linkFields.includes(field);
/** Linked facts are tested only through currently visible issue endpoints. */
export function filterLinkSql(term: FilterTerm, actor: string) {
  const values: string[] = [], { field, value } = term;
  const bind = (value: string) => { values.push(value); return '?'; };
  let sql: string;
  if (field === 'release') {
    sql = `EXISTS(SELECT 1 FROM releases expression_release WHERE expression_release.workspace_id=t.workspace_id
      AND (SELECT role FROM operators WHERE id=${bind(actor)})<>'guest'
      AND (expression_release.team_id IS NULL OR expression_release.team_id IN(SELECT id FROM teams))
      AND (expression_release.team_id IS NULL OR expression_release.team_id=i.team_id)
      AND (EXISTS(SELECT 1 FROM release_issues ri WHERE ri.release_id=expression_release.id AND ri.issue_id=i.id)
        OR EXISTS(SELECT 1 FROM release_projects rp WHERE rp.release_id=expression_release.id AND rp.project_id=i.project_id))
      ${value === 'none' ? '' : 'AND expression_release.id=' + bind(value)})`;
  } else if (field === 'git') {
    sql = `EXISTS(SELECT 1 FROM vector_github_issue_links gl
      JOIN vector_github_repositories gr ON gr.id=gl.repository_id AND gr.workspace_id=t.workspace_id
      JOIN vector_github_pull_requests gp ON gp.repository_id=gl.repository_id AND gp.number=gl.number
      WHERE gl.issue_id=i.id${value === 'none' ? '' : ' AND gp.state=' + bind(value)})`;
  } else if (field === 'creator' || field === 'follower') {
    const person = value === 'me' ? actor : value;
    sql = field === 'creator'
      ? `EXISTS(SELECT 1 FROM issue_activity creation JOIN operators person ON person.id=creation.actor_operator_id AND person.workspace_id=t.workspace_id AND person.removed_at IS NULL WHERE creation.issue_id=i.id AND creation.kind='issue.created'${value === 'none' ? '' : ' AND person.id=' + bind(person)})`
      : `EXISTS(SELECT 1 FROM issue_followers following JOIN operators person ON person.id=following.operator_id AND person.workspace_id=t.workspace_id AND person.removed_at IS NULL WHERE following.issue_id=i.id${value === 'none' ? '' : ' AND person.id=' + bind(person)})`;
  } else {
    const relation = field === 'duplicateof'
      ? 'issue_duplicates edge JOIN issues endpoint ON endpoint.id=edge.canonical_issue_id WHERE edge.issue_id=i.id'
      : field === 'duplicates'
        ? 'issue_duplicates edge JOIN issues endpoint ON endpoint.id=edge.issue_id WHERE edge.canonical_issue_id=i.id'
        : field === 'related'
      ? 'issue_relations edge JOIN issues endpoint ON endpoint.id=CASE WHEN edge.first_issue_id=i.id THEN edge.second_issue_id ELSE edge.first_issue_id END WHERE (edge.first_issue_id=i.id OR edge.second_issue_id=i.id)'
      : field === 'blocks'
        ? 'issue_dependencies edge JOIN issues endpoint ON endpoint.id=edge.blocked_issue_id WHERE edge.blocking_issue_id=i.id'
        : 'issue_dependencies edge JOIN issues endpoint ON endpoint.id=edge.blocking_issue_id WHERE edge.blocked_issue_id=i.id';
    sql = `EXISTS(SELECT 1 FROM ${relation} AND EXISTS(SELECT 1 FROM teams endpoint_team WHERE endpoint_team.id=endpoint.team_id AND endpoint_team.workspace_id=t.workspace_id)${value === 'none' ? '' : ' AND endpoint.identifier=' + bind(value)})`;
  }
  if (value === 'none') sql = `(NOT ${sql})`;
  return { sql: term.operator === '!=' ? `(NOT ${sql})` : sql, values };
}
