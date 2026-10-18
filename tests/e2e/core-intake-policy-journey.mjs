import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createWebhookProtocol } from '../../vendor/base/integrations/core/webhook.ts';
import { beforePrivateNavigation } from './collaboration-navigation.mjs';

export async function intakePolicyJourney(page, context, base, capture = async () => {}) {
  const api = async (path, method = 'GET', data) => {
    const response = await context.request.fetch(base + '/api' + path, { method, headers: { Origin: base }, ...(data === undefined ? {} : { data }) });
    assert(response.ok(), `${method} ${path}: ${response.status()} ${await response.text()}`);
    return response.json();
  };
  const options = await api('/options'), team = options.teams[0], me = options.operator.id;
  const started = options.statuses.find(s => s.teamId === team.id && s.category === 'started');
  const unstarted = options.statuses.filter(s => s.teamId === team.id && s.category === 'unstarted').sort((a,b) => a.position - b.position)[0];
  const source = await api('/settings/integrations/sources', 'POST', { name: 'Payment monitoring', sourceId: 'payment-policy-' + Date.now(), teamId: team.id });
  const key = new Uint8Array(source.secret.match(/../g).map(pair => parseInt(pair,16)));
  const protocol = createWebhookProtocol({ resolveDestination: async () => source.receiver, signingKey: async () => key });
  try {
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      for (const explicit of [true, false]) {
        const body = JSON.stringify({ title: explicit ? 'Investigate payment confirmation delays' : 'Review settlement retry evidence', teamId: team.id,
          sourceRecordId: randomUUID(), sourceRevisionId: 'first', observedAt: new Date().toISOString(),
          ...(explicit ? { assertions: { assigneeOperatorId: { value: me, attribution: 'source' } } } : {}),
        });
        const wire = await protocol.prepare({ id: randomUUID(), tenant: source.workspaceId, destinationId: source.sourceId, event: 'signal.revision', protocol: 'webhook', body }, Date.now());
        const response = await context.request.post(source.receiver, { headers: wire.headers, data: wire.body });
        assert.equal(response.status(), 200);
        const { identifier } = await response.json();
        await beforePrivateNavigation(page, base + '/app/issues/' + identifier);
        await page.goto(base + '/app/issues/' + identifier);
        const panel = page.locator('.decision-panel');
        await panel.waitFor({state:'visible'});
        if (width === 390) await panel.getByRole('button', {name:'Adjust routing and reason',exact:true}).click();
        const assignee = panel.getByLabel('Assignee', {exact:true});
        await page.waitForFunction(({identifier, expected}) => {
          const panel = document.querySelector('.decision-panel');
          const input = panel?.querySelector('[aria-label="Assignee"]');
          return input && !input.matches(':disabled') && input.value === expected;
        }, {identifier, expected:explicit ? me : ''});
        assert.equal(await assignee.inputValue(), explicit ? me : '');
        assert.equal(await panel.getByLabel('Priority', {exact:true}).inputValue(), 'none');
        assert.equal(await panel.getByLabel('Start status', {exact:true}).inputValue(), unstarted.id);
        const before = await api('/issues/' + identifier);
        assert.equal(before.assignee, null); assert.equal(before.status.category, 'intake');
        await capture('INTAKE-010', `${explicit ? 'explicit' : 'default'}-routing-${width}`, page);
        await assignee.selectOption(explicit ? '' : me);
        await panel.getByLabel('Priority', {exact:true}).selectOption('high');
        await panel.getByLabel('Start status', {exact:true}).selectOption(started.id);
        const accepted = page.waitForResponse(r => r.url() === base + '/api/issues/' + identifier + '/accept' && r.request().method() === 'POST');
        await panel.getByRole('button', {name:'Accept and route work',exact:true}).click();
        assert.equal((await accepted).status(), 200);
        await panel.waitFor({state:'detached'});
        const issue = await api('/issues/' + identifier);
        assert.equal(issue.assignee?.id ?? null, explicit ? null : me);
        assert.equal(issue.priority, 'high'); assert.equal(issue.status.id, started.id);
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        await capture('INTAKE-010', `${explicit ? 'explicit' : 'default'}-accepted-${width}`, page);
      }
    }
  } finally { await api('/settings/integrations/sources/' + source.id, 'DELETE'); }
}
