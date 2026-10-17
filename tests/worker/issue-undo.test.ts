import { expect, it } from 'vitest';
import { env } from 'cloudflare:workers';
import { collaborationFixture } from './collaboration-fixture';

async function body(response: Response, status = 200): Promise<any> {
  expect(response.status, await response.clone().text()).toBe(status);
  return response.json();
}
function receipt(response: Response): { actionId: string; expiresAt: number; identifiers: string[] } {
  const value = response.headers.get('x-vector-undo');
  expect(value).toBeTruthy();
  return JSON.parse(value!);
}

it('[ISSUE-020] single-issue Undo restores status timestamps, assignment, labels, cycle and team through native commands', async () => {
  const f = await collaborationFixture(), team = f.initial.teams[0];
  const status = (category: string) => team.statuses.find(row => row.category === category)!.id;
  await body(await f.call('/settings/labels', 'POST', { name: 'Payment reliability', color: '#2563eb' }));
  await body(await f.call('/settings/cycles', 'POST', { teamId: team.id, name: 'Payment follow-up', startsLocal: '2027-05-03T09:00', endsLocal: '2027-05-10T09:00', capacity: 20 }));
  const options = await f.data(f.cookie, '/options');
  const label = options.labels.find((row: any) => row.name === 'Payment reliability');
  const cycle = options.cycles.find((row: any) => row.name === 'Payment follow-up');
  const issue = await f.create({ statusId: status('started'), priority: 'low' });
  const read = () => f.data(f.cookie, '/issues/' + issue.identifier);
  async function roundTrip(path: string, method: string, changes: Record<string, unknown>) {
    const before = await read();
    const changed = await f.call('/issues/' + issue.identifier + path, method, { expectedVersion: before.version, ...changes });
    await body(changed);
    const action = receipt(changed);
    await body(await f.call('/issues/undo', 'POST', { actionId: action.actionId }));
    const after = await read();
    for (const field of ['status', 'priority', 'assignee', 'labels', 'cycle', 'team', 'completedAt', 'canceledAt'])
      expect(after[field]).toEqual(before[field]);
    expect(after.version).toBe(before.version + 2);
    expect(after.activity.filter((row: any) => row.nextValue?.undoOf === action.actionId)).toHaveLength(1);
  }
  for (const category of ['completed', 'canceled'])
    await roundTrip('', 'PATCH', { statusId: status(category), priority: 'urgent', assigneeOperatorId: f.bob, labelIds: [label.id] });
  await roundTrip('', 'PATCH', { cycleId: cycle.id });
  await body(await f.call('/issues/' + issue.identifier, 'PATCH', { expectedVersion: (await read()).version, cycleId: cycle.id }));
  const teams = await body(await f.call('/settings/teams', 'POST', { name: 'Undo planning', identifierPrefix: 'UNDO' }));
  const destination = teams.teams.find((row: any) => row.identifierPrefix === 'UNDO');
  await roundTrip('/team', 'POST', { teamId: destination.id, statusId: destination.statuses.find((row: any) => row.category === 'started').id });
});

