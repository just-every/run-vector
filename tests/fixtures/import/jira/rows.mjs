import { ISSUE_COUNT, PRIORITIES, STATUSES, CATEGORIES, mappedAssigneeAccountId, unmappedAssigneeAccountId, rolloverCycle, currentCycle, unmappedSprint, PARENTS, BLOCKS, DUPLICATES, RELATES, EXTERNAL_BLOCK, sourceIds } from './data.mjs';
import { issueKey,formatDate } from './serialization.mjs';
function statusFor(index, variant) {
  if (variant === 'unknown-status' && index === ISSUE_COUNT - 1) return 'Awaiting Product Review';
  return STATUSES[index % STATUSES.length];
}

function categoryFor(index, variant) {
  if (variant === 'unknown-status' && index === ISSUE_COUNT - 1) return 'To Do';
  return CATEGORIES[index % CATEGORIES.length];
}

function issueTypeFor(index) {
  if (index === 0) return 'Epic';
  if (index === 5 || index === 6) return 'Sub-task';
  return ['Story', 'Task', 'Bug'][index % 3];
}

function commentCell(index, prefix, ordinal, variant) {
  const date = formatDate(index + 1200 + ordinal, variant);
  const body = index === 0 && ordinal === 0
    ? 'Opening note, with a comma; first semicolon.\nSecond line — café ☕ and 東京.'
    : `Fixture comment ${ordinal + 1} for ${issueKey(index, prefix)}; retained body, with comma — naïve.`;
  return `${date};acct:fixture:comment-author;${body}`;
}

function attachmentCell(index, prefix, ordinal, variant) {
  const date = formatDate(index + 1800 + ordinal, variant);
  const file = `design-note-${issueKey(index, prefix)}-${ordinal + 1}.txt`;
  const url = `https://files.example.invalid/jira/${issueKey(index, prefix)}/${ordinal + 1}`;
  return `${date};acct:fixture:attachment-author;${file};${url}`;
}

export function sourceRow(index, prefix, variant) {
  const id = sourceIds[index];
  const key = issueKey(index, prefix);
  const status = statusFor(index, variant);
  const resolved = status === 'Done' ? formatDate(index + 900, variant) : '';
  const resolution = status === 'Done' ? (index % 6 === 2 ? 'Fixed' : "Won't Fix") : '';
  const parent = PARENTS.find(relation => relation.sourceIndex === index)?.parentIndex;
  const block = BLOCKS.find(relation => relation.sourceIndex === index);
  const duplicate = DUPLICATES.find(relation => relation.sourceIndex === index);
  const relates = RELATES.find(relation => relation.sourceIndex === index);
  const componentNames = ['UI', 'Indexing', 'Platform'];
  const versionNames = ['R2.0.0', 'R2.1.0', 'R2.2.0', 'R2.3.0'];
  const primaryLabel = index === 0
    ? ''
    : index % 2 === 0
      ? `fixture-label-${1 + (Math.floor(index / 2) % 4)}`
      : '';

  const values = [
    id,
    key,
    index === 0
      ? 'Synthetic epic, with commas — café'
      : `Synthetic ${issueTypeFor(index)} issue ${String(index + 1).padStart(3, '0')}`,
    index === 0
      ? 'Fixture description with a quoted "risk", comma, and Unicode: café.\nSecond source line.'
      : `Description for ${key}: independently generated source text ${index + 1}.`,
    issueTypeFor(index),
    status,
    categoryFor(index, variant),
    PRIORITIES[index % PRIORITIES.length],
    index % 4 === 0 ? mappedAssigneeAccountId : index % 4 === 1 ? unmappedAssigneeAccountId : '',
    `acct:fixture:reporter-${1 + (index % 3)}`,
    formatDate(index, variant),
    formatDate(index + 300, variant),
    index % 4 === 0 ? formatDate(index + 600, variant, false) : '',
    resolved,
    parent === undefined ? '' : sourceIds[parent],
    index % 3 === 0 ? rolloverCycle : '',
    index % 6 === 0 ? `plugin-rollout-${1 + ((index / 6) % 3)}` : '',
    primaryLabel,
    index % 5 === 0 ? String(3600 * (1 + ((index / 5) % 4))) : '',
    index % 4 === 0 ? currentCycle : index === 77 ? unmappedSprint : '',
    index % 10 === 1 ? `R1.${Math.floor(index / 10) % 3}` : '',
    index % 13 === 5 ? `secondary-label-${1 + (Math.floor(index / 13) % 3)}` : '',
    index % 10 === 0 ? '' : String(1 + (index % 8)),
    block ? issueKey(block.targetIndex, prefix) : index === EXTERNAL_BLOCK.sourceIndex ? EXTERNAL_BLOCK.targetKey : '',
    index % 7 === 0 ? componentNames[Math.floor(index / 7) % componentNames.length] : '',
    index % 4 === 0 ? commentCell(index, prefix, 0, variant) : '',
    index % 9 === 0 ? versionNames[Math.floor(index / 9) % versionNames.length] : '',
    index % 10 === 2 ? attachmentCell(index, prefix, 0, variant) : '',
    duplicate ? issueKey(duplicate.targetIndex, prefix) : '',
    index % 20 === 0 ? (Math.floor(index / 20) % 2 === 0 ? 'Internal' : 'Confidential') : '',
    index % 11 === 4 ? commentCell(index, prefix, 1, variant) : '',
    index % 17 === 0 ? `3600;acct:fixture:worklog-author;worklog for ${key}` : '',
    index % 37 === 12 ? attachmentCell(index, prefix, 1, variant) : '',
    relates ? issueKey(relates.targetIndex, prefix) : '',
    index % 8 === 0 ? `acct:fixture:watcher-${1 + (Math.floor(index / 8) % 3)}` : '',
    index % 6 === 1 ? String(1800 * (1 + (Math.floor(index / 6) % 4))) : '',
    index % 15 === 0 ? `qa-${1 + (Math.floor(index / 15) % 4)}` : '',
    index % 12 === 0 ? `tempo-account-${1 + (Math.floor(index / 12) % 2)}` : '',
    index % 25 === 0 ? ['Functional', 'Regression', 'API'][Math.floor(index / 25) % 3] : '',
    resolution,
    index % 29 === 0 ? `resolution detail for ${key}` : '',
  ];

  if (variant === 'unknown-status' && index === ISSUE_COUNT - 1) {
    values[13] = '';
    values[39] = '';
  }
  return values;
}
