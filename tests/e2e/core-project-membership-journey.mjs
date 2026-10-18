import assert from 'node:assert/strict';
import { beforePrivateNavigation } from './collaboration-navigation.mjs';

export async function projectMembershipJourney(page, context, base, capture = async () => {}) {
  const api = async (path, method = 'GET', data) => {
    const response = await context.request.fetch(base + '/api' + path, { method, headers: { Origin: base }, ...(data === undefined ? {} : { data }) });
    assert(response.ok(), `${method} ${path}: ${response.status()} ${await response.text()}`);
    return response.json();
  };
  const navigate = async path => {
    await beforePrivateNavigation(page, base + path);
    await page.goto(base + path);
  };
  const me = (await api('/session')).operatorId;
  const team = (await api('/settings/administration')).teams.find(t => !t.archivedAt);
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    const name = `Payment reliability ${width} ${Date.now()}`;
    const state = await api('/settings/projects', 'POST', { name, leadOperatorId: me, description: 'Preserve every payment investigation when this rollout ends.' });
    const project = state.projects.find(p => p.name === name);
    const first = await api('/issues', 'POST', { title: 'Handle delayed payment confirmations', teamId: team.id, projectId: project.id });
    const second = await api('/issues', 'POST', { title: 'Explain settlement retries', teamId: team.id, projectId: project.id, description: 'Keep the settlement evidence.' });
    await navigate('/app/issues/' + first.identifier);
    const detached = page.waitForResponse(r => r.url() === base + '/api/issues/' + first.identifier && r.request().method() === 'PATCH');
    await page.getByLabel('Issue project', { exact: true }).selectOption('');
    assert.equal((await detached).status(), 200);
    assert.equal((await api('/issues/' + first.identifier)).project, null);
    await navigate('/app/projects/' + project.id);
    await page.getByText('Manage ' + name, { exact: true }).click();
    await page.getByRole('button', { name: 'Archive project', exact: true }).click();
    await page.getByRole('button', { name: 'Unarchive project', exact: true }).waitFor();
    assert.equal((await api('/issues/' + second.identifier)).project.id, project.id);
    await page.getByRole('button', { name: 'Delete project', exact: true }).click();
    await capture('PROJ-003', `confirm-delete-${width}`, page);
    await page.getByRole('button', { name: 'Cancel deletion', exact: true }).click();
    assert((await api('/settings/administration')).projects.some(p => p.id === project.id));
    await page.getByRole('button', { name: 'Delete project', exact: true }).click();
    await page.getByRole('button', { name: 'Delete project and keep issues', exact: true }).click();
    await page.waitForURL(base + '/app/projects');
    await page.getByRole('heading', { name: 'Projects', exact: true }).waitFor();
    assert(!(await api('/settings/administration')).projects.some(p => p.id === project.id));
    await capture('PROJ-003', `deleted-portfolio-${width}`, page);
    for (const original of [first, second]) {
      const issue = await api('/issues/' + original.identifier);
      assert.equal(issue.id, original.id);
      assert.equal(issue.title, original.title);
      assert.equal(issue.project, null);
    }
    await navigate('/app/issues/' + second.identifier);
    await page.getByRole('heading', { name: second.title, exact: true }).waitFor();
    await page.getByText('Keep the settlement evidence.', { exact: true }).waitFor();
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await capture('PROJ-003', `retained-issue-${width}`, page);
  }
}
