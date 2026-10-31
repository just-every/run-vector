import { filterTermSql } from './filter-term-sql';
import { parseFilterExpression, type FilterExpression } from './filter-expression';

/** Only whitelisted syntax is compiled; every operand value is bound. */
export function filterExpressionSql(source: string, blockedSql: string, actor: string, today: string, timezone: string) {
  const expression = parseFilterExpression(source), values: (string | number)[] = [];
  function compile(node: FilterExpression): string {
    if (node.kind === 'priority') { values.push(node.value); return 'i.priority=?'; }
    if (node.kind === 'blocked') return `(${blockedSql})`;
    if (node.kind === 'term') { const term = filterTermSql(node, actor, today, timezone); values.push(...term.values); return term.sql; }
    if (node.kind === 'not') return `(NOT ${compile(node.child)})`;
    return `(${compile(node.left)} ${node.kind === 'and' ? 'AND' : 'OR'} ${compile(node.right)})`;
  }
  function usesStatus(node: FilterExpression): boolean {
    if (node.kind === 'term') return node.field === 'category' || node.field === 'status';
    if (node.kind === 'not') return usesStatus(node.child);
    return (node.kind === 'and' || node.kind === 'or') && (usesStatus(node.left) || usesStatus(node.right));
  }
  return { sql: expression ? compile(expression) : '', values, includesStatus: !!expression && usesStatus(expression) };
}
