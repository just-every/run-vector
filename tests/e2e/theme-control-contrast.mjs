/** WCAG 2.2 AA 1.4.11 on the rendered page: every enabled UI component a person must see to operate keeps 3:1.
 * A control that draws its shape (fill, border or a solid inset/ring shadow) must reach 3:1 against what surrounds it, at
 * rest and hovered; text-entry fields always need that boundary; a selected, current or pressed state must show itself at
 * 3:1; native checkboxes and radios are measured from their rendered pixels; and every focusable control shows a 3:1
 * focus indicator under keyboard focus. Disabled controls are exempt, as WCAG exempts inactive components. */

// Installed once per document: colour maths and the boundary of one element against what surrounds it.
function install() {
  if (window.__nonText) return;
  // Any computed colour (rgb(), color(srgb …) from color-mix(), oklch()) resolves through one painted canvas pixel.
  const pixel = new OffscreenCanvas(1, 1).getContext('2d', { willReadFrequently: true }), colors = new Map();
  const parse = value => {
    if (!colors.has(value)) {
      pixel.clearRect(0, 0, 1, 1); pixel.fillStyle = '#000'; pixel.fillStyle = value; pixel.fillRect(0, 0, 1, 1);
      const [r, g, b, a] = pixel.getImageData(0, 0, 1, 1).data;
      colors.set(value, [r, g, b, a / 255]);
    }
    return colors.get(value);
  };
  const over = (top, bottom) => [0, 1, 2].map(i => top[i] * top[3] + bottom[i] * (1 - top[3])).concat(1);
  const behind = element => {
    const layers = [];
    for (let node = element; node; node = node.parentElement) layers.push(parse(getComputedStyle(node).backgroundColor));
    return layers.reverse().reduce((under, layer) => over(layer, under), [255, 255, 255, 1]);
  };
  const luminance = rgb => { const [r, g, b] = rgb.slice(0, 3).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const ratio = (a, b) => { const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
  // Solid shadows only (no blur): a ring or an inset bar draws a boundary; a soft elevation shadow does not.
  const shadows = value => value === 'none' ? [] : value.split(/,(?![^(]*\))/).map(part => {
    const colorText = part.match(/(?:rgba?|color|oklch|oklab|lab|lch|hsla?)\([^)]*\)|#[0-9a-f]+/i)?.[0] ?? 'transparent';
    const color = parse(colorText), lengths = (part.replace(colorText, '').match(/-?[\d.]+px/g) ?? []).map(parseFloat);
    return { color, inset: /inset/.test(part), solid: (lengths[2] ?? 0) === 0 && (Math.abs(lengths[0] ?? 0) + Math.abs(lengths[1] ?? 0) + Math.abs(lengths[3] ?? 0)) > 0 };
  }).filter(s => s.solid && s.color[3] > 0);
  /** The strongest drawn edge of an element, and whether it draws one at all. */
  const boundary = element => {
    const style = getComputedStyle(element), outside = behind(element.parentElement), surface = over(parse(style.backgroundColor), outside);
    // A fill, an enclosing border, an outline or a solid ring draws the component's shape; a one-sided rule between list
    // rows separates them and is not a component's boundary.
    const fill = ratio(surface, outside), sides = [];
    for (const side of ['Top', 'Right', 'Bottom', 'Left']) {
      const color = parse(style[`border${side}Color`]);
      if (parseFloat(style[`border${side}Width`]) > 0 && !['none', 'hidden'].includes(style[`border${side}Style`]) && color[3] > 0) sides.push(ratio(over(color, surface), outside));
    }
    const rings = shadows(style.boxShadow).map(shadow => ratio(over(shadow.color, shadow.inset ? surface : outside), shadow.inset ? surface : outside));
    if (style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) >= 1) rings.push(ratio(over(parse(style.outlineColor), outside), outside));
    const shape = [fill, ...(sides.length === 4 ? sides : []), ...rings];
    return { best: Math.max(fill, ...sides, ...rings), drawn: shape.some(edge => edge > 1.1) };
  };
  /** The focus indicator: an outline or a solid ring against what surrounds it. */
  const focusRing = element => {
    const style = getComputedStyle(element), outside = behind(element.parentElement), surface = over(parse(style.backgroundColor), outside);
    const rings = [];
    if (style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) >= 1) {
      const color = parse(style.outlineColor), against = parseFloat(style.outlineOffset) < 0 ? surface : outside;
      rings.push(ratio(over(color, against), against));
    }
    for (const shadow of shadows(style.boxShadow)) rings.push(ratio(over(shadow.color, shadow.inset ? surface : outside), shadow.inset ? surface : outside));
    return rings.length ? Math.max(...rings) : 0;
  };
  // Closed disclosures hide their contents with content-visibility, which only checkVisibility() reports.
  const visible = element => element.checkVisibility({ visibilityProperty: true, opacityProperty: true }) && !element.closest('[inert],[aria-hidden=true]');
  const enabled = element => !element.matches(':disabled') && element.getAttribute('aria-disabled') !== 'true';
  const describe = element => element.outerHTML.slice(0, 120);
  window.__nonText = { parse, over, behind, ratio, boundary, focusRing, visible, enabled, describe };
}

