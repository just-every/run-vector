// Deterministic 300-issue Jira-profile fixture. It contains no real Jira data.

export const jiraColumns = [
  'Issue id', 'Issue key', 'Summary', 'Description', 'Issue Type', 'Status',
  'Status Category', 'Priority', 'Assignee', 'Reporter', 'Created', 'Updated',
  'Due date', 'Resolved', 'Parent', 'Sprint', 'Plugin Rollout Tag', 'Labels',
  'Original estimate', 'Sprint', 'Affects Version/s', 'Labels',
  'Story point estimate', 'Outward issue link (Blocks)', 'Component/s',
  'Comment', 'Fix Version/s', 'Attachment',
  'Outward issue link (Duplicate)', 'Security Level', 'Comment', 'Worklog',
  'Attachment', 'Outward issue link (Relates)', 'Watchers', 'Time Spent',
  'Custom field (Vector QA)', 'Tempo Account', 'Xray Test Type', 'Resolution',
  'Resolution detail',
];

export const ISSUE_COUNT = 300;
export const FIRST_SOURCE_ID = 710001;
export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const PRIORITIES = ['Highest', 'High', 'Medium', 'Low', 'Lowest'];
export const STATUSES = ['To Do', 'In Progress', 'Done'];
export const CATEGORIES = ['To Do', 'In Progress', 'Done'];
export const KEY_PREFIX_PATTERN = /^[A-Z][A-Z0-9_]{0,9}$/i;
export const DEFAULT_KEY_PREFIX = 'VJ';

export const mappedAssigneeToken = 'acct:fixture:mapped:opaque-7';
export const unmappedAssigneeToken = 'acct:fixture:unmapped:opaque-2';
export const rolloverCycle = 'R2 Fixture Cycle / Rollover';
export const currentCycle = 'R2 Fixture Cycle / Current';
export const unmappedSprint = 'R2 Fixture Sprint / Unmapped';

// These expectations are declared separately from row serialization. Relations
// use numeric source IDs for Parent and source keys for outward issue links.
export const PARENTS = [
  { sourceIndex: 1, parentIndex: 0 },
  { sourceIndex: 2, parentIndex: 0 },
  { sourceIndex: 3, parentIndex: 0 },
  { sourceIndex: 5, parentIndex: 4 },
  { sourceIndex: 6, parentIndex: 4 },
];
export const BLOCKS = [
  { sourceIndex: 1, targetIndex: 2 },
  { sourceIndex: 7, targetIndex: 8 },
];
export const DUPLICATES = [
  { sourceIndex: 20, targetIndex: 21 },
  { sourceIndex: 22, targetIndex: 23 },
];
export const RELATES = [{ sourceIndex: 24, targetIndex: 25 }];
export const EXTERNAL_BLOCK = { sourceIndex: 10, targetKey: 'OUTSIDE-9001' };

export const labelNames = [
  'epic',
  'fixture-label-1', 'fixture-label-2', 'fixture-label-3', 'fixture-label-4',
  'secondary-label-1', 'secondary-label-2', 'secondary-label-3',
];

export const sourceIds = Array.from({ length: ISSUE_COUNT }, (_, index) => String(FIRST_SOURCE_ID + index));
