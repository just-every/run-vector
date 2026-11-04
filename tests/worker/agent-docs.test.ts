import { expect, it } from 'vitest';
import surface from '../../agent-surface.json';
import { setupAdministration } from './administration-fixture';
import { agentRequest } from './agent-resource-journey';
import { snapshot } from './role-fixture';
import { origin } from './base-auth-fixture';
// @ts-expect-error The pinned conformance assertion is native ESM.
import { checkClasses } from '../../vendor/base/agent-door/conformance/journey.mjs';

it('signed-in agent documentation matches offered actions and their computed class fixtures under both policies; current session refusal exposes nothing', async () => {
  const owner = await setupAdministration();
  const send = (path: string, method = 'GET', body?: unknown, cookie = owner.cookie, extra: HeadersInit = {}) =>
    agentRequest(path, { method, headers: { Origin: origin, Cookie: cookie, 'Content-Type': 'application/json', ...extra },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const json = async (response: Response, status = 200) => {
    expect(response.status, await response.clone().text()).toBe(status);
    return response.json() as Promise<any>;
  };
  const { token } = await json(await owner.call('/settings/integrations/tokens', 'POST', {
    name: 'synthetic-vector-3501', scopes: ['metadata:read', 'issues:read', 'issues:write', 'comments:write', 'search:read', 'evidence:read'],
  }), 201);
  const narrow = await json(await owner.call('/settings/integrations/tokens', 'POST', { name: 'synthetic-vector-3502', scopes: ['issues:read'] }), 201);
  let id = 0;
  const rpc = async (method: string, params = {}) => json(await send('/mcp', 'POST', { jsonrpc: '2.0', id: ++id, method, params }, '', {
    Authorization: 'Bearer ' + token, Accept: 'application/json, text/event-stream',
    'MCP-Protocol-Version': '2025-11-25', 'Mcp-Method': method,
  }));
  for (const disposition of ['autonomous', 'review']) {
    await json(await send('/agents/api/policy', 'PUT', { document: {
      schema: 'rer-agent-policy/1', catalogue: 'rer-agent-classes/1',
      rules: [{ id: 'standard', class: '*', do: disposition }], reviewers: ['role:owner'], spend: { none: true },
    } }));
    const domain = await snapshot(['issues', 'issue_comments', 'issue_activity']);
    const denied = await send('/mcp', 'POST', { jsonrpc: '2.0', id: ++id, method: 'tools/call', params: { name: 'vector.search.global_search', arguments: { query: 'synthetic' } } }, '', {
      Authorization: 'Bearer ' + narrow.token, Accept: 'application/json, text/event-stream', 'MCP-Protocol-Version': '2025-11-25', 'Mcp-Method': 'tools/call',
    });
    expect(denied.status).toBe(403);
    expect(denied.headers.get('www-authenticate')).toContain('search:read');
    expect(await snapshot(['issues', 'issue_comments', 'issue_activity'])).toEqual(domain);
    const response = await send('/docs/agents');
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toContain('no-store');
    expect(response.headers.get('Vary')).toContain('Cookie');
    const html = await response.text();
    const listed = (await rpc('tools/list')).result.tools;
    const templates = (await rpc('resources/templates/list')).result.resourceTemplates;
    const articles = [...html.matchAll(/<article data-tool="([^"]+)">([\s\S]*?)<\/article>/g)];
    expect(articles.map(match => match[1]).sort()).toEqual(listed.map((tool: any) => tool.name).sort());
    expect([...html.matchAll(/data-resource="([^"]+)"/g)].map(match => match[1])).toEqual(templates.map((resource: any) => resource.uriTemplate));
    const outputs: Record<string, any> = {}, observed = new Set<string>();
    const resolve = (value: any): any => {
      if (value && typeof value === 'object' && '$from' in value)
        return value.pointer.split('/').slice(1).reduce((current: any, key: string) => current[key], outputs[value.$from]);
      if (Array.isArray(value)) return value.map(resolve);
      if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, resolve(item)]));
      return value;
    };
    for (const step of surface.journey) {
      const tool = listed.find((tool: any) => tool.name === step.tool);
      expect(tool).toBeDefined();
      const args = resolve(step.args);
      if (!tool.annotations.readOnlyHint) args.idempotency_key = crypto.randomUUID();
      const answer = (await rpc('tools/call', { name: step.tool, arguments: args })).result;
      expect(answer.isError, JSON.stringify(answer)).toBe(false);
      const decision = answer._meta['com.runeditrun/decision'];
      expect(decision.disposition).toBe(disposition);
      checkClasses({ add: (_name: string, pass: boolean, detail: string) => expect(pass, detail).toBe(true) }, step, { decision }, disposition);
      outputs[step.id] = answer.structuredContent;
      const article = articles.find(match => match[1] === step.tool)![2];
      expect(article).toContain('data-scope>' + tool._meta['com.runeditrun/scope']);
      expect([...article.matchAll(/data-class="([^"]+)"/g)].map(match => match[1])).toEqual(tool._meta['com.runeditrun/classes']);
      const proof = /data-fixture="([^"]+)" data-step="([^"]+)"/.exec(article)!;
      expect(proof[1]).toBe('agent-surface.json');
      expect(surface.journey.some(fixture => fixture.id === proof[2] && fixture.tool === step.tool)).toBe(true);
      expect(article).toContain('data-assertion="checkClasses"');
      observed.add(step.tool);
    }
    expect([...observed].sort()).toEqual(listed.map((tool: any) => tool.name).sort());
    const discovery = (await rpc('server/discover')).result;
    for (const [name, value] of Object.entries(discovery._meta['com.runeditrun/limits']))
      expect(html).toContain(`data-limit="${name}">${value}`);
    expect(html).toContain(surface.specialist);
    expect([...html.matchAll(/data-capability="([^"]+)"/g)].map(match => match[1])).toEqual(discovery._meta['com.runeditrun/capabilities'].declared);
    for (const privateValue of [owner.cookie, token, outputs.create.title, outputs.comment.commentId, owner.owner])
      expect(html).not.toContain(privateValue);
  }
  const tables = ['issues', 'issue_comments', 'issue_activity', 'agent_door_state', 'agent_door_audit'];
  const before = await snapshot(tables);
  for (const response of [await send('/docs/agents', 'GET', undefined, ''),
    await send('/docs/agents', 'GET', undefined, '', { Authorization: 'Bearer ' + token }),
    await send('/docs/agents', 'GET', undefined, owner.cookie, { Origin: 'https://outside.invalid' })]) {
    expect([401, 403]).toContain(response.status);
    expect(await response.text()).not.toContain('data-tool');
  }
  expect((await send('/docs/agents', 'POST', {})).status).toBe(405);
  const head = await send('/docs/agents', 'HEAD');
  expect(head.status).toBe(200); expect(await head.text()).toBe('');
  expect(await snapshot(tables)).toEqual(before);
  expect((await send('/auth/signout', 'POST', {})).status).toBe(204);
  const revoked = await send('/docs/agents');
  expect(revoked.status).toBe(401); expect(await revoked.text()).not.toContain('data-tool');
});
