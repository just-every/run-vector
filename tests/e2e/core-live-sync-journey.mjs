import assert from 'node:assert/strict';
import { writeFile, readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { beforePrivateNavigation, settleReads, trackRequests } from './collaboration-navigation.mjs';
import { readDevelopmentLink } from './outbox-session.mjs';
import { withOperatorClient } from './operator-request.mjs';

/** Two independently authenticated browser contexts use the built native Worker. */
export async function liveSyncJourney({ page, context, browser, base, state, teamId, evidence, record, restart }) {
  const api = (path, method = 'GET', data) => withOperatorClient(context, async client => {
    const response = await client.fetch(base + '/api' + path, { method, headers: { Origin: base }, data });
    return { status: response.status(), body: await response.json() };
  });
  const issue = await api('/issues', 'POST', { title: 'synthetic-vector-live-1', teamId });
  assert.equal(issue.status, 201);
  const id = issue.body.identifier;
  const email = ['synthetic-vector-live-' + Date.now(), 'vector.test'].join('@');
  const invited = await api('/settings/operators/invite', 'POST', { email, displayName: 'synthetic-vector-live-reader', role: 'member' });
  assert.equal(invited.status, 202);
  const readerContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await readerContext.addInitScript(() => {
    const NativeSocket = window.WebSocket;
    window.__liveSockets = [];
    window.__liveFrames = [];
    window.WebSocket = class extends NativeSocket {
      constructor(...args) {
        super(...args);
        window.__liveSockets.push(this);
        this.addEventListener('message', event => window.__liveFrames.push({ at: Date.now(), body: event.data }));
      }
    };
  });
  const reader = await readerContext.newPage();
  const errors = [], documents = [];
  reader.on('pageerror', error => errors.push(error.message));
  reader.on('request', request => { if (request.isNavigationRequest() && request.frame() === reader.mainFrame()) documents.push(new URL(request.url()).pathname); });
  trackRequests(reader);
  const frames = () => reader.evaluate(() => window.__liveFrames);
  const ready = () => reader.waitForFunction(() => window.__liveFrames.some(frame => frame.body === '{"type":"ready"}'));
  try {
    const link = await readDevelopmentLink(base, context.request, email, state);
    await reader.goto(link);
    await reader.getByRole('button', { name: 'Confirm', exact: true }).click();
    await reader.waitForURL(base + '/app');
    await beforePrivateNavigation(reader, base + '/app/issues/' + id);
    await reader.goto(base + '/app/issues/' + id);
    await reader.getByRole('heading', { name: issue.body.title, exact: true }).waitFor();
    await ready();
    await beforePrivateNavigation(page, base + '/app/issues/' + id);
    await page.goto(base + '/app/issues/' + id);
    await page.getByRole('heading', { name: issue.body.title, exact: true }).waitFor();
    await settleReads(reader);
    const documentOrigin = await reader.evaluate(() => performance.timeOrigin);
    const navigationCount = documents.length;
    const latencies = [];
    // Only a native frame can trigger these reads: hold the pre-existing clock
    // while measuring, so a lucky polling phase cannot satisfy the live proof.
    let frameCount = (await frames()).filter(frame => frame.body === '{"type":"invalidate"}').length;
    let commitAt = 0, seenAt = 0, expectedTitle;
    await reader.route('**/api/**', async route => {
      if (route.request().method() === 'GET' && new URL(route.request().url()).pathname !== '/api/live-sync') {
        const count = (await frames()).filter(frame => frame.body === '{"type":"invalidate"}').length;
        if (count <= frameCount && !seenAt)
          await reader.waitForFunction(previous => window.__liveFrames.filter(frame => frame.body === '{"type":"invalidate"}').length > previous, frameCount, { timeout: 10000 });
      }
      await route.continue();
    });
    for (let index = 0; index < 12; index++) {
      expectedTitle = 'synthetic-vector-live-' + (index + 2);
      frameCount = (await frames()).filter(frame => frame.body === '{"type":"invalidate"}').length;
      seenAt = 0;
      await page.getByRole('button', { name: 'Edit issue', exact: true }).click();
      await page.getByLabel('Title', { exact: true }).fill(expectedTitle);
      const committed = page.waitForResponse(response => response.url() === base + '/api/issues/' + id && response.request().method() === 'PATCH');
      const start = Date.now();
      await page.getByRole('button', { name: 'Save changes', exact: true }).click();
      const response = await committed;
      assert.equal(response.status(), 200);
      commitAt = Date.now();
      await reader.getByRole('heading', { name: expectedTitle, exact: true }).waitFor({ timeout: 1500 });
      seenAt = Date.now();
      const nowFrames = await frames();
      assert.ok(nowFrames.filter(frame => frame.body === '{"type":"invalidate"}').length > frameCount);
      latencies.push({ start, responseAt: commitAt, renderAt: seenAt, requestToRenderMs: seenAt - start, responseToRenderMs: seenAt - commitAt });
    }
    await reader.unroute('**/api/**');
    const ordered = latencies.map(row => row.requestToRenderMs).sort((a, b) => a - b);
    const p95 = ordered[Math.ceil(ordered.length * .95) - 1];
    assert.ok(p95 < 1000, `Native edit commit-to-render upper bound p95 ${p95} ms`);
    assert.equal(await reader.evaluate(() => performance.timeOrigin), documentOrigin);
    assert.equal(documents.length, navigationCount);

    // A genuine socket close immediately precedes the edit. Both native clock
    // fallback and live reconnect remain available, under CURR-008's bound.
    await reader.evaluate(() => { for (const socket of window.__liveSockets) if (socket.readyState === WebSocket.OPEN) socket.close(); });
    const dropAt = Date.now();
    const current = await api('/issues/' + id);
    const recoveredTitle = 'synthetic-vector-live-recovered';
    assert.equal((await api('/issues/' + id, 'PATCH', { expectedVersion: current.body.version, title: recoveredTitle })).status, 200);
    await reader.getByRole('heading', { name: recoveredTitle, exact: true }).waitFor({ timeout: 5000 });
    const recoveryMs = Date.now() - dropAt;
    assert.ok(recoveryMs <= 5000);
    await reader.waitForFunction(() => window.__liveFrames.filter(frame => frame.body === '{"type":"ready"}').length >= 2);

    const intake = await api('/intake', 'POST', { title: 'synthetic-vector-current-live', teamId });
    assert.equal(intake.status, 201);
    const currentUrl = base + '/app/current/' + intake.body.identifier;
    await beforePrivateNavigation(reader, currentUrl);
    await reader.goto(currentUrl);
    const row = reader.locator('#issue-row-' + intake.body.identifier);
    await row.waitFor();
    await ready(); await settleReads(reader);
    const currentDocument = await reader.evaluate(() => performance.timeOrigin);
    const currentStart = Date.now();
    const decision = await api('/issues/' + intake.body.identifier + '/defer', 'POST', { expectedVersion: 1, returnAt: new Date(Date.now() + 600000).toISOString() });
    assert.equal(decision.status, 200);
    await row.waitFor({ state: 'detached', timeout: 1500 });
    const currentMs = Date.now() - currentStart;
    assert.ok(currentMs < 1000);
    assert.equal(reader.url(), currentUrl);
    assert.equal(await reader.evaluate(() => performance.timeOrigin), currentDocument);
    // Park the writer on its public lobby so this deliberate restart does not
    // inject failures into unrelated shared-journey background assertions.
    await beforePrivateNavigation(page, base + '/');
    await page.goto(base + '/');
    await settleReads(page);
    // Restart the actual built Worker while the reader's private view stays open.
    await restart();
    await page.goto(base + '/app/issues/' + id);
    await page.getByRole('heading', { name: recoveredTitle, exact: true }).waitFor();
    await reader.waitForFunction(() => window.__liveSockets.some(socket => socket.readyState === WebSocket.OPEN), { timeout: 10000 });
    const returned = await api('/issues/' + intake.body.identifier + '/return', 'POST', { expectedVersion: 2 });
    assert.equal(returned.status, 200);
    await row.waitFor({ timeout: 5000 });
    for (const width of [1440, 390]) {
      await reader.setViewportSize({ width, height: 1000 });
      await reader.screenshot({ path: evidence + '/live-sync-current-' + width + '.png', fullPage: true });
      assert.ok(await reader.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    }
    await beforePrivateNavigation(reader, base + '/app/issues/' + id);
    await reader.goto(base + '/app/issues/' + id);
    await reader.getByRole('heading', { name: recoveredTitle, exact: true }).waitFor();
    for (const width of [1440, 390]) {
      await reader.setViewportSize({ width, height: 1000 });
      await reader.screenshot({ path: evidence + '/live-sync-issue-' + width + '.png', fullPage: true });
      assert.ok(await reader.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    }
    const require = createRequire(import.meta.url);
    await reader.addScriptTag({ content: await readFile(require.resolve('axe-core/axe.min.js'), 'utf8') });
    const violations = await reader.evaluate(async () => (await window.axe.run()).violations.filter(row => ['serious', 'critical'].includes(row.impact)).map(row => row.id));
    assert.deepEqual(violations, []);
    // Current private membership is checked again for delivery and native reads.
    const personResponse = await readerContext.request.get(base + '/api/session');
    assert.equal(personResponse.status(), 200);
    const person = await personResponse.json();
    const privateTeam = await api('/settings/teams', 'POST', { name: 'synthetic-vector-live-private', identifierPrefix: 'SYNLIVE', isPrivate: true });
    assert.equal(privateTeam.status, 200);
    const privateTeamId = privateTeam.body.teams.find(team => team.identifierPrefix === 'SYNLIVE').id;
    assert.equal((await api('/settings/teams/' + privateTeamId + '/members/' + person.operatorId, 'PUT', { role: 'member' })).status, 200);
    const privateIssue = await api('/issues', 'POST', { title: 'synthetic-vector-live-private-title', teamId: privateTeamId });
    assert.equal(privateIssue.status, 201);
    await beforePrivateNavigation(reader, base + '/app/issues/' + privateIssue.body.identifier);
    await reader.goto(base + '/app/issues/' + privateIssue.body.identifier);
    await reader.getByRole('heading', { name: privateIssue.body.title, exact: true }).waitFor();
    await ready(); await settleReads(reader);
    const beforeWithdrawal = (await frames()).filter(frame => frame.body === '{"type":"invalidate"}').length;
    assert.equal((await api('/settings/teams/' + privateTeamId + '/members/' + person.operatorId, 'DELETE')).status, 200);
    assert.equal((await api('/issues/' + privateIssue.body.identifier, 'PATCH', { expectedVersion: 1, title: 'synthetic-vector-live-private-withdrawn' })).status, 200);
    await reader.getByRole('heading', { name: privateIssue.body.title, exact: true }).waitFor({ state: 'detached', timeout: 5000 });
    assert.equal(await reader.getByText('synthetic-vector-live-private-withdrawn', { exact: true }).count(), 0);
    const denied = await readerContext.request.get(base + '/api/issues/' + privateIssue.body.identifier);
    assert.equal(denied.status(), 404);
    assert.equal((await frames()).filter(frame => frame.body === '{"type":"invalidate"}').length, beforeWithdrawal);
    await reader.evaluate(() => { for (const socket of window.__liveSockets) if (socket.readyState === WebSocket.OPEN) socket.close(); });
    await reader.waitForFunction(() => window.__liveSockets.some(socket => socket.readyState === WebSocket.OPEN));
    assert.equal((await readerContext.request.get(base + '/api/issues/' + privateIssue.body.identifier)).status(), 404);
    const framesBeforeSignout = await frames();
    await settleReads(reader);
    const signedOut = await readerContext.request.post(base + '/auth/signout', { headers: { Origin: base }, data: {} });
    assert.equal(signedOut.status(), 204);
    await reader.waitForFunction(() => window.__liveSockets.every(socket => socket.readyState !== WebSocket.OPEN), { timeout: 5000 });
    const after = await api('/issues/' + id);
    assert.equal((await api('/issues/' + id, 'PATCH', { expectedVersion: after.body.version, title: 'synthetic-vector-after-signout' })).status, 200);
    const actualFrames = await frames();
    assert.equal(actualFrames.filter(frame => frame.body === '{"type":"invalidate"}').length, framesBeforeSignout.filter(frame => frame.body === '{"type":"invalidate"}').length);
    assert.ok(actualFrames.every(frame => ['{"type":"ready"}', '{"type":"pong"}', '{"type":"invalidate"}'].includes(frame.body)));
    assert.deepEqual(errors, []);
    const receipt = { passed: true, samples: latencies, p95RequestToRenderMs: p95, currentRequestToRenderMs: currentMs, forcedSocketRecoveryMs: recoveryMs,
      independentNativeSessions: true, documentUnchanged: true, navigationUnchanged: true, workerRestart: true, privateWithdrawalAndReconnect: true, signoutStopsDelivery: true, contentFreeFrames: true, screenshots: [1440, 390] };
    await writeFile(evidence + '/live-sync-browser.json', JSON.stringify(receipt, null, 2));
    console.info('[SYNC-001] ' + JSON.stringify(receipt));
    record('SYNC-001', 'Two independent native browser sessions observe committed title edits and Current decisions through real Durable Object WebSockets with measured p95 under one second, unchanged documents and forced-drop recovery under five seconds.');
  } finally {
    await settleReads(reader).catch(() => {});
    await readerContext.close();
  }
}
