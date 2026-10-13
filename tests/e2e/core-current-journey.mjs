import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { beforePrivateNavigation } from './collaboration-navigation.mjs';

export async function currentJourney(page, context, base, teamId, evidence, record) {
  const created = await context.request.post(base + '/api/intake', {
    headers: { Origin: base }, data: { title: `Live Current decision ${Date.now()}`, teamId },
  });
  assert.equal(created.status(), 201);
  const issue = await created.json();
  await beforePrivateNavigation(page, base + '/app');
  await page.goto(base + '/app');
  const row = page.locator(`#issue-row-${issue.identifier}`);
  await row.waitFor();
  const currentDocument = await page.evaluate(() => performance.timeOrigin);
  const successfulPoll = await page.waitForResponse(response => response.url() === base + '/api/current' && response.status() === 200);
  await successfulPoll.finished();
  const pollCompletedAt = Date.now();
  // Mutate through a separate real authenticated request immediately after a poll.
  const requestStartedAt = Date.now();
  const response = await context.request.post(base + `/api/issues/${issue.identifier}/defer`, {
    headers: { Origin: base }, data: { expectedVersion: issue.version, returnAt: new Date(Date.now() + 600000).toISOString(), reason: 'Decision from another request' },
  });
  const decisionRespondedAt = Date.now();
  assert.equal(response.status(), 200);
  await row.waitFor({ state: 'detached', timeout: 6500 });
  const visibleAt = Date.now();
  const proof = { identifier: issue.identifier, pollCompletedAt, requestStartedAt, decisionRespondedAt, visibleAt,
    fromDecisionResponseMs: visibleAt - decisionRespondedAt, fromRequestStartMs: visibleAt - requestStartedAt,
    alignmentMs: requestStartedAt - pollCompletedAt, documentUnchanged: currentDocument === await page.evaluate(() => performance.timeOrigin) };
  await writeFile(evidence + '/current-freshness.json', JSON.stringify(proof, null, 2));
  console.info('[Current freshness] ' + JSON.stringify(proof));
  assert.ok(proof.documentUnchanged);
  assert.ok(proof.fromDecisionResponseMs <= 5000, 'Already-open Current reflects decision within five seconds of the response');
  record('CURR-008', 'Already-open Current observes a genuine separate-request intake decision after worst-phase successful poll, without navigation, reload or synthetic refresh; exact request/response/visible timestamps recorded.');
}
