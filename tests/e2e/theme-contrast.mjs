import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { nonTextFailures } from './theme-control-contrast.mjs';
const require = createRequire(import.meta.url);
const axeSource = await readFile(require.resolve('axe-core/axe.min.js'), 'utf8');

/** WCAG 2.2 AA contrast on the rendered page: axe's text contrast (1.4.3) plus 3:1 non-text contrast (1.4.11) for every
 * control, field, selected state, hover state and focus indicator (theme-control-contrast.mjs). */
export async function contrastFailures(page) {
  await page.evaluate(source => {
    if (window.axe) return;
    const script = document.createElement('script');
    const nonce = document.querySelector('script[nonce]')?.nonce;
    if (nonce) script.nonce = nonce;
    script.textContent = source;
    document.head.append(script);
  }, axeSource);
  const text = await page.evaluate(async () => (await window.axe.run(document, { runOnly: ['color-contrast'] }))
    .violations.flatMap(v => v.nodes.map(n => ({ rule: v.id, target: n.target.join(' '), summary: n.any[0]?.message ?? '' }))));
  return [...text, ...await nonTextFailures(page)];
}

/** Relative luminance of the canvas the member sees, for telling a dark page from a light one. */
export async function canvasLuminance(page) {
  return page.evaluate(() => {
    const [r, g, b] = getComputedStyle(document.documentElement).backgroundColor.match(/\d+(\.\d+)?/g).map(Number);
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  });
}
