import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
const require = createRequire(import.meta.url);

/** Role screens are inspected at both widths: no serious or critical axe
 * finding, no horizontal overflow, and one capture per state. */
export function roleScreens(evidence) {
  const folder = resolve(evidence, "roles");
  return async function inspect(page, region, name) {
    await mkdir(folder, { recursive: true });
    const source = await readFile(require.resolve("axe-core/axe.min.js"), "utf8");
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
      await region.scrollIntoViewIfNeeded();
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${name} ${width}: no horizontal overflow`);
      await page.evaluate((source) => {
        if (window.axe) return;
        const script = document.createElement("script");
        const nonce = document.querySelector("script[nonce]")?.nonce;
        if (nonce) script.nonce = nonce;
        script.textContent = source;
        document.head.append(script);
      }, source);
      const findings = await page.evaluate(async () => (await window.axe.run()).violations
        .filter((v) => ["serious", "critical"].includes(v.impact)).map((v) => ({ id: v.id, targets: v.nodes.map((n) => n.target) })));
      assert.deepEqual(findings, [], `${name} ${width}: no serious or critical axe findings`);
      // A capture taller than the viewport would stitch the sticky Settings
      // navigation and the fixed mobile bar over the region; hide them for it.
      await region.evaluate((root) => {
        for (const element of document.querySelectorAll("body *"))
          if (["fixed", "sticky"].includes(getComputedStyle(element).position) && !root.contains(element) && !element.contains(root))
            element.setAttribute("data-capture-hidden", "");
      });
      await region.screenshot({ path: resolve(folder, `${name}-${width}.png`), style: "[data-capture-hidden] { visibility: hidden !important; }" });
      await page.evaluate(() => document.querySelectorAll("[data-capture-hidden]").forEach((element) => element.removeAttribute("data-capture-hidden")));
    }
  };
}
