import {exerciseReleases} from './releases-scenario';
import { expect, it } from 'vitest';
import { roleWorkspace, snapshot } from './role-fixture';

it('[PROJ-003 ROLE-001 RELEASE-001] only Owners and Admins delete a project; removal, archive and deletion preserve its issues', async () => {
  const f = await roleWorkspace();
  for (const surface of ['session', 'api'] as const) {
    const name = `Payment reliability ${surface}`;
    const state = await f.mutate('/settings/projects', 'POST', { name, leadOperatorId: f.lead.id });
    const project = state.projects.find(p => p.name === name)!;
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
    const path = surface === 'session' ? '/settings/projects/' + project.id : '/projects/' + project.id;
    for (const actor of [f.lead, f.member, f.guest]) {
      const unchanged = await snapshot(['projects', 'issues', 'issue_activity', 'project_activity', 'audit_records']);
      const response = await (surface === 'session' ? actor.call : actor.api)(path, 'DELETE');
      expect(response.status, `${surface} refuses ${actor.id}`).toBe(403);
      expect(await snapshot(['projects', 'issues', 'issue_activity', 'project_activity', 'audit_records'])).toEqual(unchanged);
    }
    const deletion = await (surface === 'session' ? f.call : f.admin.api)(path, 'DELETE');
    expect(deletion.status, await deletion.clone().text()).toBe(200);
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
  }
  await exerciseReleases(f);
});
