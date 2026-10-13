import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { assertControls } from "./ui-controls-checks.mjs";
const require = createRequire(import.meta.url);

// Browsing is settled only once a successful result has mounted for the
// expected controls. Saved views own their query independently of the URL.
export async function settled(page, { search } = {}) {
  await page.waitForTimeout(100);
  await page.waitForFunction((expectedSearch) => {
    if (!/^\/app\/(issues|board|views\/[^/]+)$/.test(location.pathname)) return true;
    const list = document.querySelector("main[data-list-query]");
    if (!list || list.dataset.listState !== "ready" ||
        !list.querySelector(".issues-pagination") || list.querySelector(":scope > .issues-notice")) return false;
    const entries = (search) => [...new URLSearchParams(search)].map(String).sort().join("&");
    const query = expectedSearch ?? (/^\/app\/(issues|board)$/.test(location.pathname) ? location.search : undefined);
    return query === undefined || entries(list.dataset.listQuery) === entries(query);
  }, search);
  await page.waitForFunction(() => !document.querySelector('main [aria-busy="true"]') && ![...document.querySelectorAll('main [role="status"]')].some(element => /^(Loading|Restoring|Refreshing|Searching|Saving|Applying)/.test(element.textContent.trim())));
}
// BASE-PUBLIC-003: every state is audited in ordinary verify, without capture flags.
export async function auditState({ page, evidence, results }, name) {
  await page.waitForFunction(() => !document.querySelector('main [aria-busy="true"]') && ![...document.querySelectorAll('main [role="status"]')].some(element => /^(Loading|Restoring|Refreshing|Searching|Saving|Applying)/.test(element.textContent.trim())));
  await page.evaluate(() => document.fonts.ready);
  let controls, controlFailure;
  try {controls = await assertControls(page, name)} catch (error) {controlFailure = error}
  if (!(await page.evaluate(() => Boolean(window.axe))))
    await page.addScriptTag({ path: require.resolve("axe-core/axe.min.js") });
  const axe = await page.evaluate(async () => {
    const { violations } = await window.axe.run(document);
    return violations.map(({ id, impact, nodes }) => ({
      id, impact, nodes: nodes.map(({ target, failureSummary }) => ({ target, failureSummary })),
    }));
  });
  const viewport = page.viewportSize();
  const file = `${viewport.width}-${name.replace(/[^a-z0-9-]/gi, "-")}.png`;
  const directory = resolve(evidence, "issue-controls");
  await mkdir(directory, { recursive: true });
  await page.screenshot({ path: resolve(directory, file), fullPage: true });
  const geometry = await page.evaluate(() => ({
    documentHeight: document.documentElement.scrollHeight,
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: innerWidth,
  }));
  results.push({ name, viewport, route: new URL(page.url()).pathname, controls, axe, geometry,
    capture: `issue-controls/${file}`,
    ...(controlFailure ? {controlError: controlFailure.message} : {}),
    sha256: createHash("sha256").update(await readFile(resolve(directory, file))).digest("hex"),
  });
  await writeFile(resolve(directory, "manifest.json"), JSON.stringify(results.filter(row => row.capture), null, 2));
  if (controlFailure) throw controlFailure;
  assert.deepEqual(axe.filter(row => ["serious", "critical"].includes(row.impact)), [], `${name}: serious/critical axe violations`);
  return results.at(-1);
}

export async function auditBothWidths(context, name) {
  const previous = context.page.viewportSize();
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    await context.page.setViewportSize(viewport);
    await auditState(context, name);
  }
  await context.page.setViewportSize(previous);
}
