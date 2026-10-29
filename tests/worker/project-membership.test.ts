import {exerciseInitiatives} from './initiatives-scenario';
import {exerciseReleases} from './releases-scenario';
import { expect, it } from 'vitest';
import { roleWorkspace, snapshot } from './role-fixture';

it('[PROJ-003 ROLE-001 RELEASE-001 INIT-001 NOTIFY-009] only Owners and Admins delete a project; removal, archive and deletion preserve its issues', async () => {
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
  await exerciseInitiatives(f);
});

it('[PROJ-014 ROLE-002 ROLE-003] spanning projects appear in each contributing team list without exposing a private contribution after access is withdrawn', async () => {
  const f = await roleWorkspace();
  const privateName = 'synthetic-vector-740';
  const privateTeam = (await f.mutate('/settings/teams', 'POST', {name: privateName, identifierPrefix: 'SYNPROJ', isPrivate: true})).teams.find(t => t.name === privateName)!;
  const project = (await f.mutate('/settings/projects', 'POST', {name: 'synthetic-vector-741', leadOperatorId: f.lead.id})).projects.find(p => p.name === 'synthetic-vector-741')!;
  const publicIssue = await f.create({teamId: f.team.id, projectId: project.id});
  const privateIssue = await f.create({teamId: privateTeam.id});
  expect((await f.call('/issues/'+privateIssue.identifier, 'PATCH', {expectedVersion: privateIssue.version, projectId: project.id})).status).toBe(200);
  const privateProject = (await f.mutate('/settings/projects', 'POST', {name: 'synthetic-vector-742', leadOperatorId: f.lead.id})).projects.find(p => p.name === 'synthetic-vector-742')!;
  await f.create({teamId: privateTeam.id, projectId: privateProject.id});
  const read = async (who: typeof f.people.owner, surface: 'call'|'api', path: string) => {
    const response = await who[surface](path);
    expect(response.status, await response.clone().text()).toBe(200);
    return response.json() as Promise<any>;
  };
  const contributors = [f.team.id, privateTeam.id].sort();
  for (const surface of ['call', 'api'] as const) {
    for (const team of [f.team, privateTeam]) {
      const portfolio = await read(f.people.owner, surface, '/projects?team='+team.id);
      const row = portfolio.projects.find((p:any) => p.id === project.id);
      expect(row.teamIds.sort()).toEqual(contributors);
      expect(row.teams).toEqual(expect.arrayContaining([{id: f.team.id, name: f.team.name}, {id: privateTeam.id, name: privateTeam.name}]));
      expect(portfolio.projects.some((p:any) => p.id === privateProject.id)).toBe(team.id === privateTeam.id);
    }
    expect((await read(f.people.owner, surface, '/projects/'+project.id)).teams.map((t:any)=>t.id).sort()).toEqual(contributors);
  }
  const restricted = async () => {
    for (const who of [f.member, f.guest]) for (const surface of ['call', 'api'] as const) {
      const list = await read(who, surface, '/projects?team='+f.team.id);
      expect(list.projects.map((p:any)=>p.id)).toContain(project.id);
      const row = list.projects.find((p:any)=>p.id === project.id);
      expect(row.teamIds).toEqual([f.team.id]);
      expect(row.teams).toEqual([{id:f.team.id, name:f.team.name}]);
      const detail = await read(who, surface, '/projects/'+project.id);
      expect(detail.teams).toEqual(row.teams);
      expect(detail.issues.map((i:any)=>i.identifier)).toEqual([publicIssue.identifier]);
      expect((await read(who, surface, '/projects?team='+privateTeam.id)).projects).toEqual([]);
      expect((await who[surface]('/projects/'+privateProject.id)).status).toBe(404);
      expect(JSON.stringify(list)).not.toContain(privateName);
      expect(JSON.stringify(detail)).not.toContain(privateIssue.identifier);
    }
    expect((await f.member.call('/documents?parentKind=team&parentId='+privateTeam.id)).status).toBe(404);
  };
  await restricted();
  await f.mutate(`/settings/teams/${privateTeam.id}/members/${f.member.id}`, 'PUT', {role:'member'});
  for (const surface of ['call', 'api'] as const) {
    const row = (await read(f.member, surface, '/projects?team='+privateTeam.id)).projects.find((p:any)=>p.id === project.id);
    expect(row.teams.map((t:any)=>t.id).sort()).toEqual(contributors);
    expect((await read(f.member, surface, '/projects/'+project.id)).issues.map((i:any)=>i.identifier).sort()).toEqual([publicIssue.identifier,privateIssue.identifier].sort());
  }
  await f.mutate(`/settings/teams/${privateTeam.id}/members/${f.member.id}`, 'DELETE');
  await restricted();
  const current = await read(f.people.owner, 'call', '/issues/'+privateIssue.identifier);
  expect((await f.call('/issues/'+privateIssue.identifier, 'PATCH', {expectedVersion:current.version, projectId:null})).status).toBe(200);
  expect((await read(f.people.owner, 'call', '/projects?team='+privateTeam.id)).projects.map((p:any)=>p.id)).not.toContain(project.id);
  expect((await read(f.people.owner, 'call', '/projects/'+project.id)).teams).toEqual([{id:f.team.id,name:f.team.name}]);
});
