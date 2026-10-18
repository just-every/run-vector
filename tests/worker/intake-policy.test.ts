import { expect, it } from 'vitest';
import { setupIntegrations } from './integration-fixture';
import { intakeRecommendation } from '../../src/core/features/issues/ui/intake-recommendation';
import { issueDetailSchema } from '../../src/core/features/issues/ui/data';
import { optionsSchema } from '../../src/core/features/streams/ui/data';

it('[INTAKE-010] signed explicit assignee suggestions and unassigned defaults remain editable before acceptance', async () => {
  const f = await setupIntegrations(), source = await f.source();
  const options = optionsSchema.parse(await (await f.call('/options')).json());
  const team = f.initial.teams[0]!;
  const base = { teamId: team.id, title: 'Investigate delayed payment confirmations', sourceRevisionId: 'first', observedAt: new Date().toISOString() };
  const read = async (identifier: string) => issueDetailSchema.parse(await (await f.call('/issues/' + identifier)).json());
  for (const explicit of [true, false]) {
    const response = await f.signed(source, { ...base, sourceRecordId: explicit ? 'assigned' : 'unassigned', ...(explicit ? { assertions: { assigneeOperatorId: { value: f.owner, attribution: 'source' } } } : {}) });
    expect(response.status).toBe(200);
    const { identifier } = await response.json() as {identifier: string};
    const before = await read(identifier), suggested = intakeRecommendation(before, options);
    expect(before.status.category).toBe('intake');
    expect(before.assignee).toBeNull();
    expect(suggested.assigneeOperatorId).toBe(explicit ? f.owner : '');
    expect(suggested.priority).toBe('none');
    expect(suggested.statusId).toBe(team.statuses.find(s => s.category === 'unstarted')!.id);
    const accepted = await f.call('/issues/' + identifier + '/accept', 'POST', {
      expectedVersion: before.version, assigneeOperatorId: explicit ? null : f.owner,
      priority: 'high', statusId: team.statuses.find(s => s.category === 'started')!.id,
    });
    expect(accepted.status).toBe(200);
    const after = await read(identifier);
    expect(after.assignee?.id ?? null).toBe(explicit ? null : f.owner);
    expect(after.priority).toBe('high');
    expect(after.status.category).toBe('started');
    expect(after.team.id).toBe(team.id);
  }
  const unknown = await f.signed(source, { ...base, sourceRecordId: 'unknown-person', assertions: { assigneeOperatorId: {value: '01K00000000000000000000099', attribution: 'source'} } });
  expect(unknown.status).toBe(200);
  const issue = await read((await unknown.json() as {identifier:string}).identifier);
  expect(intakeRecommendation(issue, options).assigneeOperatorId).toBe('');
  expect(issue.assignee).toBeNull();
});
