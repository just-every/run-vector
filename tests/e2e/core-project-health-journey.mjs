import assert from 'node:assert/strict';
import { beforePrivateNavigation, settleReads } from './collaboration-navigation.mjs';

export async function projectHealthJourney(page, context, base, record = async () => {}) {
  const api = async (path, method = 'GET', data) => {
    const response = await context.request.fetch(base + '/api' + path, { method, headers: { Origin: base }, ...(data === undefined ? {} : { data }) });
    assert(response.ok(), `${method} ${path}: ${response.status()}`);
    return response.json();
  };
  const me = (await api('/session')).operatorId;
  const suffix = String(Date.now());
  const name = 'Checkout recovery ' + suffix;
  const future = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  const state = await api('/settings/projects', 'POST', { name, leadOperatorId: me, description: 'Keep payment confirmations available during provider delays.', targetDate: future });
  const project = state.projects.find(p => p.name === name);
  await api('/settings/projects/' + project.id, 'PATCH', { lifecycle: 'active' });
  await api('/settings', 'PATCH', { timezone: 'UTC' });
  const prefix = 'PH' + suffix.slice(-6).replaceAll(/\d/g, n => String.fromCharCode(65 + Number(n)));
  const teams = await api('/settings/teams', 'POST', { name: 'Payments ' + suffix, identifierPrefix: prefix });
  const team = teams.teams.find(t => t.identifierPrefix === prefix);
  const local = days => new Date(Date.now() + days * 86400000).toISOString().slice(0, 16);
  const cycles = await api('/settings/cycles', 'POST', { teamId: team.id, name: 'Provider recovery ' + suffix, startsLocal: local(-1), endsLocal: local(6), capacity: 8 });
  const cycle = cycles.cycles.find(c => c.teamId === team.id);
  for (const [title, estimate] of [['Reconcile delayed confirmations', 5], ['Explain recovered provider retries', 3]])
    await api('/issues', 'POST', { teamId: team.id, title, projectId: project.id, assigneeOperatorId: me, cycleId: cycle.id, estimate });

  const filter = async value => {
    const saved = page.waitForResponse(r => r.url() === base + '/api/preferences/projects' && r.request().method() === 'PUT');
    await page.getByRole('combobox', { name: 'Health', exact: true }).selectOption(value);
    const response = await saved;
    assert.equal(response.status(), 200);
    assert.equal((await response.json()).filters.health, value);
    assert.equal(await response.finished(), null);
  };
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    const path = base + '/app/projects/' + project.id;
    await beforePrivateNavigation(page, path); await page.goto(path);
    await page.getByRole('heading', { name, exact: true }).waitFor();
    await page.locator('.project-health--on-track').waitFor();
    await page.locator('summary').filter({ hasText: 'Manage ' + name }).click();
    const form = page.getByRole('form', { name: 'Edit project ' + name, exact: true });
    await form.getByLabel('Target date').fill('');
    const saved = page.waitForResponse(r => r.url() === base + '/api/settings/projects/' + project.id && r.request().method() === 'PATCH');
    await form.getByRole('button', { name: 'Save project', exact: true }).click();
    assert.equal((await saved).status(), 200);
    await page.locator('.project-health--unknown').waitFor();
    await page.locator('.project-health-explanation').getByText(/target date/).waitFor();
    assert.equal((await api('/projects/' + project.id)).health, 'unknown');
    await page.locator('.project-health-explanation').scrollIntoViewIfNeeded();
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await record('PROJ-005', `unknown-${width}`, page);
    await form.getByLabel('Target date').fill(future);
    const restored = page.waitForResponse(r => r.url() === base + '/api/settings/projects/' + project.id && r.request().method() === 'PATCH');
    await form.getByRole('button', { name: 'Save project', exact: true }).click();
    assert.equal((await restored).status(), 200);
    await page.locator('.project-health--on-track').waitFor();
    await page.locator('.project-health-explanation').scrollIntoViewIfNeeded();
    await record('PROJ-005', `on-track-${width}`, page);
    await beforePrivateNavigation(page, base + '/app/projects'); await page.goto(base + '/app/projects');
    await page.getByRole('heading', { name: 'Projects', exact: true }).waitFor();
    await filter('on-track');
    await page.getByRole('link', { name: 'Open ' + name, exact: true }).locator('.project-health--on-track').waitFor();
    await filter('unknown');
    await page.getByRole('link', { name: 'Open ' + name, exact: true }).waitFor({ state: 'detached' });
    await filter('all');
    await page.getByRole('link', { name: 'Open ' + name, exact: true }).waitFor();
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await record('PROJ-005', `portfolio-${width}`, page);
    await settleReads(page);
  }
}
