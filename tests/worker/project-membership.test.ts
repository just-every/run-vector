import { expect, it } from 'vitest';
import { setupAdministration } from './administration-fixture';

it('[PROJ-003] removing, archiving and deleting a project preserve its issues and record detachment once', async () => {
  const f = await setupAdministration();
  const state = await f.mutate('/settings/projects', 'POST', { name: 'Payment reliability', leadOperatorId: f.owner });
  const project = state.projects.find(p => p.name === 'Payment reliability')!;
  const first = await f.create({ projectId: project.id, title: 'Handle delayed confirmations', description: 'Keep the payment evidence.' });
  const second = await f.create({ projectId: project.id, title: 'Explain settlement retries' });
  const read = async (identifier: string) => {
    const response = await f.call('/issues/' + identifier);
    expect(response.status).toBe(200);
    return response.json() as Promise<any>;
  };
  const removed = await f.call('/issues/' + first.identifier, 'PATCH', { expectedVersion: first.version, projectId: null });
  expect(removed.status).toBe(200);
  expect((await read(first.identifier)).project).toBeNull();
  await f.mutate('/settings/projects/' + project.id, 'PATCH', { archived: true });
  expect((await read(second.identifier)).project.id).toBe(project.id);
  const before = await read(second.identifier);
  await f.mutate('/settings/projects/' + project.id, 'DELETE');
  for (const original of [first, second]) {
    const issue = await read(original.identifier);
    expect(issue.id).toBe(original.id);
    expect(issue.title).toBe(original === first ? 'Handle delayed confirmations' : 'Explain settlement retries');
    expect(issue.project).toBeNull();
  }
  const after = await read(second.identifier);
  expect(after.version).toBe(before.version + 1);
  expect(after.activity.filter((a: {kind: string}) => a.kind === 'project.removed')).toHaveLength(1);
  expect((await read(first.identifier)).description).toBe('Keep the payment evidence.');
  expect((await f.call('/projects/' + project.id)).status).toBe(404);
  expect((await f.call('/settings/projects/' + project.id, 'DELETE')).status).toBe(404);
  expect((await read(second.identifier)).version).toBe(after.version);
});
