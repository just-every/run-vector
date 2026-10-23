import assert from 'node:assert/strict';

/** Read the ordinary persisted limiter after every journey and sign-out. */
export function requestLedger(sql) {
  const rows = sql("SELECT key,count FROM access_rate_limits WHERE key LIKE 'operator:%' ORDER BY key");
  assert.ok(rows.length, 'The full runtime has ordinary operator request buckets');
  const operators = new Map();
  const buckets = rows.map(row => {
    const match = /^operator:([^:]+):(\d+)$/.exec(row.key);
    assert.ok(match, 'Operator buckets retain their fixed-window key');
    if (!operators.has(match[1])) operators.set(match[1], operators.size + 1);
    return {operator: operators.get(match[1]), window: Number(match[2]), requests: row.count};
  });
  const peak = Math.max(...buckets.map(bucket => bucket.requests));
  assert.ok(peak <= 600, 'Every operator stays within the ordinary 600 requests per minute');
  const ledger = {fixedWindowSeconds: 60, limit: 600, peak,
    total: buckets.reduce((total, bucket) => total + bucket.requests, 0),
    operators: operators.size, buckets};
  console.log('[Operator request ledger] ' + JSON.stringify(ledger));
  return ledger;
}
