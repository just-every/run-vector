import assert from 'node:assert/strict';
import { navigate, beforePrivateNavigation } from './collaboration-navigation.mjs';

/** Owner-produced Jira JSON enters through the mounted view door and reopens
 * as an ordinary native view in a real authenticated browser. */
export async function jiraFilterImport({ current, member, base, marker, team, expected, rows, inspect }) {
  const name = marker + ' Jira priorities';
  const source = { startAt: 0, maxResults: 50, total: 2, isLast: true, values: [
    { id: 'synthetic-vector-133-jira-visible', name, jql: 'priority=High AND project=ENG' },
    { id: 'synthetic-vector-133-jira-omitted', name: name + ' omitted', jql: 'unsupported=anything' },
  ] };
  const report = await member.api('/views', 'POST', { isShared: true, query: { q: marker }, jiraImport: { export: source, mappings: {
    priority: { field: 'priority', values: { High: 'high' } }, project: { field: 'team', values: { ENG: team.id } },
  } } }, 201);
  assert.equal(report.views.length, 1); assert.equal(report.omissions.length, 1);
  assert.equal(report.omissions[0].id, source.values[1].id);
  const view = report.views[0];
  await current.setViewportSize({ width: 1440, height: 1000 });
  await navigate(current, base + '/app/views/' + view.id);
  await rows(member, expected);
  await beforePrivateNavigation(current, current.url()); await current.reload();
  await rows(member, expected);
  assert.equal(await current.getByRole('combobox', { name: 'Filter expression', exact: true }).inputValue(), view.query.expression);
  assert.equal((await member.api('/views/' + view.id)).query.expression, view.query.expression);
  await inspect(current, current.locator('.issues-browser'), 'boolean-jira-reopened');
  console.log('PROBE SEARCH-004 jql-browser: exported page -> one persisted native view and one explicit omission; exact two issue rows and unchanged expression after rendered reload');
  return view;
}
