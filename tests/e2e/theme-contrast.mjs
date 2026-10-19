import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
const require = createRequire(import.meta.url);
const axeSource = await readFile(require.resolve('axe-core/axe.min.js'), 'utf8');

/** WCAG 2.2 AA on the rendered page: axe's text contrast (1.4.3) plus a 3:1 boundary for every text-entry field (1.4.11). Disabled controls are exempt, as WCAG exempts inactive components. */
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
  const fields = await page.evaluate(() => {
    const parse = value => { const m = value.match(/rgba?\(([^)]+)\)/); if (!m) return [0, 0, 0, 0]; const [r, g, b, a = '1'] = m[1].split(/[ ,/]+/).filter(Boolean); return [+r, +g, +b, +a]; };
    const over = (top, bottom) => [0, 1, 2].map(i => top[i] * top[3] + bottom[i] * (1 - top[3])).concat(1);
    const behind = element => {
      const layers = [];
      for (let node = element; node; node = node.parentElement) layers.push(parse(getComputedStyle(node).backgroundColor));
      return layers.reverse().reduce((under, layer) => over(layer, under), [255, 255, 255, 1]);
    };
    const luminance = rgb => { const [r, g, b] = rgb.slice(0, 3).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
    const ratio = (a, b) => { const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
    const selector = 'input:not([type=checkbox],[type=radio],[type=hidden],[type=color],[type=file],[type=range]),select,textarea';
    return [...document.querySelectorAll(selector)].filter(field => !field.matches(':disabled') && field.getClientRects().length && getComputedStyle(field).visibility !== 'hidden').flatMap(field => {
      const style = getComputedStyle(field), outside = behind(field.parentElement), surface = over(parse(style.backgroundColor), outside);
      const border = parseFloat(style.borderTopWidth) > 0 && style.borderTopStyle !== 'none' ? ratio(over(parse(style.borderTopColor), surface), outside) : 0;
      const best = Math.max(border, ratio(surface, outside));
      return best >= 3 ? [] : [{ rule: 'field-boundary', target: field.outerHTML.slice(0, 120), summary: `boundary ${best.toFixed(2)}:1` }];
    });
  });
  return [...text, ...fields];
}

/** Relative luminance of the canvas the member sees, for telling a dark page from a light one. */
export async function canvasLuminance(page) {
  return page.evaluate(() => {
    const [r, g, b] = getComputedStyle(document.documentElement).backgroundColor.match(/\d+(\.\d+)?/g).map(Number);
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  });
}
