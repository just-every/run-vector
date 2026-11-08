import { env } from 'cloudflare:workers';
import { expect, it } from 'vitest';
import { agentRequest, agentToolClient } from './agent-resource-journey';
import { origin } from './base-auth-fixture';
import { roleWorkspace, snapshot, resetLimits } from './role-fixture';

async function json(response: Response, status = 200): Promise<any> {
  expect(response.status, await response.clone().text()).toBe(status);
  return response.json();
}

it('native title events commit atomically and replay through mounted MCP with current authority', async () => {
  const w = await roleWorkspace(), owner = w.people.owner, member = w.member;
  const team = (await json(await owner.call('/settings/teams', 'POST', {
    name: 'synthetic-vector-3701', identifierPrefix: 'EVNT', isPrivate: true,
  }))).teams.find((t: any) => t.name === 'synthetic-vector-3701');
  await json(await owner.call(`/settings/teams/${team.id}/members/${member.id}`, 'PUT', { role: 'member' }));
  const issue = await json(await member.call('/issues', 'POST', { teamId: team.id, title: 'synthetic-vector-3702' }), 201);
  const person = (await json(await member.call('/options'))).operators.find((p: any) => p.id === member.id);
  // This native author is suspended and then erased before the first agent admission.
  // Its private record remains readable by the Owner, never by the main reader.
  const formerTeam = (await json(await owner.call('/settings/teams', 'POST', {
    name: 'synthetic-vector-3719', identifierPrefix: 'FORMER', isPrivate: true,
  }))).teams.find((t: any) => t.name === 'synthetic-vector-3719');
  await json(await owner.call(`/settings/teams/${formerTeam.id}/members/${w.lead.id}`, 'PUT', { role: 'member' }));
  const departed = await json(await w.lead.call('/issues', 'POST', { teamId: formerTeam.id, title: 'synthetic-vector-3720' }), 201);
  const departedPerson = (await json(await w.lead.call('/options'))).operators.find((p: any) => p.id === w.lead.id);
  await json(await w.lead.call('/issues/' + departed.identifier, 'PATCH', { expectedVersion: 1, title: 'synthetic-vector-3721' }));
  const beforeRemoval = JSON.parse((await env.DB.prepare('SELECT event FROM agent_door_events WHERE uri=?')
    .bind('vector://issue/' + departed.id).first<string>('event'))!);
  expect(beforeRemoval.actor.person).toEqual({ id: w.lead.id, name: departedPerson.name });
  const removalTables = ['operators', 'operator_removals', 'member_lifecycle_events', 'oa_operators', 'oa_sessions', 'agent_door_events'];
  const removalBefore = await snapshot(removalTables);
  await env.DB.exec("CREATE TRIGGER synthetic_vector_removal_failure BEFORE INSERT ON audit_records WHEN NEW.action='operator.suspended' BEGIN SELECT RAISE(ABORT,'synthetic-vector-3723'); END");
  try {
    expect((await owner.call('/settings/operators/' + w.lead.id, 'DELETE')).status).toBe(500);
    expect(await snapshot(removalTables)).toEqual(removalBefore);
  } finally { await env.DB.exec('DROP TRIGGER synthetic_vector_removal_failure'); }
  await json(await owner.call('/settings/operators/' + w.lead.id, 'DELETE'));
  expect((await w.lead.call('/issues/' + departed.identifier)).status).toBe(401);
  expect(JSON.parse((await env.DB.prepare('SELECT event FROM agent_door_events WHERE id=?')
    .bind(beforeRemoval.id).first<string>('event'))!)).toEqual(beforeRemoval);
  const subject = { names: [departedPerson.name] };
  const erasure = await json(await owner.call('/data/erasure/preview', 'POST', subject));
  await json(await owner.call('/data/erasure', 'POST', { subject, confirmation: erasure.confirmation }));
  const control = (path: string, method: string, body: unknown) => agentRequest('/agents/api/' + path, {
    method, headers: { Origin: origin, Cookie: owner.cookie, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  const policy = async (disposition: string) => json(await control('policy', 'PUT', { document: {
    schema: 'rer-agent-policy/1', catalogue: 'rer-agent-classes/1', reviewers: ['person:' + owner.id],
    rules: [{ id: 'standard', class: 'standard', do: disposition }, { id: 'rest', class: '*', do: 'blocked' }], spend: { none: true },
  } }));
  await policy('autonomous');
  const ownerGrant = await json(await owner.call('/settings/integrations/tokens', 'POST', {
    name: 'synthetic-vector-3722', scopes: ['events:read', 'evidence:read'],
  }), 201);
  const ownerEvents = await agentToolClient(ownerGrant.token)('vector.events.list', {});
  expect(ownerEvents.status).toBe(200);
  const afterRemoval = ownerEvents.body.result.structuredContent.events.find((e: any) => e.id === beforeRemoval.id);
  expect(afterRemoval).toEqual({ ...beforeRemoval, actor: { kind: 'person', person: { id: w.lead.id, name: 'Removed operator' } } });
  expect(JSON.stringify(afterRemoval)).not.toContain(departedPerson.name);
  const held = await json(await owner.call('/data/erasure/preview', 'POST', subject), 409);
  expect(held.error).toBe('agent_custody_unavailable');

  const grant = async (scopes: string[], n: number) => json(await member.call('/settings/integrations/tokens', 'POST', {
    name: 'synthetic-vector-' + n, scopes,
  }), 201);
  const reader = await grant(['events:read', 'evidence:read'], 3703);
  const writer = await grant(['issues:write'], 3704);
  const write = agentToolClient(writer.token);
  // A fresh client and mounted runtime are constructed on every call, including
  // replay. Only D1, never process-local cursor state, retains the sequence.
  const list = async (args: object = {}, token = reader.token) => {
    const reply = await agentToolClient(token)('vector.events.list', args);
    expect(reply.status).toBe(200);
    expect(reply.body.error).toBeUndefined();
    expect(reply.body.result.isError).not.toBe(true);
    return reply.body.result.structuredContent;
  };
  const initial = await list();
  expect(initial.events).toEqual([]);
  const path = '/issues/' + issue.identifier;
  const titleEvents = () => env.DB.prepare('SELECT event FROM agent_door_events WHERE uri=? ORDER BY sequence')
    .bind('vector://issue/' + issue.id).all<{ event: string }>();
  await json(await member.call(path, 'PATCH', { expectedVersion: 1, title: 'synthetic-vector-3705' }));
  const first = (await list({ limit: 1 })).events[0];
  expect(first).toEqual({ id: expect.any(String), type: 'issue.updated', uri: 'vector://issue/' + issue.id,
    actor: { kind: 'person', person: { id: member.id, name: person.name } }, at: expect.any(String) });
  expect(Number.isFinite(Date.parse(first.at))).toBe(true);
  const activity = await env.DB.prepare("SELECT id,created_at FROM issue_activity WHERE issue_id=? AND kind='issue.updated'")
    .bind(issue.id).first<{ id: string; created_at: string }>();
  expect(first.id).toBe(activity!.id); expect(first.at).toBe(activity!.created_at);
  const stable = await snapshot(['issues', 'issue_activity', 'agent_door_events']);
  await json(await member.call(path, 'PATCH', { expectedVersion: 2, title: 'synthetic-vector-3705' }));
  await json(await member.call(path, 'PATCH', { expectedVersion: 1, title: 'synthetic-vector-3706' }), 409);
  await json(await w.guest.call(path, 'PATCH', { expectedVersion: 2, title: 'synthetic-vector-3706' }), 404);
  expect(await snapshot(['issues', 'issue_activity', 'agent_door_events'])).toEqual(stable);
  const expected = [first];
  for (const [index, disposition] of ['autonomous', 'review'].entries()) {
    await policy(disposition);
    const args = { identifier: issue.identifier, change: { expectedVersion: index + 2, title: 'synthetic-vector-' + (3707 + index) }, idempotency_key: crypto.randomUUID() };
    const result = await write('vector.issue.concurrent_edits', args);
    expect(result.status).toBe(200); expect(result.body.result.isError).not.toBe(true);
    const event = (await list({ after: expected.at(-1)!.id, limit: 1 })).events[0];
    expect(event).toEqual({ id: expect.any(String), type: 'issue.updated', uri: first.uri,
      actor: { kind: 'agent', agent: { id: expect.any(String), name: 'synthetic-vector-3704' },
        for: { id: member.id, name: person.name }, label: 'synthetic-vector-3704 for ' + person.name }, at: expect.any(String) });
    expected.push(event);
    const before = await snapshot(['issues', 'issue_activity', 'agent_door_events']);
    await write('vector.issue.concurrent_edits', args);
    expect(await snapshot(['issues', 'issue_activity', 'agent_door_events'])).toEqual(before);
  }
  const unchangedEdits = await snapshot(['issues', 'issue_activity', 'agent_door_events']);
  const noop = await write('vector.issue.concurrent_edits', { identifier: issue.identifier,
    change: { expectedVersion: 4, title: 'synthetic-vector-3708' }, idempotency_key: crypto.randomUUID() });
  expect(noop.body.result.isError).not.toBe(true);
  const stale = await write('vector.issue.concurrent_edits', { identifier: issue.identifier,
    change: { expectedVersion: 1, title: 'synthetic-vector-3715' }, idempotency_key: crypto.randomUUID() });
  expect(stale.body.result._meta['com.runeditrun/error'].code).toBe('revision_conflict');
  expect(await snapshot(['issues', 'issue_activity', 'agent_door_events'])).toEqual(unchangedEdits);
  expect((await titleEvents()).results.map(r => JSON.parse(r.event))).toEqual(expected);
  // Replay the same two-page traversal from the same cursor in a new client.
  for (let restart = 0; restart < 2; restart++) {
    const page1 = await list({ after: first.id, limit: 1 });
    expect(page1.events).toEqual([expected[1]]); expect(page1.cursor).toBe(expected[1].id);
    const page2 = await list({ after: page1.cursor, limit: 1 });
    expect(page2.events).toEqual([expected[2]]); expect(page2.cursor).toBe(expected[2].id);
    expect((await list({ after: page2.cursor })).events).toEqual([]);
  }
  // A failed event INSERT aborts the native title, activity and all side effects.
  await env.DB.exec("CREATE TRIGGER synthetic_vector_event_failure BEFORE INSERT ON agent_door_events WHEN NEW.uri='" + first.uri + "' BEGIN SELECT RAISE(ABORT,'synthetic-vector-3709'); END");
  const tables = ['issues', 'issue_activity', 'issue_followers', 'notifications', 'agent_door_events'];
  const beforeFailure = await snapshot(tables);
  try {
    expect((await member.call(path, 'PATCH', { expectedVersion: 4, title: 'synthetic-vector-3710' })).status).toBe(500);
    expect(await snapshot(tables)).toEqual(beforeFailure);
    const failed = await write('vector.issue.concurrent_edits', { identifier: issue.identifier, change: { expectedVersion: 4, title: 'synthetic-vector-3710' }, idempotency_key: crypto.randomUUID() });
    expect(failed.status).toBe(500); expect(failed.body.error.data.code).toBe('execution_failed');
    expect(await snapshot(tables)).toEqual(beforeFailure);
  } finally { await env.DB.exec('DROP TRIGGER synthetic_vector_event_failure'); }
  expect((await json(await member.call(path))).title).toBe('synthetic-vector-3708');
  // Without either read scope, no record event is disclosed; old grants widen by
  // no automatic migration when the separate events scope becomes available.
  const noEvents = await grant(['evidence:read'], 3711), noEvidence = await grant(['events:read'], 3712);
  const insufficient = await agentToolClient(noEvents.token)('vector.events.list', {});
  expect(insufficient.status).toBe(403); expect(insufficient.body.error.data.code).toBe('insufficient_scope');
  expect((await list({}, noEvidence.token)).events).toEqual([]);
  const scopeBaseline = await snapshot(tables);
  const readCannotWrite = await agentToolClient(reader.token)('vector.issue.concurrent_edits', {
    identifier: issue.identifier, change: { expectedVersion: 4, title: 'synthetic-vector-3718' }, idempotency_key: crypto.randomUUID(),
  });
  expect(readCannotWrite.status).toBe(403);
  expect(readCannotWrite.body.error.data.code).toBe('insufficient_scope');
  // Settings has no narrowing form; change only the persisted grant, then use
  // the mounted door to verify that a previously usable reader loses admission.
  await env.DB.prepare('UPDATE integration_tokens SET scopes=? WHERE id=?')
    .bind(JSON.stringify(['evidence:read']), reader.credential.id).run();
  const narrowed = await agentToolClient(reader.token)('vector.events.list', { after: first.id });
  expect(narrowed.status).toBe(403); expect(narrowed.body.error.data.code).toBe('insufficient_scope');
  expect(await snapshot(tables)).toEqual(scopeBaseline);
  await env.DB.prepare('UPDATE integration_tokens SET scopes=? WHERE id=?')
    .bind(JSON.stringify(['events:read', 'evidence:read']), reader.credential.id).run();
  expect((await list({ after: first.id })).events).toEqual(expected.slice(1));
  await json(await owner.call(`/settings/teams/${team.id}/members/${member.id}`, 'DELETE'));
  const withdrawn = await snapshot(tables);
  const hidden = await list({ after: first.id }); expect(hidden.events).toEqual([]);
  expect(JSON.stringify(hidden)).not.toContain(issue.id);
  expect((await member.call(path)).status).toBe(404);
  const refused = await write('vector.issue.concurrent_edits', { identifier: issue.identifier,
    change: { expectedVersion: 4, title: 'synthetic-vector-3716' }, idempotency_key: crypto.randomUUID() });
  expect(refused.body.result._meta['com.runeditrun/error'].code).toBe('not_found');
  expect(await snapshot(tables)).toEqual(withdrawn);
  await json(await owner.call(`/settings/teams/${team.id}/members/${member.id}`, 'PUT', { role: 'member' }));
  expect((await list({ after: first.id })).events).toEqual(expected.slice(1));
  await json(await control('pause', 'POST', { paused: true }));
  const paused = await agentToolClient(reader.token)('vector.events.list', {});
  expect(paused.body.result._meta['com.runeditrun/error'].code).toBe('agents_paused');
  const pausedEdit = await write('vector.issue.concurrent_edits', { identifier: issue.identifier,
    change: { expectedVersion: 4, title: 'synthetic-vector-3717' }, idempotency_key: crypto.randomUUID() });
  expect(pausedEdit.body.result._meta['com.runeditrun/error'].code).toBe('agents_paused');
  expect(await snapshot(tables)).toEqual(withdrawn);
  await json(await control('pause', 'POST', { paused: false }));
  expect((await list({ after: first.id })).events).toEqual(expected.slice(1));
  await json(await member.call('/settings/integrations/tokens/' + reader.credential.id, 'DELETE'));
  expect((await agentToolClient(reader.token)('vector.events.list', {})).status).toBe(401);
  expect(await snapshot(tables)).toEqual(withdrawn);
  // Owner deletion removes the resource from retained event projection.
  await resetLimits();
  await json(await owner.call(path, 'DELETE', { expectedVersion: 4, confirmed: true }));
  const erased = await snapshot(tables);
  const fresh = await grant(['events:read', 'evidence:read'], 3713);
  expect((await list({}, fresh.token)).events).toEqual([]);
  const replay = await write('vector.issue.concurrent_edits', { identifier: issue.identifier, change: { expectedVersion: 4, title: 'synthetic-vector-3714' }, idempotency_key: crypto.randomUUID() });
  expect(replay.body.result.isError).toBe(true);
  expect(await snapshot(tables)).toEqual(erased);

});
