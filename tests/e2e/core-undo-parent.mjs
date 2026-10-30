import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { withOperatorClient } from './operator-request.mjs';
import { beforePrivateNavigation, settleReads } from './collaboration-navigation.mjs';
import { verificationDirectory } from '../../scripts/verification-paths.mjs';
const require = createRequire(import.meta.url);

export async function undoParentJourney(page, context, base, record) {
  const viewport = page.viewportSize();
  await page.setViewportSize({ width: 1440, height: 1000 });
  const api = (path, method = 'GET', data) => withOperatorClient(context, async client => {
    const response = await client.fetch(base + '/api' + path, { method, headers: { Origin: base }, ...(data === undefined ? {} : { data }) });
    assert(response.ok(), `${method} ${path}: ${response.status()} ${await response.text()}`);
    return response.json();
  });
  const options = await api('/options'), team = options.teams[0];
  const create = title => api('/issues', 'POST', { teamId: team.id, title });
  const parent = await create('synthetic-vector-2020'), other = await create('synthetic-vector-2021');
  const child = await create('synthetic-vector-2022'), sibling = await create('synthetic-vector-2023');
  const read = id => api('/issues/' + id);
  const children = id => api('/issues/' + id + '/subissues');
  await api('/issues/' + sibling.identifier + '/parent', 'PATCH', { expectedVersion: sibling.version, parentIdentifier: parent.identifier });
  await beforePrivateNavigation(page, base + '/app/issues/' + child.identifier);
  await page.goto(base + '/app/issues/' + child.identifier);
  await page.getByRole('heading', { name: 'synthetic-vector-2022', exact: true }).waitFor();
  await settleReads(page);
  const hierarchy = page.getByRole('region', { name: 'Issue hierarchy', exact: true });
  const notice = page.getByRole('region', { name: 'Issue Undo', exact: true });
  async function save(destination) {
    await settleReads(page);
    await hierarchy.getByRole('button', { name: /^(Set|Change) parent$/ }).click();
    if (destination) {
      const search = hierarchy.getByRole('searchbox', { name: 'Search parent issues', exact: true });
      await search.fill(destination);
      await hierarchy.getByRole('button', { name: 'Search', exact: true }).press('Enter');
      await hierarchy.getByRole('list', { name: 'Matching parent issues' }).getByRole('button').filter({ hasText: destination }).click();
    }
    const [response] = await Promise.all([
      page.waitForResponse(r => new URL(r.url()).pathname === '/api/issues/' + child.identifier + '/parent' && r.request().method() === 'PATCH'),
      hierarchy.getByRole('button', { name: destination ? 'Save parent' : 'Clear parent', exact: true }).press('Enter'),
    ]);
    assert.equal(response.status(), 200);
    const receipt = JSON.parse(response.headers()['x-vector-undo']);
    assert.deepEqual(receipt.identifiers, [child.identifier]);
    await notice.getByRole('button', { name: 'Undo', exact: true }).waitFor();
    return receipt;
  }
  async function reverse(receipt, expected, key) {
    if (key) await page.getByRole('heading', { name: 'synthetic-vector-2022', exact: true }).click();
    const [response] = await Promise.all([
      page.waitForResponse(r => new URL(r.url()).pathname === '/api/issues/undo'),
      key ? page.keyboard.press(key) : notice.getByRole('button', { name: 'Undo', exact: true }).click(),
    ]);
    assert.equal(response.status(), 200);
    const current = await read(child.identifier);
    assert.equal(current.parent?.identifier ?? null, expected);
    assert.equal(current.activity.filter(row => row.nextValue?.undoOf === receipt.actionId).length, 1);
    await settleReads(page);
    if (expected) await hierarchy.getByRole('link', { name: new RegExp('^Parent ' + expected + ':') }).waitFor();
    else assert.equal(await hierarchy.getByRole('link').count(), 0);
  }
  let receipt = await save(parent.identifier);
  const evidence = verificationDirectory + '/issue-undo';
  await mkdir(evidence, { recursive: true });
  const axe = await readFile(require.resolve('axe-core/axe.min.js'), 'utf8');
  await page.evaluate(source => { const script = document.createElement('script'); script.nonce = document.querySelector('script[nonce]')?.nonce ?? ''; script.textContent = source; document.head.append(script); }, axe);
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Parent and Undo controls fit the viewport');
    assert.deepEqual(await page.evaluate(async () => (await window.axe.run(document.querySelector('main'))).violations.filter(row => ['serious', 'critical'].includes(row.impact)).map(row => row.id)), []);
    for (const controls of [hierarchy, notice]) assert(await controls.locator('button').evaluateAll(nodes => nodes.every(node => Number.parseFloat(getComputedStyle(node).fontSize) >= 13)), 'Reused controls retain readable text');
    await page.screenshot({ path: `${evidence}/parent-offer-${width}.png`, fullPage: true });
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await reverse(receipt, null);
  receipt = await save(parent.identifier);
  await settleReads(page);
  let ordered = await children(parent.identifier);
  await api('/issues/' + parent.identifier + '/subissues', 'PATCH', { expectedVersion: ordered.version, identifiers: [child.identifier, sibling.identifier] });
  await beforePrivateNavigation(page, page.url()); await page.reload();
  await page.getByRole('heading', { name: 'synthetic-vector-2022', exact: true }).waitFor();
  await settleReads(page);
  const origin = await page.evaluate(() => performance.timeOrigin);
  receipt = await save(other.identifier);
  // An editable control retains native text Undo; the session's action remains.
  await hierarchy.getByRole('button', { name: 'Change parent', exact: true }).click();
  await hierarchy.getByRole('searchbox', { name: 'Search parent issues', exact: true }).focus();
  const requests = [], watch = request => { if (request.url() === base + '/api/issues/undo') requests.push(request); };
  page.on('request', watch); await page.keyboard.press('Control+z'); page.off('request', watch);
  assert.equal(requests.length, 0);
  await hierarchy.getByRole('button', { name: 'Cancel', exact: true }).click();
  await reverse(receipt, parent.identifier, 'Control+z');
  assert.deepEqual((await children(parent.identifier)).children.map(row => row.identifier), [child.identifier, sibling.identifier]);
  assert.equal((await children(other.identifier)).total, 0);
  receipt = await save(null);
  await reverse(receipt, parent.identifier, 'Meta+z');
  assert.deepEqual((await children(parent.identifier)).children.map(row => row.identifier), [child.identifier, sibling.identifier]);
  assert.equal(await page.evaluate(() => performance.timeOrigin), origin, 'The explicit proof reload is the only document replacement');
  record('ISSUE-020', 'Native parent set, change and clear offer the current Undo control; the control and both keyboard shortcuts restore the previous relation and first sibling position with one attributed reversal. Editable text owns its Undo; parent and Undo controls are inspected at 1440 and 390.');
  await page.setViewportSize(viewport);
}
