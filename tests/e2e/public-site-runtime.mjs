import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import { verificationDirectory } from '../../scripts/verification-paths.mjs';
import { inspectHome, serveSite, visitPublicPage } from './public-site-support.mjs';

// One public journey against the generated marketing site, never the installed Lobby.
// Build first: pnpm exec rer build --site
const site = await serveSite('dist/site');
let browser;
try {
  browser = await chromium.launch({ headless: true });
  const raw = await fetch(site.origin);
  assert.equal(raw.status, 200);
  assert.equal(raw.headers.get('set-cookie'), null);
  const html = await raw.text();
  // Parse the response without scripts: this cannot be satisfied by client rendering.
  const rawContext = await browser.newContext({ javaScriptEnabled: false });
  let home;
  try {
    const page = await rawContext.newPage();
    await page.route('**/*', route => route.abort());
    await page.setContent(html);
    home = await inspectHome(page);
  } finally { await rawContext.close(); }

  const pages = [];
  pages.push(await visitPublicPage(browser, site.origin, '/', async page => {
    await inspectHome(page);
    await page.setViewportSize({ width: 390, height: 844 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'public homepage fits a phone');
    return {};
  }));
  const docs = await visitPublicPage(browser, site.origin, '/docs', async page => {
    assert.ok(await page.locator('main h1').innerText(), 'docs index has its rendered title');
    const guides = await page.locator('main article a[href^="/docs/"]').evaluateAll(links => [...new Set(links.map(link => link.getAttribute('href')))]);
    assert.ok(guides.length, 'docs index exposes readable guides');
    return { guides };
  });
  pages.push(docs);
  for (const path of docs.guides) {
    pages.push(await visitPublicPage(browser, site.origin, path, async page => {
      assert.ok(await page.locator('main article h1').innerText(), `${path} has a rendered guide title`);
      assert.ok(await page.locator('main article p').count(), `${path} contains guide prose`);
      return {};
    }));
  }
  pages.push(await visitPublicPage(browser, site.origin, '/run', async page => {
    assert.ok(await page.locator('main pre code').count(), 'Run action reaches usable local commands');
    return {};
  }));
  const evidence = `${verificationDirectory}/public-site`;
  await mkdir(evidence, { recursive: true });
  const report = { passed: true, node: process.version, target: 'dist/site (src/site/pages.tsx)', rawHome: home, pages };
  await writeFile(`${evidence}/result.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  if (browser) await browser.close();
  await site.close();
}
