import assert from 'node:assert/strict';

export async function fixtureRows(page, items, expected) {
  const universe = Object.values(items).map(issue => issue.identifier);
  const wanted = expected.map(issue => issue.identifier).sort();
  await page.waitForFunction(({ universe, wanted }) => {
    const actual = [...document.querySelectorAll('.stream-row')]
      .map(row => row.dataset.issueIdentifier).filter(id => universe.includes(id)).sort();
    return JSON.stringify(actual) === JSON.stringify(wanted);
  }, { universe, wanted });
  const actual = await page.locator('.stream-row').evaluateAll(rows => rows.map(row => row.dataset.issueIdentifier));
  assert.deepEqual(actual.filter(id => universe.includes(id)).sort(), wanted);
}

export async function streamControlsReady(page) {
  await page.locator('.stream-filters select').first().waitFor();
  await page.waitForFunction(() => [...document.querySelectorAll('.stream-filters select')].every(select => !select.disabled));
}

export async function saveControl(page, base, surface, action, method = 'PUT') {
  const pending = page.waitForResponse(response => response.url() === `${base}/api/preferences/${surface}`
    && response.request().method() === method);
  await action();
  const response = await pending;
  assert.equal(response.status(), 200);
  return response.json();
}

export async function controlsFit(page) {
  const bounds = await page.locator('.stream-filters select, .stream-filters button').evaluateAll(controls =>
    controls.map(control => {
      const rect = control.getBoundingClientRect();
      return { height: rect.height, left: rect.left, right: rect.right };
    }));
  const width = await page.evaluate(() => window.innerWidth);
  for (const bound of bounds) {
    assert.ok(bound.height >= 44, 'Every stream control has a 44px touch target');
    assert.ok(bound.left >= 0 && bound.right <= width, 'Wrapped control stays within the viewport');
  }
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'No horizontal page overflow');
}

export async function cycleContextChecks(page, fixture) {
  const { api, cycles, teams, timezone } = fixture;
  const response = await api('/my-work');
  const expected = [
    { completed: 2, total: 5, percentage: 40, unit: 'points' },
    { completed: 1, total: 2, percentage: 50, unit: 'issue-count' },
  ];
  for (const [index, facts] of expected.entries()) {
    const cycle = cycles[index], actual = response.cycles.find(row => row.id === cycle.id);
    assert.ok(actual, 'Assigned work qualifies each team independently');
    for (const [key, value] of Object.entries(facts)) assert.equal(actual[key], value);
    assert.equal(actual.startsAt, cycle.startsAt);
    assert.equal(actual.endsAt, cycle.endsAt);
    assert.equal(actual.timezone, timezone);
    const name = `${teams[index].name} · ${cycle.name}`;
    const label = page.locator('.cycle-context').getByText(name, { exact: true });
    await label.waitFor();
    assert.equal(await label.count(), 1, 'One context row per qualifying team');
    const row = label.locator('..');
    const dates = row.locator('time');
    assert.equal(await dates.getAttribute('datetime'),cycle.startsAt);
    assert.equal(await dates.getAttribute('data-ends-at'),cycle.endsAt);
    const localTime = await page.evaluate(({ value, timezone }) => new Intl.DateTimeFormat(undefined, {
      timeZone: timezone, hour: 'numeric', minute: '2-digit',
    }).format(new Date(value)), { value: cycle.startsAt, timezone });
    assert((await dates.innerText()).includes(localTime), 'The cycle range uses the viewer’s local time');
    const progress = (await row.locator('strong').innerText()).replace(/\s+/g, ' ');
    const unit = facts.unit === 'points' ? 'points' : 'issues · by issue count';
    assert.equal(progress, `${facts.completed}/${facts.total} ${unit} · ${facts.percentage}%`);
  }
  assert.ok(!response.cycles.some(row => row.id === cycles[2].id), 'Unrelated active team is excluded from My work context');
  assert.equal(await page.locator('.cycle-context').getByText(`${teams[2].name} · ${cycles[2].name}`, { exact: true }).count(), 0);
}
