import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { resolve } from 'node:path';
import { expect } from '@playwright/test';
import { freePort } from '@runeditrun/rer/adapter-settings';
import { createAdminRuntime, bootstrapOwner } from './admin-runtime-support.mjs';
import { navigate, settleReads } from './collaboration-navigation.mjs';
import { roleScreens } from './role-ui-support.mjs';

/** A signed Sentry delivery reaches the same inspector in issue detail and Current. */
export async function triageRoutingJourney({ browser, clause, evidence }) {
  // Use the existing real provider protocol edge in a separate installation so
  // routing fixtures cannot change the administration journey's team or Current.
  const previousEdge = process.env.VECTOR_CHANNEL_EDGE;
  process.env.VECTOR_CHANNEL_EDGE = resolve(evidence, 'routing-provider-edge.jsonl');
  const runtime = createAdminRuntime(1440, [], { port: await freePort(), inspectorPort: 0 });
  if (previousEdge === undefined) delete process.env.VECTOR_CHANNEL_EDGE;
  else process.env.VECTOR_CHANNEL_EDGE = previousEdge;
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage(), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const send = async (path, method = 'GET', data, status = 200) => {
    const response = await page.request.fetch(runtime.base + '/api' + path, {
      method, headers: { Origin: runtime.base }, ...(data === undefined ? {} : { data }),
    });
    assert.equal(response.status(), status, await response.text());
    return response.json();
  };
  try {
    runtime.initialize();
    await runtime.start();
    await bootstrapOwner(page, runtime);
    await clause('TRIAGE-002', 'saved acting rule and revision remain visible in issue detail and Current', async () => {
      const initial = await send('/settings/administration');
      const origin = initial.teams[0];
      const target = (await send('/settings/teams', 'POST', {
        name: 'Routed incidents', identifierPrefix: 'ROUTE',
      })).teams.find(team => team.name === 'Routed incidents');
      const secret = 'synthetic-vector-8202';
      const connection = await send('/settings/integrations/errors', 'POST', {
        provider: 'sentry', teamId: origin.id, regressionRule: 'reopen',
        token: 'synthetic-vector-8201', secret,
      }, 201);
      const path = `/settings/teams/${origin.id}/triage-routing`;
      const rule = { id: crypto.randomUUID(), name: 'Production incidents', sourceId: connection.id, targetTeamId: target.id };
      await send(path, 'PUT', { expectedVersion: 0, rules: [rule] });
      // Use a noninitial saved revision, then rename the configuration after
      // delivery: the item must keep its acting rule and revision, not live settings.
      const saved = await send(path, 'PUT', { expectedVersion: 1, rules: [rule] });
      const payload = { action: 'created', data: { issue: {
        id: '9340', title: 'synthetic-vector-9340', count: '17', userCount: 4,
        lastSeen: '2026-10-28T00:00:00Z', substatus: 'ongoing',
        permalink: 'https://sentry.io/organizations/synthetic-vector/issues/9340/',
        metadata: { value: 'synthetic-vector-9341' },
      } } };
      const body = JSON.stringify(payload);
      const deliver = async () => {
        const response = await fetch(runtime.base + new URL(connection.receiver).pathname, {
          method: 'POST', headers: {
            'Content-Type': 'application/json', 'Sentry-Hook-Resource': 'issue',
            'Sentry-Hook-Signature': createHmac('sha256', secret).update(body).digest('hex'),
            'Request-ID': 'synthetic-vector-9342',
          }, body,
        });
        assert.equal(response.status, 200, await response.clone().text());
        return response.json();
      };
      const created = await deliver();
      const itemPath = '/issues/' + created.identifier;
      const item = await send(itemPath);
      assert.equal(item.team.id, target.id);
      assert.equal(item.status.category, 'intake');
      assert.equal(item.routing.ruleId, rule.id);
      assert.equal(item.routing.revision, saved.version);
      await send(path, 'PUT', { expectedVersion: saved.version, rules: [{ ...rule, name: 'Future incidents' }] });
      assert.equal((await deliver()).reused, true);
      assert.deepEqual((await send(itemPath)).routing, item.routing);
      const inspect = roleScreens(evidence);
      for (const [door, name] of [
        ['/app/issues/', 'routing-issue-detail'], ['/app/current/', 'routing-current'],
      ]) {
        await page.setViewportSize({ width: 1440, height: 1000 });
        await navigate(page, runtime.base + door + created.identifier);
        await expect(page.getByRole('heading', { name: payload.data.issue.title, exact: true })).toBeVisible();
        const provenance = page.getByRole('note', { name: 'Triage routing', exact: true });
        await expect(provenance).toContainText(rule.name);
        await expect(provenance).toContainText('revision ' + saved.version);
        await expect(provenance).toContainText(runtime.config.FIRST_OWNER_NAME);
        await expect(provenance).not.toContainText('Future incidents');
        await page.reload();
        await expect(provenance).toContainText(rule.name);
        await expect(provenance).toContainText('revision ' + saved.version);
        await settleReads(page);
        await inspect(page, page.locator('.issue-inspector'), name);
      }
      assert.deepEqual(errors, [], 'routing browser page errors');
      console.log(`PROBE TRIAGE-002 A: signed Sentry issue ${created.identifier} -> ${target.name}; issue detail and Current retain ${rule.name}, revision ${saved.version}, after edit, replay and reload; screens at 1440 and 390.`);
    });
  } finally {
    await context.close();
    await runtime.stop();
  }
}
