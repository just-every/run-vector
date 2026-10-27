import { chromium } from '@playwright/test';

// Use this checkout's bundled headless shell and Playwright's default arguments.
// A real launch decides whether the hosted runner needs apt, not a library list.
const browser = await chromium.launch({
  headless: true,
  args: ['--use-mock-keychain', '--password-store=basic'],
  timeout: 30_000,
});
try {
  const page = await browser.newPage();
  await page.setContent('<title>Chromium launch probe</title>');
  if (await page.title() !== 'Chromium launch probe') throw Error('Chromium probe failed.');
} finally {
  await browser.close();
}
