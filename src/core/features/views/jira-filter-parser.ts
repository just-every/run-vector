import { formatFilterExpression, parseFilterExpression, priorities, type FilterExpression } from '../issues/filter-expression';
import { validateTerm, type Operand } from '../issues/filter-operands';
export type JiraMapping = { field: Operand | 'priority'; values: Record<string, string> };
export type JiraMappings = Record<string, JiraMapping>;
export class JiraFilterError extends Error {
  constructor(readonly omissions: { term: string; reason: string }[]) { super('The Jira filter was not imported. Review every omitted term.'); }
}
type Truth = { yes: FilterExpression; no: FilterExpression };
const not = (child: FilterExpression): FilterExpression => ({ kind: 'not', child });
const group = (kind: 'and' | 'or', left: FilterExpression, right: FilterExpression): FilterExpression => ({ kind, left, right });
const nullable = ['duplicateof', 'duplicates', 'priority', 'assignee', 'project', 'cycle', 'label', 'parent', 'milestone', 'release', 'git', 'creator', 'follower', 'estimate', 'due', 'start', 'completed', 'canceled', 'deferred'];
const unavailable = (term: string, reason: string): never => { throw new JiraFilterError([{ term, reason }]); };

/** JQL uses three-valued comparisons. Both truth projections retain EMPTY
 * semantics, including NOT and NOT IN, in the native total-Boolean grammar. */
export function translateJiraFilter(source: string, mappings: JiraMappings) {
  if (!source.trim() || source.length > 1000) unavailable('JQL', 'Use a nonempty expression of at most 1000 characters.');
  const tokens = source.match(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|[A-Za-z0-9_.:-]+|!=|<=|>=|!~|[(),=<>~]|\S/g) ?? [];
  if (tokens.length > 96) unavailable('JQL', 'The expression has too many terms.');
  let position = 0;
  const peek = () => tokens[position]?.toLowerCase();
  const take = (word: string) => { if (peek() !== word) return false; position++; return true; };
  const read = () => {
    const token = tokens[position++];
    if (!token || /^[(),]$/.test(token)) return unavailable('JQL', 'A field or value is missing.');
    if (token.startsWith('"')) { try { return JSON.parse(token) as string; } catch { return unavailable(token, 'Invalid quoted value.'); } }
    if (token.startsWith("'")) {
      if (token.length < 2 || !token.endsWith("'") || /\\[^'\\]/.test(token)) return unavailable(token, 'Unsupported quoted escape.');
      return token.slice(1, -1).replace(/\\(['\\])/g, '$1');
    }
    return token;
  };
  function atom(depth: number): Truth {
    if (depth > 8) unavailable('JQL', 'The expression is nested too deeply.');
    if (take('not')) { const child = atom(depth + 1); return { yes: child.no, no: child.yes }; }
    if (take('(')) { const inner = either(depth + 1); if (!take(')')) unavailable('JQL', 'Close each group.'); return inner; }
    const sourceField = read(), mapping = mappings[sourceField.toLowerCase()];
    if (!mapping) unavailable(sourceField, 'An explicit native field mapping is required.');
    const field = mapping.field;
    const term = (value: string, operator = '='): FilterExpression => {
      try {
        if (field === 'priority') {
          if (operator !== '=' || !priorities.includes(value as typeof priorities[number])) throw Error('Use a mapped native priority equality.');
          return { kind: 'priority', value: value as typeof priorities[number] };
        }
        if (['title', 'identifier', 'description', 'outcome', 'impact'].includes(field)) throw Error('Text matching is not qualified as equivalent to Jira text operators.');
        return validateTerm(field, operator, value);
      } catch (error) { return unavailable(sourceField, (error as Error).message); }
    };
    const present = () => {
      if (!nullable.includes(field)) unavailable(sourceField, 'This native field has no qualified EMPTY mapping.');
      return not(term('none'));
    };
    if (take('is')) {
      const inverse = take('not');
      if (!(take('empty') || take('null'))) unavailable(sourceField, 'Use IS EMPTY or IS NOT EMPTY.');
      const yes = term('none'), no = present();
      return inverse ? { yes: no, no: yes } : { yes, no };
    }
    const inverse = take('not');
    let operator = read().toLowerCase();
    if (inverse && operator !== 'in') unavailable(sourceField, 'Use NOT IN or a Boolean NOT group.');
    const sourceValue = () => {
      let value = read();
      if (take('(')) {
        if (!take(')') || value.toLowerCase() !== 'currentuser' || !['assignee', 'creator', 'follower'].includes(field)) unavailable(sourceField, 'That Jira function is not qualified.');
        return 'me';
      }
      if (!Object.hasOwn(mapping.values, value)) unavailable(sourceField + '=' + value, 'An explicit native value mapping is required.');
      return mapping.values[value];
    };
    let yes: FilterExpression;
    if (operator === 'in') {
      if (!take('(')) unavailable(sourceField, 'Use a parenthesized IN list.');
      const values = [term(sourceValue())];
      while (take(',')) {
        if (values.length >= 8) unavailable(sourceField, 'Use at most eight mapped values in an IN list.');
        values.push(term(sourceValue()));
      }
      if (!take(')')) unavailable(sourceField, 'Close the IN list.');
      const combine = (items: FilterExpression[]): FilterExpression => items.length === 1 ? items[0] : group('or', combine(items.slice(0, Math.ceil(items.length / 2))), combine(items.slice(Math.ceil(items.length / 2))));
      yes = combine(values);
    } else {
      if (!['=', '!=', '<', '<=', '>', '>='].includes(operator)) unavailable(sourceField, 'That Jira operator is not qualified.');
      if (operator === '!=') operator = '=';
      const negative = tokens[position - 1] === '!=';
      yes = term(sourceValue(), operator);
      const no = nullable.includes(field) ? group('and', present(), not(yes)) : not(yes);
      return negative ? { yes: no, no: yes } : { yes, no };
    }
    const no = nullable.includes(field) ? group('and', present(), not(yes)) : not(yes);
    return inverse ? { yes: no, no: yes } : { yes, no };
  }
  function both(depth: number): Truth {
    let left = atom(depth);
    while (take('and')) { const right = atom(depth); left = { yes: group('and', left.yes, right.yes), no: group('or', left.no, right.no) }; }
    return left;
  }
  function either(depth: number): Truth {
    let left = both(depth);
    while (take('or')) { const right = both(depth); left = { yes: group('or', left.yes, right.yes), no: group('and', left.no, right.no) }; }
    return left;
  }
  const result = either(0);
  if (position !== tokens.length) unavailable(tokens[position], 'Unsupported Jira syntax or ordering; nothing was imported.');
  // Jira queries include completed states. This explicit native tautology also
  // leaves workspace, current team visibility and archive admission outside NOT.
  const completed = validateTerm('category', '=', 'completed');
  const expression = formatFilterExpression(group('and', group('or', completed, not(completed)), result.yes));
  try { parseFilterExpression(expression); }
  catch (error) { return unavailable('JQL', (error as Error).message); }
  return expression;
}
