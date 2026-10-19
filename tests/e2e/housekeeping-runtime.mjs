import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';
import { createAdminRuntime, bootstrapOwner } from './admin-runtime-support.mjs';
import { writeRuntimeD1 } from './runtime-d1.mjs';
import { beforePrivateNavigation, settleReads } from './collaboration-navigation.mjs';
// AUTO-003: periods are set and previewed in Settings; the scheduled run closes and archives; archived issues leave lists.
const output = resolve(process.env.VECTOR_HOUSEKEEPING_SHOTS ?? '.artifacts/verification/housekeeping');
await mkdir(output, { recursive: true });
const runtime = createAdminRuntime(1440, [], { port: 15980, inspectorPort: 15981 });
let browser, page;
const go = async path => { await beforePrivateNavigation(page, runtime.base + path); await page.goto(runtime.base + path); await page.locator('main:visible').first().waitFor(); await settleReads(page); };
const overflow = async () => assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no horizontal overflow');
try {
  runtime.initialize(); await runtime.start();
  browser = await chromium.launch({ headless: true, args: ['--use-mock-keychain', '--password-store=basic'] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  page = await context.newPage(); page.setDefaultTimeout(20000);
  await bootstrapOwner(page, runtime);
  const api = context.request, headers = { Origin: runtime.base };
  const team = (await (await api.get(runtime.base + '/api/settings/administration')).json()).teams[0];
  const status = category => team.statuses.find(s => s.category === category).id;
  const create = async (title, category) => {
    const response = await api.post(runtime.base + '/api/issues', { headers, data: { title, teamId: team.id, statusId: status(category) } });
    assert.equal(response.status(), 201); return response.json();
  };
  const stale = await create('Follow up on the courier damage claim', 'backlog');
  const done = await create('Publish the September carrier scorecard', 'completed');
  const ago = days => new Date(Date.now() - days * 86400000).toISOString();
  await writeRuntimeD1(runtime.base, [
    { sql: 'UPDATE issues SET updated_at=?,created_at=? WHERE id=?', params: [ago(31), ago(31), stale.id] },
    { sql: 'UPDATE issues SET updated_at=?,created_at=?,completed_at=? WHERE id=?', params: [ago(91), ago(91), ago(91), done.id] },
    { sql: 'UPDATE issue_activity SET created_at=?,updated_at=? WHERE issue_id=?', params: [ago(31), ago(31), stale.id] },
    { sql: 'UPDATE issue_activity SET created_at=?,updated_at=? WHERE issue_id=?', params: [ago(91), ago(91), done.id] },
  ]);
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    await go('/app/settings#housekeeping');
    const form = page.getByRole('form', { name: `Auto-close and auto-archive ${team.name}` });
    await form.getByLabel('Auto-close after (days without activity)').fill('30');
    await form.getByLabel('Auto-archive after (days since closed)').fill('90');
    await form.getByRole('button', { name: 'Preview', exact: true }).click();
    const preview = page.getByRole('status', { name: `Preview for ${team.name}` });
    await preview.getByRole('heading', { name: 'Would close 1' }).waitFor();
    await preview.getByRole('heading', { name: 'Would archive 1' }).waitFor();
    assert.ok((await preview.innerText()).includes(stale.identifier) && (await preview.innerText()).includes(done.identifier));
    const saved = page.waitForResponse(r => r.url().endsWith('/housekeeping') && r.request().method() === 'PUT');
    await form.getByRole('button', { name: 'Save automation' }).click(); assert.equal((await saved).status(), 200);
    await page.locator('#housekeeping').getByText('Saved.', { exact: true }).waitFor(); await settleReads(page); await preview.scrollIntoViewIfNeeded(); await page.screenshot({ path: `${output}/settings-preview-${width}.png` }); await overflow();
  }
  const tick = await api.get(runtime.base + '/cdn-cgi/local/scheduled?cron=' + encodeURIComponent('* * * * *'));
  assert.equal(tick.status(), 200); await tick.body();
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    await go('/app/issues/' + done.identifier);
    await page.getByRole('note').filter({ hasText: 'Archived' }).waitFor();
    await page.screenshot({ path: `${output}/archived-issue-${width}.png` }); await overflow();
    await go('/app/issues/' + stale.identifier);
    await page.getByRole('heading', { name: stale.title }).waitFor();
    assert.equal((await (await api.get(runtime.base + '/api/issues/' + stale.identifier)).json()).category, 'canceled');
    await go('/app/issues?category=completed');
    assert.equal(await page.getByText(done.title).count(), 0, 'archived issue left the completed list');
    await go('/app/search');
    await page.getByLabel(/Include archived/).uncheck(); await page.getByLabel('Search workspace').fill(done.title); await settleReads(page);
    assert.equal(await page.getByRole('link', { name: new RegExp(done.identifier) }).count(), 0, 'default search leaves archived issues out');
    await page.getByLabel(/Include archived/).check(); await page.getByRole('link', { name: new RegExp(done.identifier) }).first().waitFor();
    await page.screenshot({ path: `${output}/search-archived-${width}.png` }); await overflow();
  }
  console.log('[AUTO-003] preview, save, scheduled close and archive, archived page, lists and search at 1440/390');
} catch (error) { if (page) await page.screenshot({ path: output + '/failure.png' }).catch(() => {}); throw error; }
finally { if (browser) await browser.close(); await runtime.stop(); }
