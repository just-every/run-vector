import { expect, it } from 'vitest';
import { env } from 'cloudflare:workers';
import { setupAdministration } from './administration-fixture';
import { agentRequest } from './agent-resource-journey';
import { origin } from './base-auth-fixture';
import { snapshot } from './role-fixture';

const method = (family: string, verb: string) => [family, verb].join('/');
const promptGet = method('prompts', 'get'), promptList = method('prompts', 'list');
const toolsList = method('tools', 'list'), discoverMethod = method('server', 'discover');
const jsonType = ['application', 'json'].join('/');

it('native issue-triage guidance is discoverable, inert and governed by current MCP admission', async () => {
  const f = await setupAdministration();
  const issue = await f.create({ title: 'synthetic-vector-3501', description: 'synthetic-vector-3502' });
  expect((await f.call(`/issues/${issue.identifier}/comments`, 'POST', { body: 'synthetic-vector-3503' })).status).toBe(201);
  const issued = await f.call('/settings/integrations/tokens', 'POST', {
    name: 'synthetic-vector-3504', scopes: ['metadata:read', 'issues:read', 'issues:write'],
  });
  expect(issued.status).toBe(201);
  const credential = await issued.json() as { token: string; credential: { id: string } };
  let id = 0;
  const rpc = async (method: string, params: Record<string, unknown> = {}, version = '2026-07-28', token: string | null = credential.token, extra: Record<string, string> = {}) => {
    const modern = version === '2026-07-28';
    const response = await agentRequest('/mcp', {
      method: 'POST', headers: {
        Origin: origin, 'Content-Type': jsonType, Accept: jsonType + ', ' + ['text', 'event-stream'].join('/'),
        'MCP-Protocol-Version': version, 'Mcp-Method': method,
        ...(method === promptGet ? { 'Mcp-Name': String(params.name ?? '') } : {}),
        ...(token === null ? {} : { Authorization: 'Bearer ' + token }), ...extra,
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: ++id, method, params: {
        ...params, ...(modern ? { _meta: { 'io.modelcontextprotocol/protocolVersion': version } } : {}),
      } }),
    });
    return { status: response.status, body: await response.json() as any };
  };
  const ownerDoor = async (path: string, method: string, body: unknown) => {
    const response = await agentRequest('/agents/api/' + path, {
      method, headers: { Origin: origin, Cookie: f.cookie, 'Content-Type': jsonType }, body: JSON.stringify(body),
    });
    expect(response.status, await response.clone().text()).toBe(200);
  };
  const policy = async (disposition: 'autonomous' | 'review' | 'blocked') => ownerDoor('policy', 'PUT', {
    document: { schema: 'rer-agent-policy/1', catalogue: 'rer-agent-classes/1',
      rules: [{ id: 'standard', class: 'standard', do: disposition }],
      ...(disposition === 'review' ? { reviewers: ['person:' + f.owner] } : {}), spend: { none: true } },
  });
  // Populated business state and execution custody must survive every read and refusal.
  const domain = ['issues', 'issue_comments', 'issue_activity', 'issue_followers', 'notifications', 'audit_records',
    'agent_door_audit', 'agent_door_approvals', 'agent_door_reviews', 'agent_door_calls', 'agent_door_events', 'agent_door_usage'];
  const before = await snapshot(domain);
  const get = (params: Record<string, unknown> = { name: 'vector.issue.triage' }) => rpc(promptGet, params);
  const unset = await get();
  expect(unset.body.error.data.code).toBe('policy_unset');
  expect(unset.body.result).toBeUndefined();
  expect((await rpc(promptList)).body.result.prompts).toEqual([]);

  let modernListing: unknown;
  for (const disposition of ['autonomous', 'review'] as const) {
    await policy(disposition);
    for (const version of ['2026-07-28', '2025-11-25']) {
      // Modern discovery and listing work before any initialize request.
      const discovery = await rpc(discoverMethod, {}, version, null);
      expect(discovery.status).toBe(200);
      expect(discovery.body.result.supportedVersions).toEqual(expect.arrayContaining(['2026-07-28', '2025-11-25']));
      expect(discovery.body.result.capabilities.prompts).toEqual({ listChanged: false });
      expect(discovery.body.result._meta['io.modelcontextprotocol/serverInfo'].name).toBeTruthy();
      expect(discovery.body.result.instructions).toMatch(/specialist/);
      for (const unsupported of ['roots', 'sampling', 'logging'])
        expect(discovery.body.result.capabilities[unsupported]).toBeUndefined();
      if (version === '2025-11-25') {
        const initialized = await rpc('initialize', { protocolVersion: version, capabilities: {}, clientInfo: { name: 'synthetic-vector-3505', version: '1' } }, version, null);
        expect(initialized.body.result).toMatchObject({ protocolVersion: version, capabilities: discovery.body.result.capabilities, instructions: discovery.body.result.instructions });
      }
      const first = await rpc(promptList, {}, version), second = await rpc(promptList, {}, version);
      expect(first.status).toBe(200);
      expect(first.body.result).toEqual(second.body.result);
      expect(first.body.result).toMatchObject({ cacheScope: 'private', ttlMs: expect.any(Number) });
      expect(first.body.result.ttlMs).toBeGreaterThanOrEqual(0);
      expect(first.body.result.prompts).toHaveLength(1);
      if (modernListing === undefined) modernListing = first.body.result;
      expect(first.body.result).toEqual(modernListing);
      const prompt = first.body.result.prompts[0];
      expect(prompt.messages).toBeUndefined();
      const retrieved = await rpc(promptGet, { name: prompt.name }, version);
      expect(retrieved.status).toBe(200);
      expect(retrieved.body.error).toBeUndefined();
      expect(retrieved.body.result).toMatchObject({ cacheScope: 'private', ttlMs: expect.any(Number) });
      expect(retrieved.body.result.messages.length).toBeGreaterThan(0);
      const tools = await rpc(toolsList, {}, version);
      const names = tools.body.result.tools.map((tool: { name: string }) => tool.name);
      for (const message of retrieved.body.result.messages) {
        expect(message.role).toBe('user');
        expect(message.content.type).toBe('text');
        expect(message.content.text.length).toBeGreaterThan(0);
        const references = message.content.text.match(/vector\.[a-z_]+\.[a-z_]+/g);
        expect(references?.length).toBeGreaterThan(0);
        for (const reference of references) expect(names).toContain(reference);
        expect(message.content.text).not.toContain('synthetic-vector-3502');
      }
      // Arbitrary caller text is not substituted into instructions or executed.
      const supplied = await rpc(promptGet, { name: prompt.name, arguments: { issue: issue.identifier, instruction: 'synthetic-vector-3506' } }, version);
      expect(supplied.body.result).toEqual(retrieved.body.result);
    }
  }
  for (const params of [{ name: 'synthetic-vector-3507' }, ...[null, [], 'synthetic-vector-3508', { issue: 1 }, { issue: {} }].map(arguments_ => ({ name: 'vector.issue.triage', arguments: arguments_ }))]) {
    const invalid = await get(params);
    expect(invalid.body.error.code).toBe(-32602);
    expect(invalid.body.result).toBeUndefined();
  }
  const mismatch = await rpc(promptGet, { name: 'vector.issue.triage' }, '2026-07-28', credential.token, { 'Mcp-Name': 'synthetic-vector-3509' });
  expect(mismatch.status).toBe(400);
  expect(mismatch.body.error.message).toBe('HeaderMismatch');
  for (const token of [null, 'synthetic-vector-3510']) {
    for (const method of [promptList, promptGet]) {
      const absent = await rpc(method, { name: 'vector.issue.triage' }, '2026-07-28', token);
      expect(absent.status).toBe(401);
      expect(absent.body.result).toBeUndefined();
    }
  }
  await policy('blocked');
  const blocked = await get();
  expect(blocked.body.error.data.code).toBe('policy_blocked');
  expect(blocked.body.result).toBeUndefined();
  await policy('autonomous');
  await ownerDoor('pause', 'POST', { paused: true });
  const paused = await get();
  expect(paused.body.error.data.code).toBe('agents_paused');
  expect(paused.body.result).toBeUndefined();
  expect((await rpc(promptList)).body.result.prompts).toEqual([]);
  await ownerDoor('pause', 'POST', { paused: false });
  expect((await get()).body.result.messages.length).toBeGreaterThan(0);
  expect(await snapshot(domain)).toEqual(before);
  expect((await f.call('/settings/integrations/tokens/' + credential.credential.id, 'DELETE')).status).toBe(200);
  const afterRevocation = await snapshot(domain);
  for (const method of [promptList, promptGet]) {
    const revoked = await rpc(method, { name: 'vector.issue.triage' });
    expect(revoked.status).toBe(401);
    expect(revoked.body.result).toBeUndefined();
  }
  expect(await snapshot(domain)).toEqual(afterRevocation);
  expect((await env.DB.prepare('SELECT count(*) n FROM issues').first<number>('n'))).toBeGreaterThan(0);
});
