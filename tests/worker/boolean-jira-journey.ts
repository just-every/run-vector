import { expect } from 'vitest';
import { roleWorkspace, resetLimits, snapshot } from './role-fixture';
type Fixture = Awaited<ReturnType<typeof roleWorkspace>>;

/** Import one documented Jira saved-filter record through the existing view
 * creation door, then execute and reopen the resulting native definition. */
export async function jiraBooleanJourney(f: Fixture, high: any[], urgent: any, low: any, blockedHigh: any, blockedUrgent: any, privateTeam: any) {
  const marker = 'synthetic-vector-129', owner = f.people.owner;
  const json = async (response: Response, status = 200): Promise<any> => {
    expect(response.status, await response.clone().text()).toBe(status); return response.json();
  };
  const labelState = await json(await owner.call('/settings/labels', 'POST', { name: 'synthetic-vector-133-jira', color: '#2563eb' }));
  const label = labelState.labels.find((row: any) => row.name === 'synthetic-vector-133-jira');
  const latest = await json(await owner.call('/issues/' + high[0].identifier));
  await json(await owner.call('/issues/' + latest.identifier, 'PATCH', { expectedVersion: latest.version, labelIds: [label.id], assigneeOperatorId: f.member.id }));
  const options = await json(await owner.call('/options'));
  const completed = await json(await owner.call('/issues', 'POST', { teamId: f.team.id, title: marker + '-jql-completed', priority: 'high', labelIds: [label.id], statusId: options.statuses.find((s: any) => s.teamId === f.team.id && s.category === 'completed').id }), 201);
  const mappings = {
    priority: { field: 'priority', values: { High: 'high', Highest: 'urgent', Low: 'low' } },
    labels: { field: 'label', values: { Review: label.id } },
    assignee: { field: 'assignee', values: {} },
  };
  let sequence = 0;
  const importFilter = async (jql: string, who = f.member, mapping = mappings) => {
    await resetLimits();
    return who.call('/views', 'POST', { name: 'synthetic-vector-133-jql-' + ++sequence,
      query: { q: marker }, jiraImport: { jql, mappings: mapping } });
  };
  const identifiers = async (view: any, who = f.member) => {
    await resetLimits();
    const reopened = await json(await who.call('/views/' + view.id));
    expect(reopened.query.expression).toBe(view.query.expression);
    const page = await json(await who.call('/issues?' + new URLSearchParams({ ...reopened.query, pageSize: '100' })));
    expect(page.total).toBe(page.issues.length);
    return page.issues.map((issue: any) => issue.identifier).sort();
  };
  const source = { id: 'synthetic-vector-133-filter', name: 'Reviewed priorities', jql: '(priority IN (High, Highest)) AND labels IN (Review)' };
  const imported = await json(await importFilter(source.jql), 201);
  expect(await identifiers(imported)).toEqual([high[0].identifier, completed.identifier].sort());
  const precedence = await json(await importFilter('priority = High OR priority = Highest AND labels = Review'), 201);
  expect(await identifiers(precedence)).toEqual([...high, blockedHigh, completed].map(i => i.identifier).sort());
  const notIn = await json(await importFilter('priority NOT IN (High)'), 201);
  expect(await identifiers(notIn)).toEqual([urgent, low, blockedUrgent].map(i => i.identifier).sort());
  const empty = await json(await importFilter('labels IS EMPTY'), 201);
  expect(await identifiers(empty)).toEqual([...high.slice(1), urgent, low, blockedHigh, blockedUrgent].map(i => i.identifier).sort());
  const negative = await json(await importFilter('NOT labels = Review'), 201);
  expect(await identifiers(negative)).toEqual([], 'Jira NOT comparison does not silently include EMPTY values');
  const person = await json(await importFilter('assignee = currentUser()'), 201);
  expect(await identifiers(person)).toEqual([high[0].identifier]);
  const ownerQuery = await json(await owner.call('/issues?' + new URLSearchParams({ ...person.query, pageSize: '100' })));
  expect(ownerQuery.total).toBe(0);
  const guest = await json(await importFilter('priority = High AND labels = Review', f.guest), 201);
  expect(await identifiers(guest, f.guest)).toEqual([high[0].identifier, completed.identifier].sort());
  const before = await snapshot(['saved_views', 'issues', 'issue_activity']);
  for (const jql of ['unknown = value', 'priority = Unmapped', 'labels ~ Review', 'priority = High ORDER BY created DESC', '(priority=High', 'priority IN ()', 'priority=High;SELECT 1', 'assignee = membersOf(admins)', 'NOT '.repeat(12) + 'priority=High']) {
    const response = await importFilter(jql);
    expect(response.status, jql).toBe(422);
    const refusal: any = await response.json(); expect(refusal.error).toBe('unmapped_jql'); expect(refusal.omissions.length).toBeGreaterThan(0);
  }
  expect((await importFilter('x'.repeat(1001))).status).toBe(400);
  const hiddenMapping = { ...mappings, project: { field: 'team', values: { ENG: privateTeam.id } } };
  const hidden = await importFilter('project=ENG', f.member, hiddenMapping as any);
  expect(hidden.status).toBe(422);
  expect(JSON.stringify(await hidden.json())).not.toContain(privateTeam.name);
  expect(await snapshot(['saved_views', 'issues', 'issue_activity'])).toEqual(before);
  const readonly = await f.fresh('member');
  await json(await owner.call('/settings/operators/' + readonly.id + '/role', 'PATCH', { role: 'viewer' }));
  const readonlyBefore = await snapshot(['saved_views', 'issues', 'issue_activity']);
  expect((await importFilter(source.jql, readonly)).status).toBe(403);
  expect(await snapshot(['saved_views', 'issues', 'issue_activity'])).toEqual(readonlyBefore);
  console.log('PROBE SEARCH-004 jql-import: explicitly mapped Jira Boolean and IN filters -> exact persisted native view sets; EMPTY, NOT and precedence preserved; unsupported or hidden mappings return omission reports with no partial view; Guest scoped and Viewer refused');
}
