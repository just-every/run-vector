import { env } from 'cloudflare:workers';
import { expect, it } from 'vitest';
import { roleWorkspace, resetLimits, snapshot } from './role-fixture';
import { actor, invite, request } from './base-auth-fixture';

it('Boolean list and saved-view doors retain exact paged results, reject invalid expressions and enforce current reader authority', async () => {
  const f = await roleWorkspace(), owner = f.people.owner;
  const marker = 'synthetic-vector-129';
  const expression = '(priority=high OR priority=urgent) AND NOT blocked';
  async function json(response: Response, status = 200): Promise<any> {
    expect(response.status, await response.clone().text()).toBe(status);
    return response.json();
  }
  const create = async (priority: string, teamId = f.team.id, suffix = '') => {
    await resetLimits();
    return json(await owner.call('/issues', 'POST', { teamId, title: marker + suffix, priority }), 201);
  };
  const high = [];
  for (let n = 0; n < 53; n++) high.push(await create('high', f.team.id, '-' + n));
  const urgent = await create('urgent'), low = await create('low');
  const blockedHigh = await create('high'), blockedUrgent = await create('urgent');
  for (const blocked of [blockedHigh, blockedUrgent]) await json(await owner.call(`/issues/${blocked.identifier}/dependencies`, 'POST', {
    direction: 'blocked-by', relatedIdentifier: low.identifier,
    expectedVersion: blocked.version, relatedVersion: (await json(await owner.call('/issues/' + low.identifier))).version,
  }));
  const archived = await create('urgent');
  // Historical archived data is fixture state; the read must keep admission
  // outside the expression even when NOT would otherwise include this row.
  await env.DB.prepare('UPDATE issues SET archived_at=? WHERE id=?').bind('2026-01-01T00:00:00.000Z', archived.id).run();
  const privateTeam = (await json(await owner.call('/settings/teams', 'POST', { name: marker, identifierPrefix: 'BOOLPRIV', isPrivate: true }))).teams.find((t: any) => t.name === marker);
  const hidden = await create('urgent', privateTeam.id);
  const read = async (who = f.member, source = expression, extra: Record<string, string> = {}) => {
    await resetLimits();
    return who.call('/issues?' + new URLSearchParams({ q: marker, expression: source, sort: 'oldest', ...extra }));
  };
  const first = await json(await read());
  expect(first.total).toBe(54);
  expect(first.issues.map((i: any) => i.identifier)).toEqual(high.slice(0, 50).map(i => i.identifier));
  const second = await json(await read(f.member, expression, { offset: '50', revision: first.revision }));
  expect(second.issues.map((i: any) => i.identifier)).toEqual([...high.slice(50), urgent].map(i => i.identifier));
  expect(second.total).toBe(54);
  expect((await read(f.member, 'priority=low', { offset: '50', revision: first.revision })).status).toBe(409);
  const identifiers = async (source: string) => {
    const page = await json(await read(f.member, source, { pageSize: '100' }));
    expect(page.statusCounts.reduce((n: number, group: any) => n + group.count, 0)).toBe(page.total);
    return page.issues.map((i: any) => i.identifier).sort();
  };
  expect(await identifiers('priority=high OR priority=urgent AND NOT blocked')).toEqual([...high, urgent, blockedHigh].map(i => i.identifier).sort());
  expect(await identifiers('NOT (priority=high OR priority=urgent)')).toEqual([low.identifier]);
  expect(await identifiers('NOT NOT blocked')).toEqual([blockedHigh, blockedUrgent].map(i => i.identifier).sort());
  expect(await identifiers('NOT priority=low OR priority=low')).not.toContain(archived.identifier);
  expect(await identifiers('NOT priority=low OR priority=low')).not.toContain(hidden.identifier);
  const legacy = await json(await f.member.call('/issues?' + new URLSearchParams({ q: marker, priority: 'urgent', blocked: 'unblocked' })));
  expect(legacy.issues.map((i: any) => i.identifier)).toEqual([urgent.identifier]);
  const query = { q: marker, expression, sort: 'oldest' };
  const view = await json(await f.member.call('/views', 'POST', { name: marker, isShared: true, query }), 201);
  const reopened = await json(await f.member.call('/views/' + view.id));
  expect(reopened.query.expression).toBe(expression);
  expect((await json(await f.member.call('/issues?' + new URLSearchParams({ ...query, pageSize: '100' })))).issues.map((i: any) => i.identifier).sort()).toEqual([...high, urgent].map(i => i.identifier).sort());
  const pref = await json(await f.member.call('/preferences/issues', 'PUT', { filters: { q: marker, expression }, sort: 'oldest' }));
  expect(pref.filters.expression).toBe(expression);
  expect((await json(await f.member.call('/preferences/issues'))).filters.expression).toBe(expression);
  const tables = ['saved_views', 'list_preferences', 'issues', 'issue_activity'];
  const before = await snapshot(tables);
  for (const invalid of ['priority=critical', 'team=all', 'blocked OR', '(blocked', 'blocked blocked', 'priority=high; SELECT 1', 'NOT '.repeat(12) + 'blocked', 'blocked OR '.repeat(60) + 'blocked', 'x'.repeat(1001)]) {
    expect((await read(f.member, invalid)).status, invalid).toBe(400);
    expect((await f.member.call('/views', 'POST', { name: marker, query: { expression: invalid } })).status).toBe(400);
    expect((await f.member.call('/preferences/issues', 'PUT', { filters: { expression: invalid } })).status).toBe(400);
  }
  expect(await snapshot(tables)).toEqual(before);
  await json(await owner.call(`/settings/teams/${privateTeam.id}/members/${f.member.id}`, 'PUT', { role: 'member' }));
  const granted = await json(await read(f.member, expression, { pageSize: '100' }));
  expect(granted.total).toBe(55);
  expect(granted.issues.map((i: any) => i.identifier)).toContain(hidden.identifier);
  await json(await owner.call(`/settings/teams/${privateTeam.id}/members/${f.member.id}`, 'DELETE'));
  expect((await read(f.member, expression, { offset: '50', revision: granted.revision })).status).toBe(409);
  expect((await json(await read())).total).toBe(54);
  expect((await json(await f.member.call('/views/' + view.id))).query.expression).toBe(expression);
  const guest = await json(await read(f.guest));
  expect(guest.total).toBe(54);
  expect(JSON.stringify(guest)).not.toContain(hidden.identifier);
  const personal = await json(await f.guest.call('/views', 'POST', { name: marker, query }), 201);
  expect((await json(await f.guest.call('/views/' + personal.id))).query.expression).toBe(expression);
  await resetLimits();
  const viewerCookie = await invite(['synthetic-vector-129', 'vector.test'].join(String.fromCharCode(64)), f.cookie, 'viewer');
  const viewer = { id: await actor(viewerCookie), call: (path: string, method = 'GET', body?: unknown) => request('/api' + path, method, body, viewerCookie) };
  expect((await json(await read(viewer as any))).total).toBe(54);
  const definitions = await snapshot(['saved_views', 'issues', 'issue_activity']);
  for (const [path, method, body] of [
    ['/views', 'POST', { name: marker, query }], ['/views/' + view.id, 'PATCH', { query: { expression: 'blocked' } }],
    ['/views/' + view.id, 'DELETE', undefined], ['/issues/' + high[0].identifier, 'PATCH', { expectedVersion: high[0].version, priority: 'low' }],
  ] as const) expect((await viewer.call(path, method, body)).status).toBe(403);
  expect(await snapshot(['saved_views', 'issues', 'issue_activity'])).toEqual(definitions);
  await request('/auth/signout', 'POST', {}, viewerCookie);
  expect((await viewer.call('/issues?expression=NOT+blocked')).status).toBe(401);
}, 120_000);
