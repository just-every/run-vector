import { env } from 'cloudflare:workers';
import { expect } from 'vitest';
import { actor, invite, request } from './base-auth-fixture';
import { resetLimits, snapshot } from './role-fixture';
import { beforeCommit } from './removal-interleaving';
import type { WorkerBindings } from '../../src/core/app/bindings';
import type { setupIntegrations } from './integration-fixture';
type Sentry = {
  connection: { id: string; receiver: string }; token: string; secret: string;
  send: (value: unknown, delivery: string, overrides?: Partial<WorkerBindings>) => Promise<Response>;
  payload: (action?: string, substatus?: string) => any;
};
/** Real mounted settings, signed Sentry receiver, issue projection and Inbox. */
export async function triageRoutingJourney(f: Awaited<ReturnType<typeof setupIntegrations>>, sentry: Sentry) {
  const read = async <T = any>(response: Response, status = 200): Promise<T> => {
    expect(response.status, await response.clone().text()).toBe(status);
    return response.json() as Promise<T>;
  };
  const origin = f.initial.teams[0];
  await read(await f.call('/settings/integrations/errors', 'POST', {
    provider: 'sentry', teamId: origin.id, regressionRule: 'reopen', token: sentry.token, secret: sentry.secret,
  }), 201);
  const target = (await read(await f.call('/settings/teams', 'POST', { name: 'Routed incidents', identifierPrefix: 'ROUTE' }))).teams.find((t: any) => t.name === 'Routed incidents');
  const other = (await read(await f.call('/settings/teams', 'POST', { name: 'Second destination', identifierPrefix: 'ROUTEB' }))).teams.find((t: any) => t.name === 'Second destination');
  const fresh = async (n: number, role?: 'admin' | 'viewer' | 'owner') => {
    await resetLimits();
    const cookie = await invite(['synthetic-vector-' + n, 'routing.test'].join('@'), f.cookie, role);
    const id = await actor(cookie);
    if (role !== 'viewer') await read(await f.call(`/settings/teams/${origin.id}/members/${id}`, 'PUT', { role: 'member' }));
    return { id, cookie, call: (p: string, m = 'GET', b?: unknown) => request('/api' + p, m, b, cookie) };
  };
  const member = await fresh(9301), admin = await fresh(9302, 'admin'), viewer = await fresh(9303, 'viewer'), guest = await fresh(9304), custodian = await fresh(9305, 'admin');
  await read(await f.call(`/settings/operators/${guest.id}/role`, 'PATCH', { role: 'guest', teamIds: [origin.id] }));
  const path = `/settings/teams/${origin.id}/triage-routing`, workspacePath = '/settings/triage-routing';
  const rule = { id: crypto.randomUUID(), name: 'Sentry incidents', sourceId: sentry.connection.id, targetTeamId: target.id };
  let version = 0;
  const save = async (rules: unknown[], who = f) => {
    const result = await read(await who.call(path, 'PUT', { expectedVersion: version, rules }));
    version = result.version;
    return result;
  };
  const tables = ['triage_routing_configs','issues','issue_activity','evidence_revisions','vector_source_records','vector_source_receipts','issue_prefix_sequences','triage_creation_receipts','notifications','notification_events','audit_records','administration_audit_details'];
  const stored = () => snapshot(tables);
  let before = await stored();
  for (const who of [member, guest, viewer]) {
    expect((await who.call(path, 'PUT', { expectedVersion: 0, rules: [rule] })).status).toBe(403);
    expect(await stored()).toEqual(before);
    expect((await who.call(workspacePath, 'PUT', { expectedVersion: 0, rules: [rule] })).status).toBe(403);
    expect(await stored()).toEqual(before);
  }
  expect((await request('/api' + path, 'PUT', { expectedVersion: 0, rules: [rule] })).status).toBe(401);
  const configured = await save([rule]);
  expect(configured).toMatchObject({ version: 1, configuredBy: f.owner, rules: [rule] });
  before = await stored();
  expect((await f.call(path, 'PUT', { expectedVersion: 0, rules: [] })).status).toBe(409);
  expect(await stored()).toEqual(before);
  expect((await f.call(path, 'PUT', { expectedVersion: version, rules: [{ ...rule, provider: 'sentry' }] })).status).toBe(400);
  expect(await stored()).toEqual(before);
  const generic = await f.source('synthetic-vector-9306');
  before = await stored();
  expect((await f.call(path, 'PUT', { expectedVersion: version, rules: [{ ...rule, sourceId: generic.id }] })).status).toBe(409);
  expect(await stored()).toEqual(before);
  // Both settings values, next-request withdrawal, and all privileged cells.
  await read(await f.call(`/settings/teams/${origin.id}/permissions`, 'PUT', { settings: 'all_members', planning: 'all_members' }));
  await save([rule], member);
  for (const who of [guest, viewer]) {
    before = await stored();
    expect((await who.call(path, 'PUT', { expectedVersion: version, rules: [rule] })).status).toBe(403);
    expect(await stored()).toEqual(before);
  }
  await read(await f.call(`/settings/teams/${origin.id}/permissions`, 'PUT', { settings: 'team_owners', planning: 'all_members' }));
  before = await stored();
  expect((await member.call(path, 'PUT', { expectedVersion: version, rules: [rule] })).status).toBe(403);
  expect(await stored()).toEqual(before);
  await save([rule], admin);
  await read(await f.call(`/settings/teams/${origin.id}/members/${member.id}`, 'PUT', { role: 'owner' }));
  await save([rule], member);
  // Target responsibility proves notification placement and source attribution.
  await read(await f.call(`/settings/teams/${target.id}/members/${member.id}`, 'PUT', { role: 'member' }));
  await read(await f.call(`/settings/teams/${target.id}/triage-rotation`, 'PUT', { startsLocal: '2026-01-05T09:00', operatorIds: [member.id, f.owner] }));
  const payload = (id: string, action = 'created', substatus = 'ongoing') => {
    const value = sentry.payload(action, substatus);
    value.data.issue.id = id;
    value.data.issue.permalink = 'https://sentry.io/organizations/synthetic-vector/issues/' + id + '/';
    return value;
  };
  const send = (id: string, revision = '1', overrides: Partial<WorkerBindings> = {}) => sentry.send(payload(id), 'synthetic-vector-' + id + '-' + revision, overrides);
  const responsibility = await read(await f.call(`/settings/teams/${target.id}/triage-rotation`));
  const notified = responsibility.responsible.id === member.id ? member : f;
  const first = await read(await send('9310'));
  const detail = (identifier = first.identifier) => f.call('/issues/' + identifier).then(read);
  let item = await detail();
  expect(item).toMatchObject({ team: { id: target.id }, status: { category: 'intake' }, routing: {
    ruleId: rule.id, ruleName: rule.name, revision: version, scope: 'team', configuredBy: member.id, sourceId: sentry.connection.id,
  } });
  expect(item.evidence[0].sourceRecordId).toBe('9310');
  expect(item.activity.find((a: any) => a.kind === 'issue.created').nextValue.routing.ruleId).toBe(rule.id);
  const inbox = (await read(await notified.call('/notifications?limit=50'))).items.filter((n: any) => n.identifier === first.identifier && n.causes.includes('triage'));
  expect(inbox).toHaveLength(1); expect(inbox[0].actor).toBe('Sentry');
  const custody = await env.DB.prepare('SELECT team_id FROM vector_integration_sources WHERE id=?').bind(sentry.connection.id).first('team_id');
  expect(custody).toBe(origin.id);
  f.restart(); before = await stored();
  expect(await read(await send('9310'))).toMatchObject({ identifier: first.identifier, reused: true });
  expect(await read(await send('9310', 'reheader'))).toMatchObject({ identifier: first.identifier, reused: true });
  expect(await stored()).toEqual(before);
  // First match wins within the ordered list; workspace scope precedes team scope.
  const secondRule = { ...rule, id: crypto.randomUUID(), name: 'Later match', targetTeamId: other.id };
  await save([rule, secondRule]);
  expect((await detail((await read(await send('9311'))).identifier)).team.id).toBe(target.id);
  await save([secondRule, rule]);
  expect((await detail((await read(await send('9312'))).identifier)).routing.ruleId).toBe(secondRule.id);
  const workspace = await read(await f.call(workspacePath, 'PUT', { expectedVersion: 0, rules: [rule] }));
  expect((await detail((await read(await send('9313'))).identifier)).routing.scope).toBe('workspace');
  await read(await f.call(workspacePath, 'PUT', { expectedVersion: workspace.version, rules: [] }));
  // A rule for a different registered Sentry connection does not match.
  const another = await read(await f.call('/settings/integrations/errors', 'POST', { provider: 'sentry', teamId: other.id, regressionRule: 'reopen', token: sentry.token, secret: sentry.secret }), 201);
  await read(await f.call(workspacePath, 'PUT', { expectedVersion: workspace.version + 1, rules: [{ ...rule, sourceId: another.id }] }));
  await save([]);
  const unmatched = await detail((await read(await send('9314'))).identifier);
  expect(unmatched.team.id).toBe(origin.id); expect(unmatched.routing).toBeNull();
  await read(await f.call(workspacePath, 'PUT', { expectedVersion: workspace.version + 2, rules: [] }));
  // Generic signed labels cannot masquerade as the registered Sentry source.
  const genericItem = await read(await f.signed(generic, { teamId: origin.id, title: 'Sentry', sourceRecordId: 'synthetic-vector-9315', sourceRevisionId: 'synthetic-vector-9316', observedAt: '2026-10-28T00:00:00Z' }));
  expect((await detail(genericItem.identifier)).routing).toBeNull();
  await save([rule], member);
  // Native acceptance, resolve and signed regression still use the destination's workflow.
  item = await detail();
  const todo = target.statuses.find((s: any) => s.category === 'unstarted');
  item = await read(await f.call('/issues/' + first.identifier + '/accept', 'POST', { expectedVersion: item.version, statusId: todo.id, assigneeOperatorId: f.owner, priority: 'medium' }));
  const done = target.statuses.find((s: any) => s.category === 'completed');
  item = await read(await f.call('/issues/' + first.identifier, 'PATCH', { expectedVersion: item.version, statusId: done.id }));
  await read(await f.call(`/settings/integrations/errors/${sentry.connection.id}/resolve`, 'POST', { identifier: first.identifier, recordId: '9310' }));
  await read(await sentry.send(payload('9310', 'unresolved', 'regressed'), 'synthetic-vector-9317'));
  item = await detail(); expect(item.status.category).toBe('started'); expect(item.completedAt).toBeNull();
  await save([secondRule]);
  const update = payload('9310', 'unresolved', 'regressed'); update.data.issue.lastSeen = '2026-10-29T00:00:00Z';
  await read(await sentry.send(update, 'synthetic-vector-9318'));
  expect((await detail()).team.id).toBe(target.id); expect((await detail()).routing).toEqual(item.routing);
  // Receipt failure must roll placement, provenance, evidence, activity and Inbox back together.
  before = await stored();
  await env.DB.prepare("CREATE TRIGGER routing_receipt_failure BEFORE INSERT ON vector_source_receipts BEGIN SELECT RAISE(ABORT,'synthetic-vector-9319'); END").run();
  try { expect((await send('9320')).status).toBe(503); expect(await stored()).toEqual(before); }
  finally { await env.DB.prepare('DROP TRIGGER routing_receipt_failure').run(); }
  // An unavailable matching destination is refused, never silently rerouted.
  await save([rule], member);
  await read(await f.call(`/settings/teams/${target.id}`, 'PATCH', { archived: true }));
  before = await stored(); expect((await send('9321')).status).toBe(409); expect(await stored()).toEqual(before);
  await read(await f.call(`/settings/teams/${target.id}`, 'PATCH', { archived: false }));
  await read(await f.call(`/settings/teams/${target.id}/privacy`, 'PUT', { isPrivate: true }));
  await read(await f.call(`/settings/teams/${target.id}/members/${member.id}`, 'DELETE'));
  before = await stored();
  expect((await send('9322')).status).toBe(409); expect((await send('9310')).status).toBe(409); expect(await stored()).toEqual(before);
  expect((await member.call('/issues/' + first.identifier)).status).toBe(404);
  await read(await f.call(`/settings/teams/${target.id}/members/${member.id}`, 'PUT', { role: 'member' }));
  await read(await f.call(`/settings/teams/${origin.id}/members/${member.id}`, 'PUT', { role: 'member' }));
  before = await stored(); expect((await send('9323')).status).toBe(409); expect(await stored()).toEqual(before);
  await read(await f.call(`/settings/teams/${origin.id}/members/${member.id}`, 'PUT', { role: 'owner' }));
  // Receiver custodian does not inherit a rule author's private-team access.
  await read(await custodian.call('/settings/integrations/errors', 'POST', { provider: 'sentry', teamId: origin.id, regressionRule: 'reopen', token: sentry.token, secret: sentry.secret }), 201);
  before = await stored(); expect((await send('9324')).status).toBe(409); expect(await stored()).toEqual(before);
  await read(await f.call('/settings/integrations/errors', 'POST', { provider: 'sentry', teamId: origin.id, regressionRule: 'reopen', token: sentry.token, secret: sentry.secret }), 201);
  // A withdrawal between planning and batch commit rolls the whole publication back.
  const raced = beforeCommit(sql => sql.includes('INSERT INTO evidence_revisions'), async () => {
    await read(await f.call(`/settings/teams/${origin.id}/members/${member.id}`, 'PUT', { role: 'member' }));
    before = await stored();
  });
  expect((await send('9325', '1', { DB: raced })).status).toBe(503); expect(await stored()).toEqual(before);
  await save([rule]);
  // Erased source records and revoked credentials cannot create replacements.
  item = await detail(); await read(await f.call('/issues/' + first.identifier, 'DELETE', { expectedVersion: item.version, confirmed: true }));
  before = await stored(); expect((await send('9310')).status).toBe(410); expect(await stored()).toEqual(before);
  await read(await f.call(`/settings/integrations/errors/${sentry.connection.id}`, 'DELETE'));
  before = await stored(); expect((await send('9326')).status).toBe(401); expect(await stored()).toEqual(before);
  await save([]);
  expect((await env.DB.prepare('PRAGMA foreign_key_check').all()).results).toEqual([]);
}
