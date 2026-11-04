import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { inviteReader } from './role-reader-support.mjs';
import { withOperatorClient, publicRequest } from './operator-request.mjs';
import { navigate } from './collaboration-navigation.mjs';
const require = createRequire(import.meta.url);

/** Read the native document and follow its real class-fixture citations. */
export async function agentDocumentationJourney({ page, context, base, state, sql, evidence, record }) {
  const marker = 'synthetic-vector-' + Date.now();
  const api = (path, method = 'GET', data, status = 200) => withOperatorClient(context, async client => {
    const response = await client.fetch(base + path, { method, headers: { Origin: base }, ...(data === undefined ? {} : { data }) });
    assert.equal(response.status(), status, method + ' ' + path + ' ' + await response.text());
    return status === 204 ? undefined : response.json();
  });
  const { token } = await api('/api/settings/integrations/tokens', 'POST', { name: marker,
    scopes: ['metadata:read', 'issues:read', 'issues:write', 'comments:write', 'search:read', 'evidence:read'] }, 201);
  let id = 0;
  const rpc = async (method, params = {}) => {
    const response = await publicRequest(base + '/mcp', { method: 'POST', headers: { Origin: base,
      Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream',
      'MCP-Protocol-Version': '2025-11-25', 'Mcp-Method': method },
      data: { jsonrpc: '2.0', id: ++id, method, params } });
    assert.equal(response.status, 200); const answer = await response.json();
    assert.equal(answer.error, undefined, JSON.stringify(answer.error)); return answer.result;
  };
  const errors = [], consoleErrors = [], external = [];
  const docs = await context.newPage();
  docs.on('pageerror', error => errors.push(error.message));
  docs.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  await docs.route('**/*', async route => {
    if (new URL(route.request().url()).origin === base) await route.continue();
    else { external.push(route.request().url()); await route.abort(); }
  });
  const receipts = [];
  try {
    for (const disposition of ['autonomous', 'review']) {
      await api('/agents/api/policy', 'PUT', { document: { schema: 'rer-agent-policy/1', catalogue: 'rer-agent-classes/1',
        rules: [{ id: 'standard', class: '*', do: disposition }], reviewers: ['role:owner'], spend: { none: true } } });
      await docs.setViewportSize({ width: 1440, height: 1000 });
      const response = await docs.goto(base + '/docs/agents');
      assert.equal(response.status(), 200); assert.match(response.headers()['cache-control'], /no-store/);
      await docs.getByRole('heading', { name: 'Agent documentation', exact: true }).waitFor();
      const listed = (await rpc('tools/list')).tools, templates = (await rpc('resources/templates/list')).resourceTemplates;
      const discovery = await rpc('server/discover');
      assert.equal(await docs.locator('[data-specialist]').innerText(), (await readFile('agent-surface.json', 'utf8')
        .then(JSON.parse)).specialist);
      assert.deepEqual((await docs.locator('[data-tool]').evaluateAll(nodes => nodes.map(node => node.dataset.tool))).sort(), listed.map(tool => tool.name).sort());
      assert.deepEqual(await docs.locator('[data-resource]').evaluateAll(nodes => nodes.map(node => ({
        uriTemplate: node.dataset.resource, name: node.querySelector('[data-resource-name]').textContent,
      }))), templates.map(({ uriTemplate, name }) => ({ uriTemplate, name })));
      assert.deepEqual(await docs.locator('[data-capability]').evaluateAll(nodes => nodes.map(node => node.dataset.capability)), discovery._meta['com.runeditrun/capabilities'].declared);
      for (const [limit, value] of Object.entries(discovery._meta['com.runeditrun/limits']))
        assert.equal(await docs.locator(`[data-limit="${limit}"]`).innerText(), String(value));
      const citations = [];
      for (const tool of listed) {
        const article = docs.locator(`[data-tool="${tool.name}"]`);
        assert.equal(await article.locator('[data-tool-name]').innerText(), tool.name);
        assert.equal(await article.locator('[data-scope]').innerText(), tool._meta['com.runeditrun/scope']);
        assert.deepEqual(await article.locator('[data-class]').evaluateAll(nodes => nodes.map(node => node.dataset.class)), tool._meta['com.runeditrun/classes']);
        for (const proof of await article.locator('[data-class]').evaluateAll(nodes => nodes.map(node => {
          const fixture = node.querySelector('[data-fixture]'), test = node.querySelector('[data-test]');
          return { cls: node.dataset.class, fixture: fixture.dataset.fixture, step: fixture.dataset.step, fixtureUrl: fixture.href,
            test: test.dataset.test, assertion: test.dataset.assertion, testUrl: test.href };
        }))) {
          for (const [path, url] of [[proof.fixture, proof.fixtureUrl], [proof.test, proof.testUrl]]) {
            assert.ok(!path.startsWith('/') && !path.split('/').includes('..'));
            assert.equal(url, 'https://github.com/just-every/run-vector/blob/main/' + path);
            assert.ok((await readFile(path, 'utf8')).length);
          }
          const fixture = JSON.parse(await readFile(proof.fixture, 'utf8'));
          const step = fixture.journey.find(step => step.id === proof.step && step.tool === tool.name);
          assert.ok(step, 'The documented fixture really calls the offered tool');
          assert.ok(step.expect.some(item => item.class === proof.cls));
          citations.push({ ...proof, tool: tool.name, fixture, step });
        }
      }
      // Execute the cited fixtures through MCP and call the cited assertion on
      // the server's computed decisions, never on the documentation metadata.
      const fixture = citations[0].fixture, outputs = {}, observed = new Set();
      const resolveValue = value => {
        if (value && typeof value === 'object' && '$from' in value)
          return value.pointer.split('/').slice(1).reduce((current, key) => current[key], outputs[value.$from]);
        if (Array.isArray(value)) return value.map(resolveValue);
        if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, resolveValue(item)]));
        return value;
      };
      for (const step of fixture.journey) {
        const tool = listed.find(tool => tool.name === step.tool), args = resolveValue(step.args);
        if (!tool.annotations.readOnlyHint) args.idempotency_key = crypto.randomUUID();
        const answer = await rpc('tools/call', { name: step.tool, arguments: args });
        assert.equal(answer.isError, false, JSON.stringify(answer));
        const decision = answer._meta['com.runeditrun/decision'];
        assert.equal(decision.disposition, disposition);
        for (const citation of citations.filter(item => item.tool === step.tool && item.step.id === step.id)) {
          const module = await import(pathToFileURL(resolve(citation.test)).href);
          assert.equal(typeof module[citation.assertion], 'function');
          module[citation.assertion]({ add: (_name, pass, detail) => assert.ok(pass, detail) }, step, { decision }, disposition);
          observed.add(tool.name);
        }
        outputs[step.id] = answer.structuredContent;
      }
      assert.deepEqual([...observed].sort(), listed.map(tool => tool.name).sort());
      const html = await docs.content();
      for (const privateValue of [token, outputs.create.title, outputs.comment.commentId]) assert.ok(!html.includes(privateValue));
      // A plain native document has no hydration dependency. Reload and native
      // anchor navigation must preserve the complete rendered catalogue.
      assert.equal((await docs.reload()).status(), 200);
      await docs.keyboard.press('Tab'); await docs.keyboard.press('Enter');
      assert.equal(await docs.locator('main').evaluate(node => node === document.activeElement), true);
      await docs.getByRole('navigation', { name: 'Documentation', exact: true }).getByRole('link', { name: 'Resources', exact: true }).focus();
      const timeOrigin = await docs.evaluate(() => performance.timeOrigin);
      await docs.keyboard.press('Enter');
      assert.equal(new URL(docs.url()).hash, '#resources');
      assert.equal(await docs.evaluate(() => performance.timeOrigin), timeOrigin);
      if (disposition === 'autonomous') {
        const axe = await readFile(require.resolve('axe-core/axe.min.js'), 'utf8');
        for (const width of [1440, 390]) {
          await docs.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
          await docs.evaluate(source => {
            const script = document.createElement('script'); script.nonce = document.querySelector('style[nonce]').nonce;
            script.textContent = source; document.head.append(script);
          }, axe);
          assert.deepEqual(await docs.evaluate(async () => (await window.axe.run()).violations
            .filter(item => ['serious', 'critical'].includes(item.impact)).map(item => item.id)), []);
          assert.ok(await docs.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
          assert.ok(await docs.locator('main').evaluate(root => [...root.querySelectorAll('*')]
            .filter(node => [...node.childNodes].some(child => child.nodeType === Node.TEXT_NODE && child.textContent.trim()))
            .every(node => parseFloat(getComputedStyle(node).fontSize) >= 13)));
          await docs.screenshot({ path: evidence + `/agent-docs-${width}.png`, fullPage: true });
        }
      }
      receipts.push({ policy: disposition, tools: listed.length, resources: templates.length, computedTools: observed.size });
    }
    assert.deepEqual(errors, []); assert.deepEqual(consoleErrors, []); assert.deepEqual(external, []);
    const anonymous = await publicRequest(base + '/docs/agents');
    assert.equal(anonymous.status, 401); assert.ok(!(await anonymous.text()).includes('data-tool'));
    const bearer = await publicRequest(base + '/docs/agents', { headers: { Authorization: 'Bearer ' + token } });
    assert.equal(bearer.status, 401);
    const reader = await inviteReader({ owner: page, browser: context.browser(), runtime: { base, state, sql },
      name: marker, email: [marker, 'vector.test'].join(String.fromCharCode(64)), role: 'member' });
    try {
      assert.equal((await reader.context.request.get(base + '/docs/agents')).status(), 200);
      assert.equal((await reader.context.request.post(base + '/auth/signout', { headers: { Origin: base }, data: {} })).status(), 204);
      const revoked = await reader.context.request.get(base + '/docs/agents');
      assert.equal(revoked.status(), 401); assert.ok(!(await revoked.text()).includes('data-tool'));
      assert.equal((await api('/api/session')).role, 'owner');
    } finally { await reader.context.close(); }
    await writeFile(evidence + '/agent-docs.json', JSON.stringify({ passed: true, receipts, signedOutRefused: true, currentSessionRequired: true }, null, 2));
    record('BASE-AGENT-013', 'Native signed-in docs match live tool and resource names, scopes and classes under both policies; cited fixtures compute each offered class; keyboard, reload, access refusal and both viewport checks pass.');
  } finally { await docs.close(); await navigate(page, base + '/'); }
}
