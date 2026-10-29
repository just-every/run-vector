const from = (id, pointer = '/id') => ({ $from: id, pointer });
const standard = [{ class: 'standard', facts: { measure: 1 } }];
const step = (id, tool, args) => ({ id, tool, args, expect: standard });
const widget = { name: 'Visible work', kind: 'count', filters: {}, chart: {} };

/** Each phase creates native records. Renaming saved views to their generated
 * IDs releases their creation names for the next phase on the same database.
 * The native fixture topology must supply one genuine sponsor notification:
 * another signed-in member assigns an issue to the sponsor, or a native
 * scheduled personal reminder delivers. No notification rows are fabricated. */
export function workspaceSteps({ teamId = from('options', '/teams/0/id'),
  startedStatusId = from('options', '/teams/0/statuses/3/id'),
  projectId = from('options', '/projects/0/id'), cycleId = from('options', '/cycles/0/id'),
  notificationId = from('workspace-inbox', '/items/0/id'),
} = {}) {
  const issue = from('workspace-issue', '/identifier');
  const view = from('workspace-view-create');
  const duplicate = from('workspace-view-duplicate');
  const capacityWindow = { from: '2031-01-01', to: '2031-01-31' };
  return [
    step('workspace-issue', 'vector.issue.creation', { teamId, title: 'Review workspace delivery evidence',
      statusId: startedStatusId, assigneeOperatorId: { $sponsor: 'id' }, estimate: 3 }),
    ...['disjoint_stream', 'needs_decision', 'now', 'next', 'recently_done', 'explainable_attention', 'ranking', 'freshness', 'stream_controls']
      .map(name => step(`workspace-current-${name}`, `vector.curr.${name}`, { filters: { teamId } })),
    ...['personal_queue', 'personal_defaults', 'cycle_context'].map(name => step(`workspace-work-${name}`, `vector.work.${name}`, {})),
    step('workspace-created', 'vector.work.created', {}),
    step('workspace-follow', 'vector.notify.read_and_mute', { identifier: issue, input: { following: true, muted: false } }),
    step('workspace-subscribed', 'vector.work.subscribed', {}),
    step('workspace-activity', 'vector.work.activity', {}),
    step('workspace-search', 'vector.search.global_search', { q: issue }),
    step('workspace-exact', 'vector.search.exact_identifier', { identifier: issue }),
    step('workspace-index', 'vector.search.index_freshness', {}),
    step('workspace-search-options', 'vector.search.options', {}),
    ...['view.issue_controls', 'search.advanced_filters', 'view.team_board', 'view.workspace_wide_views']
      .map(name => step(`workspace-${name.replaceAll('.', '-')}`, `vector.${name}`, { team: teamId, priority: 'all' })),
    step('workspace-view-create', 'vector.view.saved_views.create', { name: 'Door workspace view', query: { team: teamId } }),
    step('workspace-view-edit', 'vector.view.saved_views.edit', { id: view, input: { name: view, layout: 'board' } }),
    step('workspace-view-duplicate', 'vector.view.saved_views.duplicate', { id: view, input: { name: 'Door workspace duplicate' } }),
    step('workspace-duplicate-rename', 'vector.view.saved_views.edit', { id: duplicate, input: { name: duplicate } }),
    step('workspace-view-read', 'vector.view.saved_views.read', { id: view }),
    step('workspace-views', 'vector.view.saved_views', {}),
    step('workspace-preferences', 'vector.view.control_persistence', { surface: 'current' }),
    step('workspace-preferences-save', 'vector.view.control_persistence.save', { surface: 'current', input: { filters: { teamId } } }),
    step('workspace-preferences-reset', 'vector.view.control_persistence.reset', { surface: 'current' }),
    step('workspace-preferences-restore', 'vector.view.control_persistence.save', { surface: 'current', input: {
      filters: from('workspace-preferences', '/filters'), sort: from('workspace-preferences', '/sort'), grouping: from('workspace-preferences', '/grouping') } }),
    step('workspace-calendar', 'vector.view.timeline_and_calendar_views', {}),
    step('workspace-appearance', 'vector.view.appearance', {}),
    step('workspace-appearance-save', 'vector.view.appearance.save', { theme: 'dark' }),
    step('workspace-appearance-restore', 'vector.view.appearance.save', { theme: from('workspace-appearance', '/theme') }),
    step('workspace-inbox', 'vector.notify.inbox_events', {}),
    step('workspace-inbox-count', 'vector.notify.inbox_events.count', {}),
    step('workspace-inbox-read', 'vector.notify.inbox_events.read', { id: notificationId }),
    step('workspace-mark-read', 'vector.notify.read_and_mute.read', { id: notificationId }),
    step('workspace-snooze', 'vector.notify.snooze_and_reminders.snooze', { id: notificationId, input: { untilChange: true } }),
    step('workspace-snoozed', 'vector.notify.inbox_events', { snoozed: true }),
    step('workspace-unsnooze', 'vector.notify.snooze_and_reminders.unsnooze', { id: notificationId }),
    step('workspace-mark-all', 'vector.notify.read_and_mute.read_all', {}),
    step('workspace-no-self', 'vector.notify.no_self_notification', {}),
    step('workspace-followers', 'vector.notify.followers', { identifier: issue }),
    step('workspace-mute', 'vector.notify.read_and_mute', { identifier: issue, input: { muted: true } }),
    step('workspace-unfollow', 'vector.notify.read_and_mute', { identifier: issue, input: { following: false, muted: false } }),
    step('workspace-email', 'vector.notify.assignment_and_mention_email', {}),
    step('workspace-email-save', 'vector.notify.assignment_and_mention_email.save', { emailEnabled: false, mutedKinds: ['comment'] }),
    step('workspace-email-restore', 'vector.notify.assignment_and_mention_email.save', {
      emailEnabled: from('workspace-email', '/emailEnabled'), mutedKinds: from('workspace-email', '/mutedKinds') }),
    step('workspace-reminder', 'vector.notify.snooze_and_reminders', { identifier: issue, remindAt: '2099-01-15T12:00:00.000Z' }),
    step('workspace-reminders', 'vector.notify.due_reminders', { identifier: issue }),
    step('workspace-reminder-cancel', 'vector.notify.snooze_and_reminders.cancel', { identifier: issue, id: from('workspace-reminder') }),
    step('workspace-channels', 'vector.notify.channels_and_digests', {}),
    step('workspace-channels-save', 'vector.notify.channels_and_digests.save', { channels: [{ kind: 'assignment', emailMode: 'off', slack: false }] }),
    step('workspace-channels-inherit', 'vector.notify.channels_and_digests.save', { channels: [{ kind: 'assignment', inherit: true }] }),
    step('workspace-subscribe', 'vector.notify.subscriptions.subscribe', { subjectType: 'view', subjectId: view }),
    step('workspace-subscription-read', 'vector.notify.subscriptions.read', { id: from('workspace-subscribe') }),
    step('workspace-subscriptions', 'vector.notify.subscriptions', {}),
    step('workspace-unsubscribe', 'vector.notify.subscriptions.unsubscribe', { id: from('workspace-subscribe') }),
    step('workspace-time', 'vector.notify.personal_time_zone_and_working_hours', {}),
    step('workspace-time-save', 'vector.notify.personal_time_zone_and_working_hours.save', { timezone: 'America/New_York',
      workingHoursStart: '08:30', workingHoursEnd: '16:30', workingDays: [1, 2, 3, 4, 5] }),
    step('workspace-time-restore', 'vector.notify.personal_time_zone_and_working_hours.save', {
      timezone: from('workspace-time', '/timezone'), workingHoursStart: from('workspace-time', '/workingHoursStart'),
      workingHoursEnd: from('workspace-time', '/workingHoursEnd'), workingDays: from('workspace-time', '/workingDays') }),
    step('workspace-insights', 'vector.report.insights', {}),
    step('workspace-cycle-chart', 'vector.report.cycle_and_project_charts', { kind: 'cycle', id: cycleId }),
    step('workspace-project-chart', 'vector.report.cycle_and_project_charts', { kind: 'project', id: projectId }),
    step('workspace-forecast', 'vector.report.project_completion_forecast', { id: projectId }),
    step('workspace-dashboard-create', 'vector.report.dashboards.create', { name: 'Door workspace dashboard', widgets: [widget] }),
    step('workspace-dashboard-read', 'vector.report.dashboards.read', { id: from('workspace-dashboard-create') }),
    step('workspace-dashboard-edit', 'vector.report.dashboards.edit', { id: from('workspace-dashboard-create'),
      expectedVersion: from('workspace-dashboard-read', '/dashboard/version'), input: { name: 'Door delivery dashboard', widgets: [widget] } }),
    step('workspace-dashboards', 'vector.report.dashboards', {}),
    step('workspace-workload', 'vector.report.workload', capacityWindow),
    step('workspace-capacity', 'vector.report.workload.personal_capacity', capacityWindow),
    step('workspace-capacity-set', 'vector.report.workload.set_capacity', { query: capacityWindow,
      input: { capacity: 20, expectedVersion: from('workspace-capacity', '/version') } }),
    step('workspace-capacity-current', 'vector.report.workload.personal_capacity', capacityWindow),
    step('workspace-capacity-restore', 'vector.report.workload.set_capacity', { query: capacityWindow,
      input: { capacity: from('workspace-capacity', '/capacity'), expectedVersion: from('workspace-capacity-current', '/version') } }),
    step('workspace-csv', 'vector.report.warehouse_and_spreadsheet_export', {}),
    step('workspace-audit', 'vector.role.audit_log', {}),
    step('workspace-audit-csv', 'vector.role.audit_log.export', {}),
    { id: 'workspace-view-delete', tool: 'vector.view.saved_views.delete', args: { id: view }, expect: [{ class: 'destructive', facts: { measure: 1 } }] },
    { id: 'workspace-dashboard-delete', tool: 'vector.report.dashboards.delete', args: { id: from('workspace-dashboard-create'), expectedVersion: from('workspace-dashboard-edit', '/version') }, expect: [{ class: 'destructive', facts: { measure: 2 } }] },
  ];
}

export default workspaceSteps();
