import assert from 'node:assert/strict';
import { settleReads } from './collaboration-navigation.mjs';

export async function keyboardJourney(page, base, record) {
  const origin = await page.evaluate(() => performance.timeOrigin);
  for (const modifier of ['Control', 'Meta']) {
    await settleReads(page);
    await page.locator('h1').first().click();
    await page.keyboard.press(`${modifier}+k`);
    const palette = page.getByRole('dialog', { name: 'Command palette', exact: true });
    await palette.waitFor();
    const search = palette.getByRole('textbox');
    await search.fill('Open Projects');
    await palette.getByRole('option', { name: /Open Projects/ }).waitFor();
    await settleReads(page);
    await page.keyboard.press('Enter');
    await page.waitForURL(base + '/app/projects');
    await palette.waitFor({ state: 'detached' });
    await page.locator('h1').first().click();
    await page.keyboard.press(`${modifier}+k`);
    await palette.waitFor();
    await page.keyboard.press('Escape');
    await palette.waitFor({ state: 'detached' });
  }
  await settleReads(page);
  await page.locator('h1').first().click();
  await page.keyboard.press('c');
  await page.waitForURL(base + '/app/new-issue');
  const title = page.getByRole('textbox', { name: /^Title/ });
  await title.fill('');
  await title.pressSequentially('c g m g c g p');
  assert.equal(new URL(page.url()).pathname, '/app/new-issue');
  assert.equal(await title.inputValue(), 'c g m g c g p');
  await title.fill('');
  await page.getByLabel('Description', { exact: true }).pressSequentially('c g m g c g p');
  assert.equal(new URL(page.url()).pathname, '/app/new-issue');
  await page.getByLabel('Description', { exact: true }).fill('');
  for (const [key, path, heading] of [['m', '/app/my-work', 'My work'], ['c', '/app', 'Current'], ['p', '/app/projects', 'Projects']]) {
    await settleReads(page);
    await page.locator('h1').first().click();
    await page.keyboard.press('g');
    await page.keyboard.press(key);
    await page.waitForURL(base + path);
    await page.getByRole('heading', { name: heading, exact: true }).waitFor();
  }
  assert.equal(await page.evaluate(() => performance.timeOrigin), origin);
  record('CMD-002', 'Control+k and Meta+k each open a palette that navigates with Enter and closes with Escape; c and g m/c/p navigate, while title/description typing remains editable.');
}
