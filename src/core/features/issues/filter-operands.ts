/** Closed operand inventory shared by typed expressions and the menu. */
export const operandLabels = {
  category: 'Status category', status: 'Status', assignee: 'Assignee', team: 'Team',
  project: 'Project', cycle: 'Cycle', label: 'Label', parent: 'Parent issue', milestone: 'Milestone',
  title: 'Title', identifier: 'Identifier', description: 'Description',
  outcome: 'Expected outcome', impact: 'Customer impact', estimate: 'Estimate',
  due: 'Due date', start: 'Start date', created: 'Created date', updated: 'Updated date',
} as const;
export type Operand = keyof typeof operandLabels;
export type Operator = '=' | '!=' | '~' | '<' | '<=' | '>' | '>=' | 'within';
export type FilterTerm = { kind: 'term'; field: Operand; operator: Operator; value: string };
export const categories = ['intake', 'backlog', 'unstarted', 'started', 'completed', 'canceled', 'duplicate'];
export const dateFields = ['due', 'start', 'created', 'updated'];
const textFields = ['title', 'identifier', 'description', 'outcome', 'impact'];
const nullable = ['assignee', 'project', 'cycle', 'label', 'parent', 'milestone', 'estimate', 'due', 'start', 'outcome', 'impact'];
export function operatorsFor(field: Operand): Operator[] {
  if (dateFields.includes(field)) return ['=', '!=', '<', '<=', '>', '>=', 'within'];
  if (field === 'estimate') return ['=', '!=', '<', '<=', '>', '>='];
  return textFields.includes(field) ? ['=', '!=', '~'] : ['=', '!='];
}
export function validateTerm(field: string, operator: string, value: string): FilterTerm {
  if (!Object.hasOwn(operandLabels, field)) throw new Error('Unsupported filter field. Choose a field from the menu.');
  const operand = field as Operand;
  if (!operatorsFor(operand).includes(operator as Operator)) throw new Error('That operator is not supported for this field.');
  if (!value || value.length > 200) throw new Error('Enter a filter value of at most 200 characters.');
  if (value === 'none' && nullable.includes(field)) {
    if (!['=', '!='].includes(operator)) throw new Error('Use = or != with none.');
  } else if (field === 'category') {
    if (!categories.includes(value)) throw new Error('Choose a supported status category.');
  } else if (field === 'estimate') {
    if (!/^\d{1,3}$/.test(value) || Number(value) < 1 || Number(value) > 100) throw new Error('Estimate must be a number from 1 to 100, or none.');
  } else if (dateFields.includes(field)) {
    const validDate = /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
    const relative = /^(today|tomorrow|yesterday|next (monday|tuesday|wednesday|thursday|friday|saturday|sunday))$/.test(value);
    const days = /^last ([1-9]\d{0,2}) days$/.test(value);
    if (operator === 'within' ? !days : !(validDate || relative)) throw new Error('Use a calendar date, today, tomorrow, yesterday, next weekday, or within "last 7 days".');
  } else if (!textFields.includes(field)) {
    const valid = field === 'parent' ? /^[A-Z][A-Z0-9_]{1,99}-[1-9][0-9]*$/.test(value)
      : /^[0-9A-HJKMNP-TV-Z]{26}$/.test(value) || (field === 'assignee' && value === 'me');
    if (!valid) throw new Error('Choose a current record from the filter suggestions, or use its identifier.');
  }
  return { kind: 'term', field: operand, operator: operator as Operator, value };
}
export function formatTerm(term: FilterTerm) {
  const value = /^[A-Za-z0-9_-]+$/.test(term.value) ? term.value : JSON.stringify(term.value);
  return `${term.field}${term.operator === 'within' ? ' within ' : term.operator}${value}`;
}
