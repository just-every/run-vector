import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { hashToken } from '../../vendor/base/operator-auth/crypto.mjs';
import { localAuthSecret } from './outbox-session.mjs';
import { readLocalD1 } from './local-d1-read.mjs';

// Local-outbox auth deliberately maps every client to "loopback", ignoring
// CF-Connecting-IP. Independent invited journeys therefore share one IP budget.
// Use the harness's existing local D1 command seam between journeys, resetting
// only that IP bucket. Token/email limits and the native 30-attempt limit stay
// intact, and a failed confirmation is never retried.
const key = await hashToken(localAuthSecret, 'rate', 'confirmation:ip:loopback');
const segments = new Map();

export function resetInvitationConfirmationBudget(state) {
  const output = execFileSync('pnpm', ['exec', 'wrangler', 'd1', 'execute',
    'vector-local', '--local', '--config', 'wrangler.jsonc', '--persist-to', state,
    '--command', `DELETE FROM oa_limits WHERE key='${key}' RETURNING window,count`, '--json'],
  { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  const rows = JSON.parse(output)[0].results;
  if (!segments.has(state)) segments.set(state, []);
  segments.get(state).push(...rows);
}

export function invitationConfirmationLedger(state) {
  const buckets = [...(segments.get(state) ?? []),
    ...readLocalD1(state, `SELECT window,count FROM oa_limits WHERE key='${key}'`)];
  const peak = Math.max(0, ...buckets.map(bucket => bucket.count));
  assert.ok(peak < 30, 'Independent journeys stay below the native confirmation IP limit');
  const ledger = { client: 'loopback', limit: 30, peak, buckets };
  console.info('[Invitation confirmation ledger] ' + JSON.stringify(ledger));
  return ledger;
}
