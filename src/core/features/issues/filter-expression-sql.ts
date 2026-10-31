import { parseFilterExpression, type FilterExpression } from './filter-expression';

/** Only whitelisted syntax is compiled; every operand value is bound. */
export function filterExpressionSql(source: string, blockedSql: string) {
  const expression = parseFilterExpression(source), values: string[] = [];
  function compile(node: FilterExpression): string {
    if (node.kind === 'priority') { values.push(node.value); return 'i.priority=?'; }
    if (node.kind === 'blocked') return `(${blockedSql})`;
    if (node.kind === 'not') return `(NOT ${compile(node.child)})`;
    return `(${compile(node.left)} ${node.kind === 'and' ? 'AND' : 'OR'} ${compile(node.right)})`;
  }
  return { sql: expression ? compile(expression) : '', values };
}
