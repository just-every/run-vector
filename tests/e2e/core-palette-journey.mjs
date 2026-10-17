import assert from 'node:assert/strict';
import { settleReads } from './collaboration-navigation.mjs';

export async function paletteJourney(page, context, base, record, capture) {
  const stamp = Date.now();
  const marker = `Palette ${stamp}`;
  const viewName = `Private keyboard view ${stamp}`;
  const [optionsResponse, createdView] = await Promise.all([
    context.request.get(base + '/api/options'),
    context.request.post(base + '/api/views', {
      headers: { Origin: base }, data: { name: viewName, isShared: false, layout: 'list', query: {} },
    }),
  ]);
  assert.equal(optionsResponse.status(), 200);
  assert.equal(createdView.status(), 201);
  const options = await optionsResponse.json();
  const view = await createdView.json();
  const team = options.teams[0];
  const status = options.statuses.find(status => status.teamId === team?.id && status.category === 'backlog');
  assert.ok(team && status, 'Real workspace supplies a team backlog');
  const projectName = `Keyboard project ${stamp}`;
  const [createdProject, issues] = await Promise.all([
    context.request.post(base + '/api/settings/projects', {
      headers: { Origin: base }, data: { name: projectName, leadOperatorId: options.operator.id },
    }),
    Promise.all(Array.from({ length: 16 }, async (_, index) => {
      const response = await context.request.post(base + '/api/issues', {
        headers: { Origin: base },
        data: { title: `Open ${marker} ${index + 1}`, teamId: team.id, statusId: status.id },
      });
      assert.equal(response.status(), 201);
      return response.json();
    })),
  ]);
  assert.equal(createdProject.status(), 200);
  const project = (await createdProject.json()).projects.find(project => project.name === projectName);
  assert.ok(project);
  const palette = page.getByRole('dialog', { name: 'Command palette', exact: true });
  const search = palette.getByRole('textbox');
  const results = palette.locator('.command-palette__results');
  const open = async () => {
    await settleReads(page);
    await page.locator('h1:visible').first().click();
    await page.keyboard.press('Control+k');
    await palette.waitFor();
  };
  const find = async term => {
    await search.fill(term);
    await settleReads(page);
    await palette.locator('.command-palette__results[aria-busy="false"]').waitFor();
  };
  const selected = async id => {
    await page.waitForFunction(id => {
      const input = document.querySelector('.command-palette input');
      const option = document.getElementById(id);
      return document.activeElement === input && input?.getAttribute('aria-activedescendant') === id &&
        option?.getAttribute('aria-selected') === 'true';
    }, id);
    assert.equal(await results.evaluate((container, id) => {
      const option = document.getElementById(id).getBoundingClientRect();
      const viewport = container.getBoundingClientRect();
      return option.top >= viewport.top - 1 && option.bottom <= viewport.bottom + 1;
    }, id), true, 'The selected option is visible inside the scroll container while the input keeps focus');
  };
  await open();
  await find(marker);
  const ids = await palette.getByRole('option').evaluateAll(nodes => nodes.map(node => node.id));
  assert.equal(ids.length, issues.length);
  assert.equal(await results.evaluate(node => node.scrollHeight > node.clientHeight), true, 'Real matching issues overflow the results');
  await selected(ids[0]);
  await search.press('ArrowUp');
  await selected(ids.at(-1));
  await search.press('ArrowDown');
  await selected(ids[0]);
  for (const id of ids.slice(1)) {
    await search.press('ArrowDown');
    await selected(id);
  }
  await capture?.('palette-overflow');
  await search.press('ArrowUp');
  await selected(ids.at(-2));
  const unchanged = page.url();
  await search.press('Escape');
  await palette.waitFor({ state: 'detached' });
  assert.equal(page.url(), unchanged, 'Escape closes a highlighted result without navigation');

  await open();
  await find(marker);
  await search.press('ArrowDown');
  await selected(ids[1]);
  const issue = issues.find(issue => `palette-issue:${issue.id}` === ids[1]);
  assert.ok(issue);
  await search.press('Enter');
  await page.waitForURL(base + '/app/issues/' + issue.identifier);
  await page.getByRole('heading', { name: issue.title, exact: true }).waitFor();
  await palette.waitFor({ state: 'detached' });

  // Delay only the real search request. Its native response must prepend records
  // without transferring the selected command's old index to a different record.
  await open();
  const firstCommandId = await palette.getByRole('option').first().getAttribute('id');
  await search.press('ArrowDown');
  await search.press('ArrowDown');
  const searchUrl = base + '/api/search?q=Open';
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  const holdSearch = async route => { await pending; await route.continue(); };
  await page.route(searchUrl, holdSearch);
  try {
    const intercepted = page.waitForRequest(searchUrl);
    await search.fill('Open');
    await intercepted;
    await selected(firstCommandId);
    await search.press('ArrowUp');
    const commandId = await search.getAttribute('aria-activedescendant');
    await selected(commandId);
    release();
    await settleReads(page);
    assert.ok(await palette.locator('[id^="palette-issue:"]').count() > 0, 'Real asynchronous records arrived before the commands');
    await selected(commandId);
    await search.press('Enter');
    await page.waitForURL(base + '/app/projects');
    await palette.waitFor({ state: 'detached' });
  } finally {
    release();
    await page.unroute(searchUrl, holdSearch);
  }

  await open();
  await find(project.name);
  const projectId = `palette-project:${project.id}`;
  const projectIds = await palette.getByRole('option').evaluateAll(nodes => nodes.map(node => node.id));
  assert.ok(projectIds.includes(projectId));
  for (let step = 0; step < projectIds.length && await search.getAttribute('aria-activedescendant') !== projectId; step++)
    await search.press('ArrowDown');
  await selected(projectId);
  await search.press('Enter');
  await page.waitForURL(base + '/app/projects/' + project.id);
  await page.getByRole('heading', { name: project.name, exact: true }).waitFor();
  await palette.waitFor({ state: 'detached' });

  await open();
  await find(marker);
  await search.press('ArrowUp');
  await selected(ids.at(-1));
  await find(viewName);
  await selected(`palette-view:${view.id}`);
  await capture?.('palette-search');
  await search.press('Enter');
  await page.waitForURL(base + '/app/views/' + view.id);
  await page.getByRole('heading', { name: viewName, exact: true }).waitFor();
  await palette.waitFor({ state: 'detached' });
  record('CMD-001', 'Up/down wrap and scroll overflowing real results while input focus stays put; query changes reset selection, asynchronous results preserve the selected command, Enter opens an issue/project/view and executes a command, and Escape leaves the URL unchanged.');
  record('VIEW-002-PALETTE', 'A real newly created private saved view is found by palette search and Enter opens its persisted view page.');
}
