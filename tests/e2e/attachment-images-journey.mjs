import assert from 'node:assert/strict';
import { expect } from '@playwright/test';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import { navigate } from './collaboration-navigation.mjs';
const require = createRequire(import.meta.url);

export async function attachmentImagesJourney({ page, runtime, output, returnIssue }) {
  await mkdir(output, {recursive: true});
  const base = runtime.base, errors = [], outbound = [];
  const error = value => errors.push(String(value));
  const request = value => { if (value.url().startsWith('https://remote.example.test/')) outbound.push(value.url()); };
  page.on('pageerror', error); page.on('request', request);
  const png = async (width, height, color) => Buffer.from(await page.evaluate(({width, height, color}) => {
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
    const context = canvas.getContext('2d'); context.fillStyle = color; context.fillRect(0, 0, width, height);
    return canvas.toDataURL('image/png').split(',')[1];
  }, {width, height, color}), 'base64');
  const save = async action => {
    const pending = page.waitForResponse(response => response.request().method() === 'PATCH' && new URL(response.url()).pathname === '/api/issues/' + identifier);
    await action(); const response = await pending; assert.equal(response.status(), 200); return response.json();
  };
  let identifier;
  try {
    await navigate(page, base + '/app/new-issue');
    await page.getByLabel('Title', {exact: true}).fill('synthetic-vector-2412');
    await page.getByLabel('Description', {exact: true}).fill('![Remote screenshot](https://remote.example.test/synthetic-vector-2411.png)');
    const created = page.waitForResponse(response => new URL(response.url()).pathname === '/api/issues' && response.request().method() === 'POST');
    await page.getByRole('button', {name: 'Create issue', exact: true}).click();
    const issue = await (await created).json(); identifier = issue.identifier;
    await page.getByRole('heading', {name: 'synthetic-vector-2412', exact: true}).waitFor();
    const buffers = [await png(1600, 900, '#4c6f9a'), await png(64, 48, '#b56542')], files = [];
    for (let i = 0; i < buffers.length; i++) {
      const upload = page.waitForResponse(response => response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/issues/' + identifier + '/files');
      await page.getByLabel('Attach a file', {exact: true}).setInputFiles({name: 'synthetic-vector-' + (2413 + i) + '.png', mimeType: 'image/png', buffer: buffers[i]});
      const response = await upload; assert.equal(response.status(), 201);
      const file = await response.json(); files.push(file);
      await expect(page.locator('.issue-files').getByRole('link', {name: file.name, exact: true})).toBeVisible();
      const read = await page.request.get(base + '/api/issues/' + identifier + '/files/' + file.id);
      assert.equal(read.status(), 200); assert.deepEqual(await read.body(), buffers[i]);
      assert.match(read.headers()['content-disposition'], /^attachment;/);
      assert.equal(read.headers()['x-content-type-options'], 'nosniff');
      assert.equal(read.headers()['cache-control'], 'private, no-store');
    }
    await page.getByRole('button', {name: 'Edit issue', exact: true}).click();
    for (let i = 0; i < files.length; i++) {
      await page.getByLabel('Image attachment', {exact: true}).selectOption(files[i].id);
      await page.getByLabel('Image alt text', {exact: true}).fill('Screenshot ' + (i + 1));
      await page.getByRole('button', {name: 'Insert image', exact: true}).click();
    }
    const inserted = await save(() => page.getByRole('button', {name: 'Save changes', exact: true}).click());
    for (const file of files) assert.ok(inserted.description.includes('(attachment:' + file.id + ')'));
    await page.reload();
    const description = page.locator('.issue-description'), first = description.getByRole('img', {name: 'Screenshot 1', exact: true});
    await expect(first).toBeVisible();
    await expect.poll(() => first.evaluate(image => image.complete && image.naturalWidth)).toBe(1600);
    assert.equal(await first.getAttribute('width'), '1600'); assert.equal(await first.getAttribute('height'), '900');
    assert.equal(await first.getAttribute('src'), '/api/issues/' + identifier + '/files/' + files[0].id);
    assert.equal(await description.getByRole('button', {name: /^Load image/}).count(), 1);
    assert.equal(await description.getByRole('img').count(), 2);
    assert.equal(await first.evaluate(image => image.getBoundingClientRect().width <= image.closest('.safe-markdown').getBoundingClientRect().width), true);
    await page.getByRole('button', {name: 'Open image: Screenshot 1', exact: true}).focus(); await page.keyboard.press('Enter');
    const viewer = page.getByRole('dialog', {name: 'Image viewer', exact: true});
    await expect(viewer).toBeVisible();
    await page.getByRole('button', {name: 'Zoom in', exact: true}).click();
    await expect(viewer.getByLabel('Image zoom', {exact: true})).toHaveText('125%');
    await page.keyboard.press('ArrowRight');
    await expect(viewer.getByRole('img')).toHaveAttribute('src', '/api/issues/' + identifier + '/files/' + files[1].id);
    await expect(viewer.getByLabel('Image zoom', {exact: true})).toHaveText('100%');
    await page.keyboard.press('ArrowLeft');
    await expect(viewer.getByRole('img')).toHaveAttribute('src', '/api/issues/' + identifier + '/files/' + files[0].id);
    const download = page.waitForEvent('download');
    await viewer.getByRole('link', {name: 'Download image', exact: true}).click();
    assert.equal((await download).suggestedFilename(), files[0].name);
    await page.addScriptTag({path: require.resolve('axe-core/axe.min.js')});
    const audit = () => page.evaluate(async () => (await window.axe.run(document)).violations.filter(value => ['serious', 'critical'].includes(value.impact)).map(value => ({id: value.id, targets: value.nodes.map(node => node.target)})));
    assert.deepEqual(await audit(), []);
    await page.screenshot({path: output + '/viewer-1440.png'});
    await page.setViewportSize({width: 390, height: 844});
    await page.screenshot({path: output + '/viewer-390.png'});
    await page.keyboard.press('Escape'); await expect(viewer).toHaveCount(0);
    await expect(page.getByRole('button', {name: 'Open image: Screenshot 1', exact: true})).toBeFocused();
    await page.screenshot({path: output + '/inline-390.png', fullPage: true});
    await page.setViewportSize({width: 1440, height: 1000});
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({path: output + '/inline-1440.png', fullPage: true});

    // Alt text is ordinary editable Markdown, retained by the native editor.
    await page.getByRole('button', {name: 'Edit issue', exact: true}).click();
    await page.getByLabel('Description', {exact: true}).fill(inserted.description.replace('Screenshot 1', 'Updated screenshot'));
    const updated = await save(() => page.getByRole('button', {name: 'Save changes', exact: true}).click());
    await expect(description.getByRole('img', {name: 'Updated screenshot', exact: true})).toBeVisible();
    await page.getByRole('button', {name: 'Edit issue', exact: true}).click();
    await page.getByLabel('Description', {exact: true}).fill('synthetic-vector-2415');
    await save(() => page.getByRole('button', {name: 'Save changes', exact: true}).click());
    assert.equal((await page.request.get(base + '/api/issues/' + identifier + '/files/' + files[0].id)).status(), 200);
    // Delete using Files; restoring its older text must not resurrect its bytes.
    const fileList = page.locator('.issue-files'); await fileList.locator('summary').click();
    const entry = fileList.locator('.file-entry').filter({has: page.getByRole('link', {name: files[0].name, exact: true})});
    const removed = page.waitForResponse(response => response.request().method() === 'DELETE' && response.url().endsWith('/files/' + files[0].id));
    await entry.getByRole('button', {name: 'Remove file', exact: true}).click(); assert.equal((await removed).status(), 200);
    await expect(fileList.getByRole('link', {name: files[0].name, exact: true})).toHaveCount(0);
    const history = page.locator('.description-history'); await history.locator('summary').click();
    const historyResponse = await page.request.get(base + '/api/issues/' + identifier + '/description-history');
    const revisions = (await historyResponse.json()).revisions;
    const retained = revisions.find(revision => revision.description === updated.description); assert.ok(retained);
    await page.getByLabel('Compare from revision', {exact: true}).selectOption(retained.id);
    const restore = page.waitForResponse(response => response.url().endsWith('/description-restore') && response.request().method() === 'POST');
    await page.getByRole('button', {name: 'Restore earlier revision', exact: true}).click(); assert.equal((await restore).status(), 200);
    await expect(description.getByText('File removed', {exact: true})).toBeVisible();
    await expect(description.getByRole('img', {name: 'Screenshot 2', exact: true})).toBeVisible();
    await page.reload(); await expect(description.getByText('File removed', {exact: true})).toBeVisible();
    assert.equal((await page.request.get(base + '/api/issues/' + identifier + '/files/' + files[0].id)).status(), 404);

    // Caller URLs and another issue's attachment never become automatic embeds.
    await navigate(page, base + '/app/issues/' + returnIssue.identifier);
    await page.getByRole('button', {name: 'Edit issue', exact: true}).click();
    await page.getByLabel('Description', {exact: true}).fill(returnIssue.description + '\n\n![foreign](attachment:' + files[1].id + ')\n\n![unsafe](javascript:alert(1))');
    const foreignSave = page.waitForResponse(response => response.request().method() === 'PATCH' && response.url().endsWith('/api/issues/' + returnIssue.identifier));
    await page.getByRole('button', {name: 'Save changes', exact: true}).click(); assert.equal((await foreignSave).status(), 200);
    await expect(page.locator('.issue-description').getByText('File removed', {exact: true})).toBeVisible();
    assert.equal(await page.locator('.issue-description img').count(), 0);
    assert.equal((await page.request.get(base + '/api/issues/' + returnIssue.identifier + '/files/' + files[1].id)).status(), 404);
    assert.deepEqual(outbound, []); assert.deepEqual(errors, []);
    console.log('PROBE ISSUE-024 PNG: rendered upload, exact bytes and ID, reload, dimensions, editable alt, viewer zoom and two-image keyboard navigation, download, retained attachment, removed-file revision marker and foreign-reference refusal PASS');
  } finally {
    page.off('pageerror', error); page.off('request', request);
    await page.setViewportSize({width: 1440, height: 1000});
  }
}
