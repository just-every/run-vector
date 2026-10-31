import { isLinkField, filterLinkSql } from './filter-link-sql';
import { calendarBoundary } from './filter-calendar';
import { dateFields, type FilterTerm } from './filter-operands';
const columns = {
  category: 's.category', status: 's.id', assignee: 'a.id', team: 't.id', project: 'p.id', cycle: 'c.id',
  parent: 'parent.identifier', milestone: 'i.milestone_id', title: 'i.title', identifier: 'i.identifier',
  description: 'i.description', outcome: 'i.expected_outcome', impact: 'i.customer_impact', estimate: 'i.estimate',
  due: 'i.due_date', start: 'i.start_date', created: 'i.created_at', updated: 'i.updated_at', completed: 'i.completed_at', canceled: 'i.canceled_at', deferred: 'i.deferred_until',
} as const;
const weekdays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
function addDays(day: string, days: number) {
  const date = new Date(day + 'T12:00:00Z');
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().split('T')[0];
}
function calendarValue(value: string, today: string) {
  if (value === 'today') return today;
  if (value === 'tomorrow') return addDays(today, 1);
  if (value === 'yesterday') return addDays(today, -1);
  if (value.startsWith('next ')) {
    const day = new Date(today + 'T12:00:00Z').getUTCDay();
    return addDays(today, (weekdays.indexOf(value.slice(5)) - day + 7) % 7 || 7);
  }
  return value;
}
/** A term always returns a Boolean, including missing values, before negation. */
export function filterTermSql(term: FilterTerm, actor: string, today: string, timezone: string) {
  if (isLinkField(term.field)) return filterLinkSql(term, actor);
  const values: (string | number)[] = [];
  const bind = (value: string | number) => { values.push(value); return '?'; };
  const { field, value, operator } = term;
  const negative = operator === '!=';
  let sql: string;
  if (field === 'label') {
    sql = `EXISTS(SELECT 1 FROM issue_labels expression_label JOIN labels expression_definition ON expression_definition.id=expression_label.label_id AND expression_definition.workspace_id=t.workspace_id WHERE expression_label.issue_id=i.id${value === 'none' ? '' : ' AND expression_label.label_id=' + bind(value)})`;
    if (value === 'none') sql = `(NOT ${sql})`;
  } else {
    const column = columns[field as keyof typeof columns];
    if (value === 'none' && !term.literal && !['title', 'identifier', 'description'].includes(field)) sql = `${column} IS NULL`;
    else if (dateFields.includes(field)) {
      let from: string, to: string;
      if (operator === 'within') {
        // Calendar days include today; the saved expression stays relative.
        from = addDays(today, 1 - Number(value.split(' ')[1])); to = addDays(today, 1);
      } else { from = calendarValue(value, today); to = addDays(from, 1); }
      if (!['due', 'start'].includes(field)) {
        from = calendarBoundary(from, timezone);
        to = calendarBoundary(to, timezone);
      }
      const start = () => bind(from), end = () => bind(to);
      sql = operator === '<' ? `${column}<${start()}` : operator === '<=' ? `${column}<${end()}`
        : operator === '>' ? `${column}>=${end()}` : operator === '>=' ? `${column}>=${start()}`
        : `(${column}>=${start()} AND ${column}<${end()})`;
    } else {
      const resolved = field === 'assignee' && value === 'me' ? actor : field === 'estimate' ? Number(value) : value;
      sql = operator === '~' ? `instr(lower(${column}),lower(${bind(resolved)}))>0`
        : `${column}${negative ? '=' : operator}${bind(resolved)}`;
    }
  }
  const positive = `COALESCE((${sql}),0)`;
  return { sql: negative ? `(NOT ${positive})` : positive, values };
}
