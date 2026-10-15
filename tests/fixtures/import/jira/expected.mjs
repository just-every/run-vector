import { ISSUE_COUNT, PRIORITIES, STATUSES, mappedAssigneeAccountId, unmappedAssigneeAccountId, rolloverCycle, currentCycle, unmappedSprint, PARENTS, BLOCKS, DUPLICATES, RELATES, EXTERNAL_BLOCK, labelNames, sourceIds } from './data.mjs';
import { issueKey } from './serialization.mjs';
const RAW_OCCURRENCE_COUNTS = [
  ['issue-id', 1, 'Issue id', 300, 300],
  ['issue-key', 2, 'Issue key', 300, 300],
  ['summary', 3, 'Summary', 300, 300],
  ['description', 4, 'Description', 300, 300],
  ['issue-type', 5, 'Issue Type', 300, 5],
  ['status', 6, 'Status', 300, 3],
  ['status-category', 7, 'Status Category', 300, 3],
  ['priority', 8, 'Priority', 300, 5],
  ['assignee', 9, 'Assignee', 150, 2],
  ['reporter', 10, 'Reporter', 300, 3],
  ['created', 11, 'Created', 300, 300],
  ['updated', 12, 'Updated', 300, 300],
  ['due-date', 13, 'Due date', 75, 75],
  ['resolved', 14, 'Resolved', 100, 100],
  ['parent', 15, 'Parent', 5, 2],
  ['sprint-rollover', 16, 'Sprint', 100, 1],
  ['plugin-rollout-tag', 17, 'Plugin Rollout Tag', 50, 3],
  ['labels-primary', 18, 'Labels', 149, 4],
  ['original-estimate-seconds', 19, 'Original estimate', 60, 4],
  ['sprint-current', 20, 'Sprint', 76, 2],
  ['affects-version', 21, 'Affects Version/s', 30, 3],
  ['labels-secondary', 22, 'Labels', 23, 3],
  ['story-points', 23, 'Story point estimate', 270, 8],
  ['blocks', 24, 'Outward issue link (Blocks)', 3, 3],
  ['components', 25, 'Component/s', 43, 3],
  ['comments-primary', 26, 'Comment', 75, 75],
  ['fix-version', 27, 'Fix Version/s', 34, 4],
  ['attachments-primary', 28, 'Attachment', 30, 30],
  ['duplicates', 29, 'Outward issue link (Duplicate)', 2, 2],
  ['security-level', 30, 'Security Level', 15, 2],
  ['comments-secondary', 31, 'Comment', 27, 27],
  ['worklog', 32, 'Worklog', 18, 18],
  ['attachments-secondary', 33, 'Attachment', 8, 8],
  ['relates', 34, 'Outward issue link (Relates)', 1, 1],
  ['watchers', 35, 'Watchers', 38, 3],
  ['time-spent', 36, 'Time Spent', 50, 4],
  ['custom-field', 37, 'Custom field (Vector QA)', 20, 4],
  ['plugin-account', 38, 'Tempo Account', 25, 2],
  ['plugin-test-type', 39, 'Xray Test Type', 12, 3],
  ['resolution', 40, 'Resolution', 100, 2],
  ['resolution-detail', 41, 'Resolution detail', 11, 11],
];

function expectedRelations(prefix) {
  const parents = PARENTS.map(({ sourceIndex, parentIndex }) => ({
    sourceIssueId: sourceIds[sourceIndex],
    parentIssueId: sourceIds[parentIndex],
  }));
  const blocks = BLOCKS.map(({ sourceIndex, targetIndex }) => ({
    sourceIssueId: sourceIds[sourceIndex],
    targetIssueId: sourceIds[targetIndex],
    targetKey: issueKey(targetIndex, prefix),
  }));
  const duplicates = DUPLICATES.map(({ sourceIndex, targetIndex }) => ({
    sourceIssueId: sourceIds[sourceIndex],
    targetIssueId: sourceIds[targetIndex],
    targetKey: issueKey(targetIndex, prefix),
  }));
  const relates = RELATES.map(({ sourceIndex, targetIndex }) => ({
    sourceIssueId: sourceIds[sourceIndex],
    targetIssueId: sourceIds[targetIndex],
    targetKey: issueKey(targetIndex, prefix),
    expectedDisposition: 'omission',
  }));
  return {
    parents,
    blocks,
    duplicates,
    relates,
    externalLinks: [{
      type: 'blocks',
      sourceIssueId: sourceIds[EXTERNAL_BLOCK.sourceIndex],
      targetKey: EXTERNAL_BLOCK.targetKey,
      expectedDisposition: 'omission',
    }],
    counts: { parents: 5, blocks: 2, duplicates: 2, relates: 1, externalLinks: 1 },
  };
}

