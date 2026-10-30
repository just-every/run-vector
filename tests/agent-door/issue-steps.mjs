const from = (id, pointer) => ({ $from: id, pointer });
const standard = (measure = 1) => [{ class: 'standard', facts: { measure } }];
const destructive = (measure = 1) => [{ class: 'destructive', facts: { measure } }];

/** Options are native metadata references. The caller can substitute a second
 * native team and its Started status to exercise a real cross-team move. */
export function issueSteps({ teamId = from('options', '/teams/0/id'),
  startedStatusId = from('options', '/teams/0/statuses/3/id'),
  destinationTeamId = teamId, destinationStartedStatusId = startedStatusId,
  projectId = from('options', '/projects/0/id'), cycleId = from('options', '/cycles/0/id'),
  labelIds = [],
} = {}) {
  const journey = [];
  const step = (id, tool, args, expect = standard(), inject) => journey.push({ id, tool, args, expect, ...(inject ? { inject } : {}) });
  const key = id => from(id, '/identifier');
  const issue = key('issue-create');
  const input = (source, changes = {}, pointer = '/version') => ({ expectedVersion: from(source, pointer), ...changes });
  const edit = (id, tool, source, changes) => step(id, tool, { identifier: issue, input: input(source, changes) });
  const read = (id, tool) => step(id, tool, { identifier: issue });
  const commentId = from('issue-comment', '/id');

  step('issue-create', 'vector.issue.creation', { teamId, title: 'Investigate a native issue report', description: '- [ ] Inspect native evidence' });
  read('issue-key', 'vector.issue.stable_identifiers');
  edit('issue-priority', 'vector.issue.priority', 'issue-create', { priority: 'high' });
  edit('issue-status', 'vector.issue.status_transitions', 'issue-priority', { statusId: startedStatusId });
  edit('issue-assignment', 'vector.issue.assignment', 'issue-status', { assigneeOperatorId: { $sponsor: 'id' } });
  edit('issue-estimate', 'vector.issue.estimates', 'issue-assignment', { estimate: 3 });
  edit('issue-labels', 'vector.issue.labels', 'issue-estimate', { labelIds });
  edit('issue-project', 'vector.proj.project_membership', 'issue-labels', { projectId });
  edit('issue-cycle', 'vector.cycle.commitment', 'issue-project', { cycleId });
  edit('issue-due', 'vector.issue.set_due_date', 'issue-cycle', { dueDate: '2030-01-15' });
  edit('issue-edit', 'vector.issue.concurrent_edits', 'issue-due', { title: 'Investigate and verify a native issue report' });
  read('issue-history', 'vector.issue.description_history');
  edit('issue-checklist', 'vector.issue.checklists', 'issue-edit', { index: 0, text: 'Inspect native evidence', checked: true });
  edit('issue-restore-description', 'vector.issue.restore_description', 'issue-checklist', { revisionId: from('issue-history', '/revisions/0/id') });
  step('issue-comment', 'vector.issue.comments_and_safe_comment_removal', { identifier: issue, input: { body: '- [ ] Check discussion evidence' } });
  read('issue-discussion', 'vector.issue.read_discussion');
  step('issue-comment-edit', 'vector.issue.edit_comment', { identifier: issue, itemId: commentId,
    input: { expectedVersion: from('issue-comment', '/version'), body: '- [ ] Check revised discussion evidence' } });
  step('issue-comment-checklist', 'vector.issue.tick_comment_checklist', { identifier: issue, itemId: commentId,
    input: { expectedBody: '- [ ] Check revised discussion evidence', index: 0, text: 'Check revised discussion evidence', checked: true } });
  step('issue-thread-resolution', 'vector.issue.discussion_threads_and_resolution', { identifier: issue, itemId: commentId, input: { resolved: true } });
  step('issue-thread-reply', 'vector.issue.comments_and_safe_comment_removal', { identifier: issue, input: { parentId: commentId, body: 'Retained evidence needs another inspection.' } });
  step('issue-reaction', 'vector.issue.reactions', { identifier: issue, input: { targetId: commentId, emoji: '👀' } }, standard(), { classes: ['destructive'], approved: true });
  read('issue-reactions-read', 'vector.issue.read_reactions');
  step('issue-remove-reaction', 'vector.issue.remove_reaction', { identifier: issue, input: { targetId: commentId, emoji: '👀' } });
  step('issue-link', 'vector.issue.attachments_and_links', { identifier: issue, input: { name: 'Evidence reference', url: 'https://example.test/evidence' } });
  read('issue-links-read', 'vector.issue.read_links');
  step('issue-copy', 'vector.issue.copy_issue', { identifier: issue, input: { expectedVersion: from('issue-restore-description', '/version'), includeLinks: true } });
  read('issue-references', 'vector.issue.issue_references_and_backlinks');
  step('issue-other', 'vector.issue.creation', { teamId, title: 'A second native issue' });
  const other = key('issue-other');
  step('issue-dependency', 'vector.rel.dependencies', { identifier: issue, input: input('issue-restore-description', { relatedIdentifier: other, relatedVersion: from('issue-other', '/version'), direction: 'blocked-by' }) }, standard(2));
  read('issue-blocked', 'vector.rel.blocked_state');
  step('issue-remove-dependency', 'vector.rel.remove_dependency', { identifier: issue, input: input('issue-dependency', { relatedIdentifier: other, relatedVersion: from('issue-dependency', '/relatedIssue/version'), direction: 'blocked-by' }, '/issue/version') }, standard(2));
  step('issue-related', 'vector.rel.related_issues', { identifier: issue, input: input('issue-remove-dependency', { relatedIdentifier: other, relatedVersion: from('issue-remove-dependency', '/relatedIssue/version'), direction: 'related' }, '/issue/version') }, standard(2));
  step('issue-remove-related', 'vector.rel.remove_related_issue', { identifier: issue, input: input('issue-related', { relatedIdentifier: other, relatedVersion: from('issue-related', '/relatedIssue/version'), direction: 'related' }, '/issue/version') }, standard(2));
  step('issue-parent', 'vector.rel.parent_and_child', { identifier: other, input: input('issue-remove-related', { parentIdentifier: issue }, '/relatedIssue/version') });
  step('issue-unparent', 'vector.rel.parent_and_child', { identifier: other, input: input('issue-parent', { parentIdentifier: null }) });
  step('issue-duplicate', 'vector.rel.duplicate_decision', { identifier: other, input: input('issue-unparent', { canonicalIdentifier: issue }) });
  read('issue-duplicates-read', 'vector.rel.canonical_duplicates');
  step('issue-duplicate-undo', 'vector.rel.undo_duplicate', { identifier: other, input: input('issue-duplicate', { canonicalIdentifier: null }) });
  read('issue-before-subissue', 'vector.issue.stable_identifiers');
  step('issue-subissue-create', 'vector.issue.create_sub_issue', { identifier: issue, input: input('issue-before-subissue', { title: 'Verify the reported behavior' }) }, standard(2));
  read('issue-subissues-read', 'vector.issue.sub_issue_progress');
  step('issue-subissues-order', 'vector.issue.reorder_sub_issues', { identifier: issue, input: input('issue-subissues-read', { identifiers: [from('issue-subissues-read', '/children/0/identifier')] }) });
  step('issue-rule-read', 'vector.issue.read_sub_issue_rule', { teamId });
  step('issue-rule-set', 'vector.issue.set_sub_issue_rule', { teamId, input: { expectedVersion: from('issue-rule-read', '/version'), enabled: true } });
  read('issue-before-bulk', 'vector.issue.stable_identifiers');
  step('issue-bulk-edit', 'vector.issue.bulk_edit', { issues: [{ identifier: issue, expectedVersion: from('issue-before-bulk', '/version') }], changes: { priority: 'urgent' } });
  step('issue-team-move', 'vector.issue.moving_teams', { identifier: issue, input: input('issue-bulk-edit', { teamId: destinationTeamId, statusId: destinationStartedStatusId }, '/issues/0/version') });
  step('issue-bulk-team-move', 'vector.issue.bulk_move_teams', { issues: [{ identifier: issue, expectedVersion: from('issue-team-move', '/version'), statusId: startedStatusId }], teamId });
  step('issue-bulk-duplicate', 'vector.issue.bulk_duplicate', { issues: [{ identifier: other, expectedVersion: from('issue-duplicate-undo', '/version') }], canonicalIdentifier: issue });
  step('issue-bulk-duplicate-undo', 'vector.issue.bulk_duplicate', { issues: [{ identifier: other, expectedVersion: from('issue-bulk-duplicate', '/issues/0/version') }], canonicalIdentifier: null });
  step('issue-order-read', 'vector.issue.read_manual_order', { teamId });
  step('issue-order', 'vector.issue.reorder', { teamId, identifier: issue, action: 'top', expectedVersion: from('issue-order-read', '/version') });
  read('issue-activity', 'vector.issue.activity_history');
  step('issue-remove-link', 'vector.issue.remove_link', { identifier: issue, linkId: from('issue-link', '/id') }, destructive());
  step('issue-remove-comment', 'vector.issue.remove_comment', { identifier: issue, itemId: commentId,
    input: { expectedVersion: from('issue-comment-checklist', '/discussion/comments/0/version') } }, destructive());
  step('intake-create', 'vector.intake.intake_creation', { teamId, title: 'Operator report awaiting a decision', summary: 'Observed a failure in the native journey.' });
  step('intake-evidence', 'vector.intake.evidence_revisions', { identifier: key('intake-create') });
  step('intake-assessment', 'vector.intake.inspectable_assessment', { identifier: key('intake-create') });
  step('intake-policy', 'vector.intake.decision_policy', { identifier: key('intake-create') });
  step('intake-defer', 'vector.intake.defer', { identifier: key('intake-create'), input: input('intake-create', { reason: 'Await the next inspection.', returnAt: '2099-01-01T00:00:00.000Z' }) });
  step('intake-return', 'vector.intake.return', { identifier: key('intake-create'), input: input('intake-defer') });
  step('intake-accept', 'vector.intake.accept', { identifier: key('intake-create'), input: input('intake-return', { reason: 'Evidence was inspected.' }) });
  step('intake-decline-create', 'vector.intake.intake_creation', { teamId, title: 'Operator report to decline', summary: 'An additional report remains retained after its decision.' });
  step('intake-decline', 'vector.intake.decline', { identifier: key('intake-decline-create'), input: input('intake-decline-create', { reason: 'The evidence does not justify planned work.' }) });
  return journey;
}

export default { journey: issueSteps() };
