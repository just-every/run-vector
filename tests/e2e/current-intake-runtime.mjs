import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { freePort } from '@runeditrun/rer/adapter-settings';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createAdminRuntime, bootstrapOwner } from './admin-runtime-support.mjs';
import { currentIntakePaginationJourney } from './core-current-intake-pagination-journey.mjs';
import { settleReads } from './collaboration-navigation.mjs';
import { verificationDirectory } from '../../scripts/verification-paths.mjs';

// This journey intentionally creates and defers more than two pages of work.
// Own the real installation so its request volume never affects other journeys.
const runtime = createAdminRuntime(1440, [], { port: await freePort(), inspectorPort: 0 });
const captures = resolve(verificationDirectory, 'intake-queue');
let browser;
try {
  await mkdir(captures, { recursive: true });
  runtime.initialize();
  await runtime.start();
  browser = await chromium.launch({ headless: true, args: ['--use-mock-keychain', '--password-store=basic'] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const pageErrors = [], consoleErrors = [], failedRequests = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('requestfailed', request => failedRequests.push(new URL(request.url()).pathname));
  await bootstrapOwner(page, runtime);
  await currentIntakePaginationJourney(page, context, runtime.base, async (_id, name, currentPage) => {
    await currentPage.screenshot({ path: resolve(captures, name + '.png') });
  });
  await settleReads(page);
  assert.deepEqual(pageErrors, [], 'browser page errors');
  assert.deepEqual(consoleErrors, [], 'browser console errors');
  assert.deepEqual(failedRequests, [], 'browser failed requests');
  console.log('[CURR-002] Independent intake queue journey passed at 1440 and 390.');
} finally {
  await browser?.close();
  await runtime.stop();
}