const controlSelector = 'button,[role=button],[role=tab],[role=switch],[role=menuitem],[role=option],summary,a[href],input[type=submit],input[type=button],input[type=reset]';
const fieldSelector = 'input:not([type=checkbox],[type=radio],[type=hidden],[type=color],[type=file],[type=range],[type=submit],[type=button],[type=reset]),select,textarea';
const choiceSelector = 'input[type=checkbox],input[type=radio]';
// Current place is a state of navigation items and tabs; a link in running text that happens to point at this page is text.
const selectedSelector = '[aria-selected=true],[aria-pressed=true],[aria-checked=true]:not(input),:is(nav,[role=tablist]) [aria-current]:not([aria-current=false])';
const focusSelector = 'a[href],button,input:not([type=hidden]),select,textarea,summary,[tabindex]:not([tabindex="-1"]),[role=tab],[role=button]';

/** Controls, fields and selected states at rest. */
async function restFailures(page) {
  return page.evaluate(([controls, fields, selected]) => {
    const { boundary, visible, enabled, describe } = window.__nonText, failures = [];
    for (const element of document.querySelectorAll(controls)) {
      if (!visible(element) || !enabled(element)) continue;
      const { best, drawn } = boundary(element);
      if (drawn && best < 3) failures.push({ rule: 'control-boundary', target: describe(element), summary: `boundary ${best.toFixed(2)}:1` });
    }
    for (const element of document.querySelectorAll(fields)) {
      if (!visible(element) || !enabled(element)) continue;
      const { best } = boundary(element);
      if (best < 3) failures.push({ rule: 'field-boundary', target: describe(element), summary: `boundary ${best.toFixed(2)}:1` });
    }
    for (const element of document.querySelectorAll(selected)) {
      if (!visible(element)) continue;
      const { best } = boundary(element);
      if (best < 3) failures.push({ rule: 'selected-state', target: describe(element), summary: `state indicator ${best.toFixed(2)}:1` });
    }
    return failures;
  }, [controlSelector, fieldSelector, selectedSelector]);
}

/** Native checkboxes and radios draw themselves, so their rendered pixels are measured against what surrounds them. */
async function choiceFailures(page) {
  const failures = [], count = await page.locator(choiceSelector).count();
  for (let index = 0; index < count; index++) {
    const choice = page.locator(choiceSelector).nth(index);
    const facts = await choice.evaluate(element => {
      const { visible, enabled, behind, describe } = window.__nonText;
      if (!visible(element) || !enabled(element)) return null;
      const rect = element.getBoundingClientRect();
      return rect.width && rect.height ? { outside: behind(element.parentElement), target: describe(element), checked: element.checked } : null;
    });
    if (!facts) continue;
    const png = await choice.screenshot({ animations: 'disabled', caret: 'hide' });
    const best = await page.evaluate(async ([bytes, outside]) => {
      const { ratio } = window.__nonText;
      const bitmap = await createImageBitmap(new Blob([new Uint8Array(bytes)], { type: 'image/png' }));
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height), context = canvas.getContext('2d');
      context.drawImage(bitmap, 0, 0);
      const { data } = context.getImageData(0, 0, bitmap.width, bitmap.height);
      let strongest = 1;
      for (let i = 0; i < data.length; i += 4) strongest = Math.max(strongest, ratio([data[i], data[i + 1], data[i + 2], 1], outside));
      return strongest;
    }, [[...png], facts.outside]);
    if (best < 3) failures.push({ rule: 'choice-boundary', target: facts.target, summary: `${facts.checked ? 'checked' : 'unchecked'} ${best.toFixed(2)}:1` });
  }
  return failures;
}

/** Each drawn control hovered with the pointer keeps its 3:1 boundary. */
async function hoverFailures(page) {
  const failures = [], controls = page.locator(controlSelector);
  const count = await controls.count();
  for (let index = 0; index < count; index++) {
    const control = controls.nth(index);
    const point = await control.evaluate(element => {
      const { visible, enabled } = window.__nonText;
      if (!visible(element) || !enabled(element)) return null;
      element.scrollIntoView({ block: 'center', inline: 'nearest' });
      const rect = element.getBoundingClientRect();
      const x = rect.left + rect.width / 2, y = rect.top + rect.height / 2;
      return rect.width && rect.height && element.contains(document.elementFromPoint(x, y)) ? { x, y } : null;
    });
    if (!point) continue;
    await page.mouse.move(point.x, point.y);
    const failure = await control.evaluate(element => {
      const { boundary, describe } = window.__nonText;
      if (!element.matches(':hover')) return null;
      const { best, drawn } = boundary(element);
      return drawn && best < 3 ? { rule: 'hover-boundary', target: describe(element), summary: `hovered boundary ${best.toFixed(2)}:1` } : null;
    });
    if (failure) failures.push(failure);
  }
  await page.mouse.move(0, 0);
  return failures;
}

/** Keyboard focus on every focusable control shows a 3:1 indicator. One Tab press sets keyboard modality; each control is
 * then focused in turn, as a keyboard user reaches it. */
async function focusFailures(page) {
  await page.keyboard.press('Tab');
  const failures = await page.evaluate(selector => {
    const { focusRing, visible, enabled, describe } = window.__nonText, found = [];
    for (const element of document.querySelectorAll(selector)) {
      if (!visible(element) || !enabled(element) || element.tabIndex < 0) continue;
      element.focus({ preventScroll: true });
      if (document.activeElement !== element) continue;
      const ring = element.matches(':focus-visible') ? focusRing(element) : 0;
      if (ring < 3) found.push({ rule: 'focus-indicator', target: describe(element), summary: `focus indicator ${ring.toFixed(2)}:1` });
    }
    document.activeElement?.blur();
    return found;
  }, focusSelector);
  return failures;
}

export async function nonTextFailures(page) {
  await page.evaluate(install);
  return [...await restFailures(page), ...await choiceFailures(page), ...await hoverFailures(page), ...await focusFailures(page)];
}
