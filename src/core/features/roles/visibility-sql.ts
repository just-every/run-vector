/** ROLE-003: shared row visibility, evaluated in the statement's SQL snapshot.
 * Explicit main.* references are policy inputs; ordinary repositories use the
 * CTE names and therefore scope BEFORE joins, aggregates, ranking and paging.
 * No role or membership is copied into a session or bearer token.
 */
export const visibleTeam = (person: string, team: string) =>
  `(${person}.role<>'guest' OR EXISTS(SELECT 1 FROM main.team_members guest_team WHERE guest_team.operator_id=${person}.id AND guest_team.team_id=${team}))`

const guest = `(SELECT role FROM __vector_reader)='guest'`
const scoped = (table: string, where: string) => `${table} AS (SELECT r.* FROM main.${table} r WHERE NOT (${guest}) OR (${where}))`
const issue = (column = 'issue_id') => `r.${column} IN (SELECT id FROM issues)`
const team = (column = 'team_id') => `r.${column} IN (SELECT id FROM teams)`
const project = (column = 'project_id') => `r.${column} IN (SELECT id FROM projects)`
/** Relation history must not disclose a now-hidden issue through its retained
 * identifier, nor a hidden project/team through its historical JSON. */
const safeHistory = (column: string) => `NOT EXISTS(SELECT 1 FROM json_tree(r.${column}) j WHERE j.type='text' AND (
 EXISTS(SELECT 1 FROM main.issues hidden WHERE (hidden.id=j.value OR hidden.identifier=j.value) AND hidden.id NOT IN(SELECT id FROM issues)) OR
 EXISTS(SELECT 1 FROM main.teams hidden WHERE hidden.id=j.value AND hidden.id NOT IN(SELECT id FROM teams)) OR
 EXISTS(SELECT 1 FROM main.projects hidden WHERE hidden.id=j.value AND hidden.id NOT IN(SELECT id FROM projects))))`

export function visibilityCtes(actor: string) {
  // The actor comes from native admission, never from SQL supplied by a client.
  // A SQL literal avoids changing repository positional/numbered bindings.
  const literal = "'" + actor.replaceAll("'", "''") + "'"
  return [
    `__vector_reader AS (SELECT id,workspace_id,role FROM main.operators WHERE id=${literal} AND removed_at IS NULL)`,
    `teams AS (SELECT t.* FROM main.teams t JOIN __vector_reader reader ON reader.workspace_id=t.workspace_id WHERE ${visibleTeam('reader', 't.id')})`,
    `operators AS (SELECT r.id,r.workspace_id,CASE WHEN r.role='guest' THEN r.name||' (Guest)' ELSE r.name END name,r.email,r.removed_at,r.created_at,r.updated_at,r.role
      FROM main.operators r JOIN __vector_reader reader ON reader.workspace_id=r.workspace_id)`,
    scoped('issues', team()),
    scoped('projects', 'EXISTS(SELECT 1 FROM issues i WHERE i.project_id=r.id)'),
    ...['workflow_statuses', 'cycles', 'team_members', 'team_departures', 'team_cycle_schedules', 'team_housekeeping', 'subissue_team_rules'].map(t => scoped(t, team())),
    ...['issue_labels', 'evidence_revisions', 'intake_decisions', 'issue_comments', 'issue_files', 'issue_links', 'issue_followers', 'issue_mentions', 'issue_notification_mutes', 'issue_reminders', 'notification_snoozes', 'issue_description_revisions'].map(t => scoped(t, issue())),
    `notifications AS (SELECT r.id,r.event_id,r.issue_id,r.recipient_id,r.actor_id,
      COALESCE((SELECT name FROM operators o WHERE o.id=r.actor_id),r.actor_name) actor_name,
      r.causes_json,r.created_at,r.read_at FROM main.notifications r WHERE NOT (${guest}) OR ${issue()})`,
    scoped('issue_parents', `${issue()} AND ${issue('parent_issue_id')}`),
    scoped('issue_dependencies', `${issue('blocked_issue_id')} AND ${issue('blocking_issue_id')}`),
    scoped('issue_relations', `${issue('first_issue_id')} AND ${issue('second_issue_id')}`),
    scoped('issue_deletions', '0'),
    scoped('issue_duplicates', `${issue()} AND ${issue('canonical_issue_id')}`),
    scoped('issue_activity', `${issue()} AND ${safeHistory('previous_value_json')} AND ${safeHistory('next_value_json')}`),
    ...['project_labels', 'project_milestones'].map(t => scoped(t, project())),
    scoped('project_activity', `${project()} AND ${safeHistory('previous_value_json')} AND ${safeHistory('next_value_json')}`),
    scoped('project_membership_events', `${project()} AND r.identifier IN(SELECT identifier FROM issues)`),
    scoped('cycle_membership_events', `r.cycle_id IN(SELECT id FROM cycles) AND r.identifier IN(SELECT identifier FROM issues)`),
    // Aggregate-only history cannot be divided into teams. Guest reports build
    // from visible live facts instead of presenting another team's totals.
    ...['project_report_days', 'project_report_snapshots', 'cycle_report_days'].map(t => scoped(t, '0')),
    scoped('cycle_snapshots', `r.cycle_id IN(SELECT id FROM cycles) AND ${safeHistory('body_json')}`),
    scoped('cycle_closure_failures', `r.cycle_id IN(SELECT cycle_id FROM cycle_snapshots)`),
    scoped('saved_views', `(r.owner_operator_id=${literal} OR r.is_shared=1) AND CASE
      WHEN COALESCE(json_extract(r.filters_json,'$.team'),'all')='all' THEN (r.is_shared=0 AND r.owner_operator_id=${literal}) OR NOT EXISTS(SELECT 1 FROM main.teams t JOIN __vector_reader reader ON reader.workspace_id=t.workspace_id WHERE t.id NOT IN(SELECT id FROM teams))
      ELSE json_extract(r.filters_json,'$.team') IN(SELECT id FROM teams) END
      AND (json_extract(r.filters_json,'$.project') IS NULL OR json_extract(r.filters_json,'$.project') IN('all','none') OR json_extract(r.filters_json,'$.project') IN(SELECT id FROM projects))`),
  ].join(',\n')
}

export const visibleDirectoryPerson = (person: string, actor: string) => `EXISTS(SELECT 1 FROM main.operators directory_reader WHERE directory_reader.id=${actor} AND directory_reader.removed_at IS NULL
  AND directory_reader.workspace_id=${person}.workspace_id AND (directory_reader.role<>'guest' OR ${person}.id=directory_reader.id
  OR EXISTS(SELECT 1 FROM main.team_members them JOIN main.team_members mine ON mine.team_id=them.team_id WHERE them.operator_id=${person}.id AND mine.operator_id=directory_reader.id)))`
