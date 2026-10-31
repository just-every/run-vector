import assert from 'node:assert/strict';
import { settleReads } from './collaboration-navigation.mjs';

/** The actual protected search door supplies references in both editors. */
export async function filterReferenceSuggestions({ current, member, owner, issue, endpoint, hidden, privateTeam, bar, rows }) {
  let left = await member.api('/issues/' + issue.identifier);
  await member.api('/issues/' + issue.identifier, 'PATCH', { expectedVersion: left.version, expectedOutcome: 'none' });
  await bar.fill('outcome="none"'); await bar.press('Enter');
  await current.waitForURL(url => url.searchParams.get('expression') === 'outcome="none"');
  await rows(member, [issue]);
  const literalBuilder = current.locator('.boolean-filters details');
  if (!await literalBuilder.evaluate(node => node.open)) await literalBuilder.locator(':scope > summary').click();
  assert.equal(await current.getByLabel('Menu expression', { exact: true }).innerText(), 'outcome="none"', 'The menu retains quoted text instead of treating it as an absent field');
  await current.getByRole('button', { name: 'Apply menu filter', exact: true }).click();
  await rows(member, [issue]);
  left = await member.api('/issues/' + issue.identifier);
  const right = await member.api('/issues/' + endpoint.identifier);
  await member.api('/issues/' + issue.identifier + '/dependencies', 'POST', {
    expectedVersion: left.version, relatedIdentifier: right.identifier, relatedVersion: right.version, direction: 'related',
  });
  const hints = current.locator('[id="' + await bar.getAttribute('list') + '"]');
  await bar.fill('priority=high AND related="' + endpoint.title + '"');
  const option = hints.locator('option').filter({ hasText: endpoint.identifier + ' · ' + endpoint.title });
  await option.waitFor({ state: 'attached' });
  const expression = await option.getAttribute('value');
  assert.equal(expression, 'priority=high AND related=' + endpoint.identifier, 'Completing a related issue preserves the prior Boolean operand');
  await bar.fill(expression); await bar.press('Enter');
  await current.waitForURL(url => url.searchParams.get('expression') === expression);
  await rows(member, [issue]);
  const builder = current.locator('.boolean-filters details');
  if (!await builder.evaluate(node => node.open)) await builder.locator(':scope > summary').click();
  // A reference value uses the same protected search, with a stable identifier
  // as its submitted value and a human-readable title in its suggestion.
  await current.getByRole('combobox', { name: 'Condition 1', exact: true }).selectOption('term');
  await current.getByRole('combobox', { name: 'Field 1', exact: true }).selectOption('related');
  const value = current.getByRole('combobox', { name: 'Value 1', exact: true });
  await value.fill(endpoint.title);
  const valueHints = current.locator('[id="' + await value.getAttribute('list') + '"]');
  await valueHints.locator('option').filter({ hasText: endpoint.identifier + ' · ' + endpoint.title }).waitFor({ state: 'attached' });
  await value.fill(endpoint.identifier);
  await current.getByRole('button', { name: 'Apply menu filter', exact: true }).click();
  await current.waitForURL(url => url.searchParams.get('expression') === 'related=' + endpoint.identifier);
  await rows(member, [issue]);
  const queried = current.waitForResponse(response => new URL(response.url()).pathname === '/api/search' && new URL(response.url()).searchParams.get('q') === hidden.identifier && response.status() === 200);
  await bar.fill('related=' + hidden.identifier);
  const hiddenOption = hints.locator('option').filter({ hasText: hidden.identifier + ' · ' + hidden.title });
  // Synchronize with the real denied search rather than inspecting an empty
  // datalist before its response has arrived.
  await queried;
  await settleReads(current);
  assert.equal(await hiddenOption.count(), 0);
  await owner(`/settings/teams/${privateTeam.id}/members/${member.id}`, 'PUT', { role: 'member' });
  await hiddenOption.waitFor({ state: 'attached', timeout: 15000 });
  await owner(`/settings/teams/${privateTeam.id}/members/${member.id}`, 'DELETE');
  await hiddenOption.waitFor({ state: 'detached', timeout: 15000 });
  assert.ok(!(await current.locator('.boolean-filters').innerText()).includes(hidden.title), 'Withdrawn source text is absent from suggestions');
  console.log('PROBE SEARCH-004 reference-autocomplete: typed and menu title lookup -> stable issue predicate and exact match; hidden suggestion omitted, admitted only while membership exists, removed after withdrawal');
}
