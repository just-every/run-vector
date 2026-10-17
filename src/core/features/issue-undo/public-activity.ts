/** Reversal snapshots belong to the transaction, not to issue projections. */
export function publicActivityValue(value: unknown): unknown {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return value;
  const { undo: _retainedUndo, ...visible } = value as Record<string, unknown>;
  return visible;
}
