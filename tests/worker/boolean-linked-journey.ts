import { booleanLinkedUpgrade } from './boolean-linked-upgrade';
import { expect } from 'vitest';
import { createServerApp } from '../../src/core/app/server';
import { bindings } from './base-auth-fixture';
import { roleWorkspace, resetLimits, snapshot } from './role-fixture';
type Fixture = Awaited<ReturnType<typeof roleWorkspace>>;

export async function linkedBooleanJourney(f: Fixture, high: any[], urgent: any, low: any, privateTeam: any, hidden: any) {
  const owner = f.people.owner, marker = 'synthetic-vector-129';
  const json = async (response: Response, status = 200): Promise<any> => {
    expect(response.status, await response.clone().text()).toBe(status); return response.json();
  };
  const send = async (path: string, method = 'GET', body?: unknown, status = 200) => {
    await resetLimits(); return json(await owner.call(path, method, body), status);
  };
  const page = async (expression: string, who = f.member, extra: Record<string, string> = {}) => {
    await resetLimits(); return who.call('/issues?' + new URLSearchParams({ q: marker, expression, sort: 'oldest', ...extra }));
  };
  const ids = async (expression: string, who = f.member) => {
    const data = await json(await page(expression, who, { pageSize: '100' }));
    expect(data.statusCounts.reduce((sum: number, g: any) => sum + g.count, 0)).toBe(data.total);
    expect(data.issues).toHaveLength(data.total);
    return data.issues.map((i: any) => i.identifier).sort();
  };
  const related = await send('/issues/' + high[0].identifier);
  const endpoint = await send('/issues/' + low.identifier);
  await send('/issues/' + related.identifier + '/dependencies', 'POST', { direction: 'related', expectedVersion: related.version, relatedIdentifier: endpoint.identifier, relatedVersion: endpoint.version });
  expect(await ids('related=' + low.identifier)).toEqual([high[0].identifier]);
  expect(await ids('related=' + high[0].identifier)).toEqual([low.identifier]);
  const blocked = (await ids('blocked')).sort();
  expect(blocked).toHaveLength(2);
  expect(await ids('blockedby=' + low.identifier)).toEqual(blocked);
  expect(await ids('blocks=' + blocked[0])).toEqual([low.identifier]);
  expect(await ids('NOT related=none')).toEqual([high[0].identifier, low.identifier].sort());
  const visibleCreated = [...high, urgent, low].map(issue => issue.identifier).concat(blocked).sort();
  expect(await ids('NOT creator=none')).toEqual(visibleCreated);
  expect(await ids('creator=me', owner)).toEqual([...visibleCreated, hidden.identifier].sort());
  expect(await ids('creator=me')).toEqual([]);
  expect(await ids('follower=' + owner.id)).toEqual(visibleCreated);
  const release = await send('/releases', 'POST', { name: 'synthetic-vector-133 release' }, 201);
  let saved = await send('/releases/' + release.id + '/scope', 'PUT', { expectedVersion: release.version, issueIdentifiers: high.map(i => i.identifier), projectIds: [] });
  const expression = 'release=' + release.id;
  expect((await json(await f.member.call('/options'))).releases).toContainEqual({ id: release.id, name: release.name });
  expect((await json(await f.guest.call('/options'))).releases).toEqual([]);
  const privateRelease = await send('/releases', 'POST', { name: 'synthetic-vector-133 private release', teamId: privateTeam.id }, 201);
  await send('/releases/' + privateRelease.id + '/scope', 'PUT', { expectedVersion: privateRelease.version, issueIdentifiers: [hidden.identifier], projectIds: [] });
  expect(JSON.stringify((await json(await f.member.call('/options'))).releases)).not.toContain(privateRelease.id);
  const first = await json(await page(expression));
  expect(first.total).toBe(53); expect(first.issues.map((i: any) => i.identifier)).toEqual(high.slice(0, 50).map(i => i.identifier));
  const second = await json(await page(expression, f.member, { offset: '50', revision: first.revision }));
  expect(second.total).toBe(53); expect(second.issues.map((i: any) => i.identifier)).toEqual(high.slice(50).map(i => i.identifier));
  saved = await send('/releases/' + release.id + '/scope', 'PUT', { expectedVersion: saved.version, issueIdentifiers: high.slice(1).map(i => i.identifier), projectIds: [] });
  expect((await page(expression, f.member, { offset: '50', revision: first.revision })).status).toBe(409);
  expect(await ids(expression)).toEqual(high.slice(1).map(i => i.identifier).sort());
  const project = (await send('/settings/projects', 'POST', { name: 'synthetic-vector-133 release project', leadOperatorId: owner.id })).projects.find((p: any) => p.name === 'synthetic-vector-133 release project');
  await send('/issues/' + urgent.identifier, 'PATCH', { expectedVersion: urgent.version, projectId: project.id });
  await send('/releases/' + release.id + '/scope', 'PUT', { expectedVersion: saved.version, issueIdentifiers: high.slice(1).map(i => i.identifier), projectIds: [project.id] });
  expect(await ids(expression)).toEqual([...high.slice(1), urgent].map(i => i.identifier).sort());
  expect(await ids(expression, f.guest)).toEqual([], 'Guest cannot acquire release membership through a list predicate');
  const app = createServerApp(), repository = ['synthetic-vector-133', 'filter-state'].join('/');
  const config = await send('/settings/integrations/github', 'POST', { name: 'synthetic-vector-133', repository }, 201);
  const event = (state = 'open', at = '2026-10-31T10:00:00.000Z', merged = false) => ({ action: state === 'open' ? 'opened' : 'closed', number: 133,
    repository: { full_name: repository }, pull_request: { number: 133, title: 'Refs ' + high[0].identifier, body: null, html_url: 'https://github.com/' + repository + '/pull/133', state, merged, updated_at: at } });
  const receive = async (value: unknown, delivery = crypto.randomUUID(), tamper = false) => {
    const body = JSON.stringify(value), key = await crypto.subtle.importKey('raw', new TextEncoder().encode(config.secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const signature = [...new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body)))].map(byte => byte.toString(16).padStart(2, '0')).join('');
    return app.request(config.receiver, { method: 'POST', headers: { 'X-Hub-Signature-256': 'sha256=' + signature, 'X-GitHub-Delivery': delivery, 'X-GitHub-Event': 'pull_request', 'Content-Type': 'application/json' }, body: tamper ? body + ' ' : body }, bindings);
  };
  const revision = await json(await page('git=none'));
  const delivery = crypto.randomUUID(); expect((await receive(event(), delivery)).status).toBe(200);
  expect(await ids('git=open')).toEqual([high[0].identifier]);
  expect((await page('git=none', f.member, { offset: '50', revision: revision.revision })).status).toBe(409);
  const stable = await snapshot(['issues', 'vector_github_pull_requests', 'vector_github_issue_links']);
  expect((await receive(event(), delivery)).status).toBe(200);
  expect((await receive(event('closed'), crypto.randomUUID(), true)).status).toBe(401);
  expect(await snapshot(['issues', 'vector_github_pull_requests', 'vector_github_issue_links'])).toEqual(stable);
  expect((await receive(event('closed', '2026-10-31T10:01:00.000Z', true))).status).toBe(200);
  expect(await ids('git=open')).toEqual([]); expect(await ids('git=merged')).toEqual([high[0].identifier]);
  // A public issue linked to private work must not turn that private fact into
  // an existence oracle. Current endpoint visibility is applied before NOT.
  await send(`/settings/teams/${privateTeam.id}/members/${f.member.id}`, 'PUT', { role: 'member' });
  expect((await json(await f.member.call('/options'))).releases).toContainEqual({ id: privateRelease.id, name: privateRelease.name });
  expect(await ids('release=' + privateRelease.id)).toEqual([hidden.identifier]);
  const publicNow = await send('/issues/' + high[1].identifier), hiddenNow = await send('/issues/' + hidden.identifier);
  await send('/issues/' + high[1].identifier + '/dependencies', 'POST', { direction: 'related', expectedVersion: publicNow.version, relatedIdentifier: hidden.identifier, relatedVersion: hiddenNow.version });
  expect(await ids('related=' + hidden.identifier)).toEqual([high[1].identifier]);
  const granted = await json(await page('NOT related=none'));
  await send(`/settings/teams/${privateTeam.id}/members/${f.member.id}`, 'DELETE');
  expect((await page('NOT related=none', f.member, { offset: '50', revision: granted.revision })).status).toBe(409);
  expect(await ids('release=' + privateRelease.id)).toEqual([]);
  expect(JSON.stringify((await json(await f.member.call('/options'))).releases)).not.toContain(privateRelease.name);
  expect(await ids('related=' + hidden.identifier)).toEqual([]);
  expect(await ids('NOT related=none')).toEqual([high[0].identifier, low.identifier].sort());
  expect(await ids('related=' + hidden.identifier, f.guest)).toEqual([]);
  const view = await json(await f.member.call('/views', 'POST', { name: 'synthetic-vector-133 linked', query: { q: marker, expression: '(git=merged OR release=' + release.id + ') AND NOT related=none' } }), 201);
  expect((await json(await f.member.call('/views/' + view.id))).query.expression).toBe(view.query.expression);
  expect(await ids(view.query.expression)).toEqual([high[0].identifier]);
  await booleanLinkedUpgrade();
  console.log('PROBE SEARCH-004 linked-fields: native related, dependency, release and signed GitHub doors -> exact filtered sets; release and Git changes invalidate pages; private endpoint withdrawal removes matches; replay and invalid signatures leave stored facts unchanged');
}
