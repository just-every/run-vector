import { afterEach, expect, it, vi } from 'vitest';
import { setupAdministration } from './administration-fixture';
import type { CurrentProjection } from '../../src/core/features/streams/projection';

afterEach(() => vi.useRealTimers());

it('[CURR-002] Current exposes every expired deferral in ranked order before the bounded return job has drained', async () => {
  const f = await setupAdministration();
  vi.useFakeTimers({ toFake: ['Date'] });
  const now = Date.now();
  const returnAt = new Date(now + 60000).toISOString();
  const created: string[] = [];
  for (let index = 0; index < 120; index++) {
    const response = await f.call('/intake', 'POST', {
      title: `Review settlement exception ${index + 1}`, teamId: f.initial.teams[0]!.id,
    });
    expect(response.status).toBe(201);
    const issue = await response.json() as { identifier: string; version: number };
    const deferred = await f.call(`/issues/${issue.identifier}/defer`, 'POST', { expectedVersion: issue.version, returnAt });
    expect(deferred.status).toBe(200);
    created.push(issue.identifier);
  }
  const later = await f.call('/intake', 'POST', { title: 'Wait for tomorrow’s provider file', teamId: f.initial.teams[0]!.id });
  const future = await later.json() as { identifier: string; version: number };
  expect((await f.call(`/issues/${future.identifier}/defer`, 'POST', {
    expectedVersion: future.version, returnAt: new Date(now + 3600000).toISOString(),
  })).status).toBe(200);
  vi.setSystemTime(now + 60001);
  const response = await f.call('/current');
  expect(response.status).toBe(200);
  const current = await response.json() as CurrentProjection;
  const rows = current.sections['needs-decision'];
  expect(rows.map(row => row.identifier).sort()).toEqual(created.sort());
  const futureResponse = await f.call('/current?at=' + encodeURIComponent(new Date(now + 7200000).toISOString()));
  expect(futureResponse.status).toBe(200);
  expect(((await futureResponse.json()) as CurrentProjection).sections['needs-decision'].some(row => row.identifier === future.identifier)).toBe(false);
  expect(rows.every(row => row.primaryReason === 'awaiting-decision')).toBe(true);
  // The first bounded return batch is newer; both the returned and still-due
  // groups obey the final stable-identifier tie breaker, without hiding either.
  const expected = [...rows].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.identifier.localeCompare(b.identifier));
  expect(rows.map(row => row.identifier)).toEqual(expected.map(row => row.identifier));
});