function expectedRawCounts(variant) {
  return RAW_OCCURRENCE_COUNTS.map(([concept, position, header, nonEmptyRows, distinctValues]) => {
    if (variant === 'missing-required-column' && concept === 'issue-id') {
      return { concept, position, header, present: false, nonEmptyRows: 0, distinctValues: 0 };
    }
    if (variant === 'unknown-status' && concept === 'status') {
      return { concept, position, header, present: true, nonEmptyRows, distinctValues: 4 };
    }
    if (variant === 'unknown-status' && ['resolved', 'resolution'].includes(concept)) {
      return {
        concept,
        position,
        header,
        present: true,
        nonEmptyRows: nonEmptyRows - 1,
        distinctValues: concept === 'resolved' ? distinctValues - 1 : distinctValues,
      };
    }
    return { concept, position, header, present: true, nonEmptyRows, distinctValues };
  });
}

export function makeExpected(prefix, variant) {
  const unknownStatus = variant === 'unknown-status';
  return {
    issueCount: ISSUE_COUNT,
    uniqueSourceIdCount: ISSUE_COUNT,
    sourceIds: [...sourceIds],
    sourceKeyPrefix: prefix,
    sourceKeys: Array.from({ length: ISSUE_COUNT }, (_, index) => issueKey(index, prefix)),
    uniqueSourceKeyCount: ISSUE_COUNT,
    relations: expectedRelations(prefix),
    rawConceptCounts: expectedRawCounts(variant),
    dateEvidence: {
      nonEmptyCellCount: unknownStatus ? 914 : 915,
      pattern: variant === 'ambiguous-numeric-dates'
        ? 'numeric D/M/YYYY or M/D/YYYY; both remain possible for every cell'
        : 'English abbreviated-month D/Mon/YYYY',
      sourceOffsetOnInstants: '+10:00',
      dueDateCellsAreDateOnly: true,
      allCommentAndAttachmentTimestampsIncluded: true,
    },
    statuses: {
      names: unknownStatus ? ['To Do', 'In Progress', 'Done', 'Awaiting Product Review'] : [...STATUSES],
      counts: unknownStatus
        ? { 'To Do': 100, 'In Progress': 100, Done: 99, 'Awaiting Product Review': 1 }
        : { 'To Do': 100, 'In Progress': 100, Done: 100 },
      categoryCounts: unknownStatus
        ? { 'To Do': 101, 'In Progress': 100, Done: 99 }
        : { 'To Do': 100, 'In Progress': 100, Done: 100 },
      unknownValues: unknownStatus ? ['Awaiting Product Review'] : [],
      statusCategoryForUnknown: unknownStatus ? 'To Do' : null,
    },
    priorities: {
      sourceValues: [...PRIORITIES],
      counts: { Highest: 60, High: 60, Medium: 60, Low: 60, Lowest: 60 },
      explicitVectorMapping: { Highest: 'urgent', High: 'high', Medium: 'medium', Low: 'low', Lowest: 'low' },
    },
    nativeSetup: {
      defaultTeam: 'operator-selected existing team',
      sourceStatuses: [
        { name: 'To Do', suggestedVectorCategory: 'Unstarted' },
        { name: 'In Progress', suggestedVectorCategory: 'Started' },
        { name: 'Done', suggestedVectorCategory: 'Completed' },
      ],
      cycles: [rolloverCycle, currentCycle],
      sprintConvention: 'The first repeated Sprint occurrence is rollover; the last is current, by this synthetic fixture convention.',
      unmappedSprints: [unmappedSprint],
      labels: [...labelNames],
      assigneeTokens: [
        { token: mappedAssigneeAccountId, mapping: 'map explicitly to an existing active native operator' },
        { token: unmappedAssigneeAccountId, mapping: 'leave unmapped; expected to remain unassigned' },
      ],
      reporterTokens: ['acct:fixture:reporter-1', 'acct:fixture:reporter-2', 'acct:fixture:reporter-3'],
      commentAuthorAccountId: 'acct:fixture:comment-author',
      attachmentAuthorAccountId: 'acct:fixture:attachment-author',
      worklogAuthorAccountId: 'acct:fixture:worklog-author',
    },
    variant,
    expectedRefusal: variant === 'ambiguous-numeric-dates'
      ? 'date-order-ambiguous'
      : variant === 'missing-required-column'
        ? 'missing-required-column: Issue id'
        : variant === 'unknown-status'
          ? 'unmapped-status: Awaiting Product Review'
          : null,
  };
}
