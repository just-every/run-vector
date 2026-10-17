import assert from 'node:assert/strict';

export async function streamRankingJourney(fixture, record) {
  const { api, teams, create, status } = fixture;
  const at = '2027-04-15T12:00:00.000Z';
  const read = () => api('/current?at=' + encodeURIComponent(at));
  const priority = [];
  // Creation/update recency and due dates oppose priority, so neither can
  // accidentally explain the expected priority ordering.
  for (const [index, value] of ['urgent', 'high', 'medium', 'low', 'none'].entries()) {
    priority.push(await create(teams[2], `Rank priority ${value}`, {
      priority: value, dueDate: index === 0 ? null : `2027-04-0${6 - index}`,
    }));
  }
  const due = [];
  for (const date of ['2027-04-01', '2027-04-10', '2027-04-16', '2027-04-20', null]) {
    due.push(await create(teams[2], `Rank due ${date}`, { priority: 'high', dueDate: date }));
  }
  const olderIdentifier = await create(teams[2], 'Rank updated first', { priority: 'medium' });
  const newerIdentifier = await create(teams[2], 'Rank updated second', { priority: 'medium' });
  const updated = await api('/issues/' + olderIdentifier.identifier, 'PATCH', {
    expectedVersion: olderIdentifier.version, title: olderIdentifier.title + ' edited after second',
  });
  assert.ok(updated.updatedAt > newerIdentifier.updatedAt, 'Public mutation establishes a strict update-time order');

  // A native bulk team move gives every selected issue the same transaction
  // timestamp. The first-created C identifier sorts after the later A one.
  // No request may supply createdAt/updatedAt and no clock or DB is replaced.
  const firstCreated = await create(teams[2], 'Rank tied C', { priority: 'low', dueDate: '2027-04-18' });
  const secondCreated = await create(teams[0], 'Rank tied A', { priority: 'low', dueDate: '2027-04-18' });
  await api('/issues/bulk/team', 'POST', {
    teamId: teams[1].id,
    issues: [firstCreated, secondCreated].map(issue => ({
      identifier: issue.identifier, expectedVersion: issue.version,
      statusId: status(teams[1], 'started'),
    })),
  });
  const stream = await read(), again = await read();
  assert.equal(stream.generatedAt, at);
  const rows = stream.sections.now;
  function order(issues) {
    const ids = new Set(issues.map(issue => issue.identifier));
    return rows.filter(row => ids.has(row.identifier)).map(row => row.identifier);
  }
  for (const issue of [...priority, ...due, updated, newerIdentifier, firstCreated, secondCreated])
    assert.ok(rows.some(row => row.identifier === issue.identifier), `${issue.identifier} ranks within Now`);
  assert.deepEqual(order(priority), priority.map(issue => issue.identifier), 'Urgent through No priority overrides due and recency');
  assert.deepEqual(order(due), due.map(issue => issue.identifier), 'Overdue/earliest dates precede future dates and absent dates');
  assert.deepEqual(order([updated, newerIdentifier]), [updated.identifier, newerIdentifier.identifier], 'Newest update wins equal priority and date');
  const ties = rows.filter(row => [firstCreated.identifier, secondCreated.identifier].includes(row.identifier));
  assert.equal(ties[0].priority, ties[1].priority);
  assert.equal(ties[0].dueDate, ties[1].dueDate);
  assert.equal(ties[0].updatedAt, ties[1].updatedAt, 'Native bulk transaction establishes the identifier tie');
  const identifierOrder = [firstCreated.identifier, secondCreated.identifier].sort();
  assert.deepEqual(ties.map(row => row.identifier), identifierOrder);
  assert.deepEqual(again.sections.now.map(row => row.identifier), rows.map(row => row.identifier), 'Repeated as-of reads retain total order');
  record('CURR-007', 'HTTP Current as-of fixture independently proves priority, overdue/future/absent due dates, most recent update, and identifier ties using a native bulk team move with a common timestamp.');
}
