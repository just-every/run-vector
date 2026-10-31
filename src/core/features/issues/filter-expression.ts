/** The native Boolean grammar is deliberately closed: SQL never consumes tokens. */
export const expressionLimit = 1000;
export const expressionDepth = 8;
export const priorities = ['urgent', 'high', 'medium', 'low', 'none'] as const;
export type Priority = typeof priorities[number];
export type FilterExpression =
  | { kind: 'priority'; value: Priority }
  | { kind: 'blocked' }
  | { kind: 'not'; child: FilterExpression }
  | { kind: 'and' | 'or'; left: FilterExpression; right: FilterExpression };

export function parseFilterExpression(source: string): FilterExpression | null {
  if (source.length > expressionLimit) throw new Error('Filter expression is too long.');
  if (!source.trim()) return null;
  const tokens = source.match(/[A-Za-z]+|[()=]|\S/g) ?? [];
  if (tokens.length > 96) throw new Error('Filter expression has too many terms.');
  let position = 0, nodes = 0;
  const peek = () => tokens[position]?.toLowerCase();
  const take = (word: string) => {
    if (peek() !== word) return false;
    position++;
    return true;
  };
  const node = (value: FilterExpression): FilterExpression => {
    if (++nodes > 48) throw new Error('Filter expression has too many terms.');
    return value;
  };
  function atom(depth: number): FilterExpression {
    if (depth > expressionDepth) throw new Error('Filter expression is nested too deeply.');
    if (take('not')) return node({ kind: 'not', child: atom(depth + 1) });
    if (take('(')) {
      const inner = either(depth + 1);
      if (!take(')')) throw new Error('Close each filter group with a parenthesis.');
      return inner;
    }
    if (take('blocked')) return node({ kind: 'blocked' });
    if (take('priority') && take('=')) {
      const value = peek();
      if (priorities.includes(value as Priority)) {
        position++;
        return node({ kind: 'priority', value: value as Priority });
      }
    }
    throw new Error('Use priority=urgent, high, medium, low or none, or blocked, with AND, OR and NOT.');
  }
  function both(depth: number): FilterExpression {
    let left = atom(depth);
    while (take('and')) left = node({ kind: 'and', left, right: atom(depth) });
    return left;
  }
  function either(depth: number): FilterExpression {
    let left = both(depth);
    while (take('or')) left = node({ kind: 'or', left, right: both(depth) });
    return left;
  }
  const result = either(0);
  if (position !== tokens.length) throw new Error('Unsupported term or missing AND or OR in filter expression.');
  // Count structural depth too, including a long chain without parentheses.
  function check(value: FilterExpression, depth: number) {
    if (depth > expressionDepth) throw new Error('Filter expression is nested too deeply.');
    if (value.kind === 'not') check(value.child, depth + 1);
    if (value.kind === 'and' || value.kind === 'or') {
      check(value.left, depth + 1); check(value.right, depth + 1);
    }
  }
  check(result, 0);
  return result;
}

export function formatFilterExpression(value: FilterExpression): string {
  if (value.kind === 'priority') return `priority=${value.value}`;
  if (value.kind === 'blocked') return 'blocked';
  if (value.kind === 'not') return `NOT ${formatFilterExpression(value.child)}`;
  return `(${formatFilterExpression(value.left)} ${value.kind.toUpperCase()} ${formatFilterExpression(value.right)})`;
}
