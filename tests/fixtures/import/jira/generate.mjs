import { ISSUE_COUNT,DEFAULT_KEY_PREFIX,KEY_PREFIX_PATTERN,jiraColumns } from './data.mjs';
import { sourceRow } from './rows.mjs';
import { csvCell } from './serialization.mjs';
import { makeExpected } from './expected.mjs';
export { jiraColumns } from './data.mjs';
/**
 * Return a deterministic 300-issue supported-profile CSV and independent
 * fixture expectations. `sourceKeyPrefix` changes issue keys only; source IDs
 * remain stable so a second import run can use a separate namespace.
 *
 * Variants: `baseline`, `ambiguous-numeric-dates`, `missing-required-column`,
 * and `unknown-status`.
 */
export function generateJiraFixture({ variant = 'baseline', sourceKeyPrefix = DEFAULT_KEY_PREFIX } = {}) {
  const validVariants = new Set([
    'baseline', 'ambiguous-numeric-dates', 'missing-required-column', 'unknown-status',
  ]);
  if (!validVariants.has(variant)) throw new Error(`Unknown Jira fixture variant: ${variant}`);
  if (typeof sourceKeyPrefix !== 'string' || !KEY_PREFIX_PATTERN.test(sourceKeyPrefix)) {
    throw new Error('sourceKeyPrefix must begin with a letter and contain only letters, digits, or underscores (up to 10 characters).');
  }

  const headers = [...jiraColumns];
  let rows = Array.from({ length: ISSUE_COUNT }, (_, index) => sourceRow(index, sourceKeyPrefix, variant));
  if (variant === 'missing-required-column') {
    headers.splice(0, 1);
    rows = rows.map(row => row.slice(1));
  }
  const csv = [headers.map(csvCell).join(','), ...rows.map(row => row.map(csvCell).join(','))].join('\n') + '\n';

  return {
    variant,
    headers,
    rows,
    csv,
    expected: makeExpected(sourceKeyPrefix, variant),
  };
}
