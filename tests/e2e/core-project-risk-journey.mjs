import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { beforePrivateNavigation, settleReads, trackRequests } from './collaboration-navigation.mjs';

// PROJ-006: concurrent risk evidence stays visible beneath health precedence.
export async function projectRiskJourney(page, context, base, record = async () => {}) {
  trackRequests(page);
  const api = async (path, method = 'GET', data) => {
    const response = await context.request.fetch(base + '/api' + path, {
      method, headers: { Origin: base }, ...(data === undefined ? {} : { data }),
    });
    assert(response.ok(), `${method} ${path}: ${response.status()}`);
    return await response.json(); // Consume the actual response body before continuing.
  };
  const me = (await api('/session')).operatorId;
  await api('/settings', 'PATCH', { timezone: 'UTC' });
  const local = days => new Date(Date.now() + days * 86400000).toISOString().slice(0, 16);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const navigate = async path => {
    await beforePrivateNavigation(page, path);
    await page.goto(path);
  };
  const fits = async () => {
    await settleReads(page);
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Project risk evidence fits the viewport');
  };
  const exactLinks = async (row, identifiers) => {
    const actual = await row.getByRole('link').evaluateAll(links => links.map(link => ({
      text: link.textContent.trim(), path: new URL(link.href).pathname,
    })));
    assert.deepEqual(actual.map(link => link.path).sort(), identifiers.map(id => '/app/issues/' + id).sort());
    for (const identifier of identifiers) {
      assert(actual.some(link => link.path === '/app/issues/' + identifier && link.text.includes(identifier)), `Risk link identifies ${identifier}`);
    }
  };

  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    const suffix = [...randomBytes(8)].map(n => String.fromCharCode(65 + n % 26)).join('');
    const createTeam = async (name, prefix) => {
      const state = await api('/settings/teams', 'POST', { name: name + ' ' + suffix, identifierPrefix: prefix + suffix });
      const team = state.teams.find(row => row.identifierPrefix === prefix + suffix);
      assert(team, 'Native team fixture was created');
      return team;
    };
    const team = await createTeam('Payment reliability', 'PR');
    const provider = await createTeam('Provider operations', 'PB');
    const status = (owner, category) => {
      const found = owner.statuses.find(row => row.category === category);
      assert(found, `Fixture team has ${category} status`);
      return found.id;
    };
    const name = 'Payment reliability rollout ' + suffix;
    const projects = await api('/settings/projects', 'POST', {
      name, leadOperatorId: me, targetDate: yesterday,
      description: 'Restore reliable payment acceptance while provider verification is pending.',
    });
    const project = projects.projects.find(row => row.name === name);
    assert(project, 'Native project fixture was created');
    await api('/settings/projects/' + project.id, 'PATCH', { lifecycle: 'active' });
    const cycles = await api('/settings/cycles', 'POST', {
      teamId: team.id, name: 'Payment recovery ' + suffix,
      startsLocal: local(-1), endsLocal: local(6), capacity: 8,
    });
    const cycle = cycles.cycles.find(row => row.teamId === team.id);
    assert(cycle, 'Native active cycle fixture was created');
    const create = (owner, title, changes = {}) => api('/issues', 'POST', {
      teamId: owner.id, statusId: status(owner, 'unstarted'), title, ...changes,
    });
    const urgent = await create(team, 'Restore payment acceptance', {
      projectId: project.id, priority: 'urgent', assigneeOperatorId: null, cycleId: cycle.id, estimate: 8,
    });
    const lower = await create(team, 'Explain delayed settlement receipts', {
      projectId: project.id, priority: 'low', assigneeOperatorId: me, cycleId: cycle.id, estimate: 5,
    });
    const blocker = await create(provider, 'Resolve provider signature rejection');
    const lowerBlocker = await create(provider, 'Confirm settlement receipt format');
    for (const [issue, dependency] of [[urgent, blocker], [lower, lowerBlocker]]) {
      const current = await api('/issues/' + issue.identifier);
      await api('/issues/' + issue.identifier + '/dependencies', 'POST', {
        expectedVersion: current.version, relatedIdentifier: dependency.identifier,
        relatedVersion: dependency.version, direction: 'blocked-by',
      });
    }
    const projectPath = base + '/app/projects/' + project.id;
    const risks = page.locator('.project-risks');
    const row = kind => risks.locator(`li[data-risk-kind="${kind}"]`);
    const checkRisks = async health => {
      await page.getByRole('heading', { name, exact: true }).waitFor();
      await page.locator('.project-health--' + health).waitFor();
      await row('capacity').waitFor();
      await settleReads(page);
      assert.deepEqual((await risks.locator('li[data-risk-kind]').evaluateAll(items => items.map(item => item.dataset.riskKind))).sort(),
        (health === 'blocked' ? ['unresolved-dependency', 'target-date', 'unassigned-urgent', 'capacity'] : ['target-date', 'unassigned-urgent', 'capacity']).sort());
      assert((await row('target-date').innerText()).includes(yesterday), 'Risk identifies the actual elapsed target date');
      const capacity = await row('capacity').innerText();
      assert(capacity.includes(cycle.name), 'Risk identifies the actual cycle');
      assert.match(capacity, /\b13\s+remaining(?:\s+estimated)?\s+points\b/, 'Risk measures committed remaining scope');
      assert.match(capacity, /\bcapacity(?:\s+of)?\s+8\b/, 'Risk measures cycle capacity');
      await exactLinks(row('capacity'), [urgent.identifier, lower.identifier]);
      await exactLinks(row('unassigned-urgent'), [urgent.identifier]);
      if (health === 'blocked') await exactLinks(row('unresolved-dependency'), [urgent.identifier, blocker.identifier]);
      else assert.equal(await row('unresolved-dependency').count(), 0, 'Lower-priority blocked work does not trigger urgent dependency risk');
      await risks.scrollIntoViewIfNeeded();
      await fits();
      await record('PROJ-006', `${health}-${width}`, page);
    };

    await navigate(projectPath);
    await checkRisks('blocked');
    const blockerLink = row('unresolved-dependency').getByRole('link').filter({ hasText: blocker.identifier });
    await blockerLink.scrollIntoViewIfNeeded();
    await record('PROJ-006', `risk-links-${width}`, page);
    await beforePrivateNavigation(page, base + '/app/issues/' + blocker.identifier);
    await blockerLink.click();
    await page.waitForURL(base + '/app/issues/' + blocker.identifier);
    await page.getByRole('heading', { name: blocker.title, exact: true }).waitFor();
    await fits();
    const currentBlocker = await api('/issues/' + blocker.identifier);
    await api('/issues/' + blocker.identifier, 'PATCH', {
      expectedVersion: currentBlocker.version, statusId: status(provider, 'completed'),
    });
    await navigate(projectPath);
    await checkRisks('at-risk');
    await row('unassigned-urgent').scrollIntoViewIfNeeded();
    await record('PROJ-006', `at-risk-links-${width}`, page);
    await settleReads(page);
  }
}
