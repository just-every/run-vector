import assert from 'node:assert/strict';
import { beforePrivateNavigation } from './collaboration-navigation.mjs';

export const expectedDraftFailures = new Set();

export async function draftJourney(page, context, base, teamId, operatorId, record) {
  await beforePrivateNavigation(page, base + '/app/new-issue');
  expectedDraftFailures.add(base + '/api/metadata');
  // A failed team-metadata read must expose recovery through the same form door.
  // Fault one form read, after the preceding document's real reads settle.
  // Background reads must never turn this single-failure fixture into an outage.
  let injected = 0;
  const faultConsole = page.waitForEvent('console', { predicate: message =>
    message.type() === 'error' && message.location().url === base + '/api/metadata' &&
    /^Failed to load resource: the server responded with a status of 500(?: \([^)]*\))?$/.test(message.text()) });
  await page.route('**/api/metadata', route => {
    injected++;
    return route.fulfill({ status: 500,
      contentType: 'application/json', body: JSON.stringify({ error: 'unavailable' }) });
  }, { times: 1 });
  await page.goto(base + '/app/new-issue');
  await page.getByRole('alert').filter({ hasText: 'Unable to load issue options.' }).waitFor();
  await faultConsole;
  assert.equal(injected, 1, 'Exactly one metadata response is faulted');
  assert.equal(await page.getByRole('button', { name: '← Back', exact: true }).isEnabled(), true);
  await page.unroute('**/api/metadata');
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await page.getByRole('textbox', { name: /^Title/, disabled: false }).waitFor();
  expectedDraftFailures.delete(base + '/api/metadata');
  const title = `Unsent browser draft ${Date.now()}`;
  const fields = [
    [/^Title/, title], ['Description', 'First unsent line\nSecond unsent line\nThird line'],
    ['Expected outcome', 'Restore the typed outcome'], ['Customer impact', 'Restore the typed impact'],
    [/^Estimate/, '7'], ['Due date', '2027-02-18'],
  ];
  await page.getByRole('textbox', { name: /^Title/ }).fill(title);
  await page.getByLabel('Description', { exact: true }).fill(fields[1][1]);
  await page.getByLabel(/^Team/).selectOption(teamId);
  await page.getByText('Optional context', { exact: true }).click();
  await page.getByLabel(/^Assignee/).selectOption(operatorId);
  await page.getByLabel(/^Priority/).selectOption('high');
  for (const [name, value] of fields.slice(2)) await page.getByLabel(name).fill(value);
  await beforePrivateNavigation(page, page.url());
  await page.reload();
  await page.getByRole('textbox', { name: /^Title/ }).waitFor();
  // The form restores the draft once its options and team metadata load, and only then enables its fields.
  await page.getByRole('textbox', { name: /^Title/, disabled: false }).waitFor();
  await page.getByText('Optional context', { exact: true }).click();
  for (const [name, value] of fields) assert.equal(await page.getByLabel(name).inputValue(), value);
  for (const [name, value] of [[/^Team/, teamId], [/^Assignee/, operatorId], [/^Priority/, 'high']])
    assert.equal(await page.getByLabel(name).inputValue(), value);
  for (const path of ['/api/search?q=' + encodeURIComponent(title), '/api/issues?q=' + encodeURIComponent(title)]) {
    const response = await context.request.get(base + path);
    assert.equal(response.status(), 200);
    const body = await response.json();
    assert.ok(!JSON.stringify(body).includes(title), 'Unsubmitted draft never became an API record');
  }
  // Clear through the real form so the subsequent creation journey starts clean.
  for (const [name] of fields) await page.getByLabel(name).fill('');
  await page.getByLabel(/^Assignee/).selectOption('');
  await page.getByLabel(/^Priority/).selectOption('none');
  record('ISSUE-015', 'Typed unique unsent title, multiline description, team, assignee, priority, estimate, date, outcome and impact survive reload in the same context; authenticated search/list contain no created record.');
}