it('[ISSUE-020 VIEW-004] native Undo reverses one atomic action and refuses stale, replayed, expired or foreign actions', async () => {
  const f = await collaborationFixture(), team = f.initial.teams[0];
  const read = (identifier: string) => f.data(f.cookie, '/issues/' + identifier);
  const undo = (actionId: string, cookie = f.cookie) => f.any(cookie, '/issues/undo', 'POST', { actionId });
  const a = await f.create({ description: 'Retain payment reproduction', priority: 'low' });
  const b = await f.create({ priority: 'medium' });
  const selected = async () => Promise.all([a, b].map(async issue => {
    const current = await read(issue.identifier);
    return { identifier: current.identifier, expectedVersion: current.version };
  }));
  const original = await Promise.all([a, b].map(issue => read(issue.identifier)));
  const changed = await f.call('/issues/bulk', 'POST', { issues: await selected(), changes: { priority: 'high', estimate: 8 } });
  await body(changed); const action = receipt(changed);
  expect(action.identifiers.toSorted()).toEqual([a.identifier, b.identifier].toSorted());
  await body(await undo(action.actionId, f.bobCookie), 409);
  const reversed = await body(await undo(action.actionId));
  expect(reversed.changed).toBe(2);
  for (const [index, issue] of [a, b].entries()) {
    const current = await read(issue.identifier);
    expect(current).toMatchObject({ priority: original[index].priority, estimate: original[index].estimate,
      description: original[index].description, status: original[index].status, version: original[index].version + 2 });
    expect(current.activity.filter((row: any) => row.nextValue?.undoOf)).toHaveLength(1);
  }
  const restored = await Promise.all([a, b].map(issue => read(issue.identifier)));
  await body(await undo(action.actionId), 409);
  expect(await Promise.all([a, b].map(issue => read(issue.identifier)))).toEqual(restored);

  const staleChange = await f.call('/issues/bulk', 'POST', { issues: await selected(), changes: { priority: 'urgent' } });
  await body(staleChange); const stale = receipt(staleChange);
  const concurrent = await read(b.identifier);
  await body(await f.any(f.bobCookie, '/issues/' + b.identifier, 'PATCH', { expectedVersion: concurrent.version, title: 'A teammate clarified the failure' }));
  const beforeConflict = await Promise.all([a, b].map(issue => read(issue.identifier)));
  const conflict = await body(await undo(stale.actionId), 409);
  expect(conflict.failures.some((row: any) => row.identifier === b.identifier)).toBe(true);
  expect(await Promise.all([a, b].map(issue => read(issue.identifier)))).toEqual(beforeConflict);

  const noChange = await f.call('/issues/bulk', 'POST', { issues: await selected(), changes: { priority: 'urgent' } });
  await body(noChange); expect(noChange.headers.get('x-vector-undo')).toBeNull();
  const expiryChange = await f.call('/issues/' + a.identifier, 'PATCH', { expectedVersion: (await read(a.identifier)).version, priority: 'low' });
  await body(expiryChange); const expired = receipt(expiryChange);
  await env.DB.prepare("UPDATE issue_activity SET next_value_json=json_set(next_value_json,'$.undo.expiresAt','2000-01-01T00:00:00.000Z') WHERE id=?").bind(expired.actionId).run();
  const beforeExpiry = await read(a.identifier);
  await body(await undo(expired.actionId), 410); expect(await read(a.identifier)).toEqual(beforeExpiry);

  await body(await f.call('/settings/cycles', 'POST', { teamId: team.id, name: 'Payment restoration', startsLocal: '2027-04-05T09:00', endsLocal: '2027-04-12T09:00', capacity: 20 }));
  const options = await f.data(f.cookie, '/options'), cycle = options.cycles.find((row: any) => row.name === 'Payment restoration');
  const planned = await f.create({ statusId: team.statuses.find(row => row.category === 'started')!.id, cycleId: cycle.id });
  const other = await body(await f.call('/settings/teams', 'POST', { name: 'Payments team', identifierPrefix: 'PAY' }));
  const destination = other.teams.find((row: any) => row.identifierPrefix === 'PAY');
  const moved = await f.call('/issues/bulk/team', 'POST', { teamId: destination.id, issues: [{ identifier: planned.identifier, expectedVersion: planned.version, statusId: destination.statuses.find((row: any) => row.category === 'started').id }] });
  await body(moved); await body(await undo(receipt(moved).actionId));
  expect(await read(planned.identifier)).toMatchObject({ team: { id: team.id }, status: planned.status, cycle: { id: cycle.id } });

  const written = await f.call('/issues/' + a.identifier, 'PATCH', { expectedVersion: (await read(a.identifier)).version, description: '- [x] Confirm payment retry' });
  await body(written); await body(await undo(receipt(written).actionId));
  expect((await read(a.identifier)).description).toBe(a.description);
  const history = await body(await f.call('/issues/' + a.identifier + '/description-history'));
  expect(history.revisions.at(-1).description).toBe(a.description);

  const canonical = await f.create(), incoming = await f.create();
  await body(await f.call('/issues/' + incoming.identifier + '/duplicate', 'POST', { expectedVersion: incoming.version, canonicalIdentifier: a.identifier }));
  const beforeDuplicate = await Promise.all([a, b, incoming].map(issue => read(issue.identifier)));
  const marked = await f.call('/issues/bulk/duplicate', 'POST', { issues: await selected(), canonicalIdentifier: canonical.identifier });
  await body(marked); await body(await undo(receipt(marked).actionId));
  for (const [index, issue] of [a, b, incoming].entries()) {
    const current = await read(issue.identifier), before = beforeDuplicate[index];
    expect(current).toMatchObject({ canonical: before.canonical, status: before.status,
      deferredUntil: before.deferredUntil, completedAt: before.completedAt, canceledAt: before.canceledAt, description: before.description });
    expect(current.activity.filter((row: any) => row.nextValue?.undoOf).length).toBeGreaterThan(0);
  }
  expect((await read(canonical.identifier)).duplicates).toHaveLength(0);
});
