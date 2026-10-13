import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile, writeFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
import {
  assertControls,
  assertNavigationClearance,
  openDisclosures,
} from "./ui-controls-checks.mjs";
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
export async function sourceBinding() {
  const names = execFileSync("git", ["ls-files", "-co", "--exclude-standard"], {
    encoding: "utf8",
  })
    .trim()
    .split("\n")
    .filter(
      (name) =>
        /^(src|tests|migrations|scripts|vendor|sample-data|public)\//.test(name) ||
        /^(package\.json|pnpm-lock\.yaml|sources\.lock\.json|seed\.json|edition\.json|wrangler\.jsonc|vite\.config\.ts)$/.test(
          name,
        ),
    );
  const inputs = Object.fromEntries(
    await Promise.all(
      [...new Set(names)]
        .sort()
        .map(async (name) => [name, digest(await readFile(name))]),
    ),
  );
  async function workerFiles(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    return (
      await Promise.all(
        entries.map((entry) =>
          entry.isDirectory()
            ? workerFiles(resolve(directory, entry.name))
            : [resolve(directory, entry.name)],
        ),
      )
    ).flat();
  }
  const builtWorkerHashes = Object.fromEntries(
    await Promise.all(
      (await workerFiles("dist/server"))
        .sort()
        .map(async (name) => [
          name.slice(resolve("dist/server").length + 1),
          digest(await readFile(name)),
        ]),
    ),
  );
  const builtClientHashes = Object.fromEntries(
    await Promise.all(
      (await workerFiles("dist/client"))
        .sort()
        .map(async (name) => [
          name.slice(resolve("dist/client").length + 1),
          digest(await readFile(name)),
        ]),
    ),
  );
  return {
    sourceCommit: execFileSync("git", ["rev-parse", "HEAD"], {
      encoding: "utf8",
    }).trim(),
    sourceTree: execFileSync("git", ["rev-parse", "HEAD^{tree}"], {
      encoding: "utf8",
    }).trim(),
    sourceInputHashes: inputs,
    sourceInputDigest: digest(JSON.stringify(inputs)),
    builtWorkerHashes,
    builtClientHashes,
  };
}
export function createCapture(page, evidence, binding, results) {
  return async function capture(name) {
    await page.locator("main").waitFor();
    await page.waitForFunction(
      () =>
        ![...document.querySelectorAll("main [role=status]")].some((element) =>
          /^Loading|^Saving(?:…|\.\.\.| commitment)/.test(
            element.textContent.trim(),
          ),
        ) && !document.querySelector('main [aria-busy="true"]'),
    );
    await openDisclosures(page);
    const controls = await assertControls(page, name);
    await assertNavigationClearance(page, name);
    if (!(await page.evaluate(() => Boolean(window.axe))))
      await page.addScriptTag({ path: require.resolve("axe-core/axe.min.js") });
    const axeVersion = await page.evaluate(() => window.axe.version);
    assert.equal(
      axeVersion,
      require("axe-core/package.json").version,
      "capture uses pinned installed axe",
    );
    const axe = await page.evaluate(async () => {
      const result = await window.axe.run(document, {
        runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] },
      });
      return result.violations.map(({ id, impact, description, nodes }) => ({
        id,
        impact,
        description,
        nodes: nodes.map(({ target, failureSummary }) => ({
          target,
          failureSummary,
        })),
      }));
    });
    assert.deepEqual(
      axe.filter((row) => ["serious", "critical"].includes(row.impact)),
      [],
      name + ": serious/critical accessibility violations",
    );
    await page.evaluate(() => window.scrollTo(0, 0));
    const file = name + ".png";
    await page.screenshot({ path: resolve(evidence, file), fullPage: true });
    const geometry = await page.evaluate(() => ({
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
      documentHeight: document.documentElement.scrollHeight,
      viewportHeight: window.innerHeight,
      sections: [...document.querySelectorAll("main section")].map(
        (section) => ({
          label:
            section.getAttribute("aria-label") ??
            document.getElementById(section.getAttribute("aria-labelledby"))
              ?.textContent,
          bounds: section.getBoundingClientRect().toJSON(),
        }),
      ),
    }));
    results.push({
      name,
      geometry,
      viewport: page.viewportSize(),
      url: new URL(page.url()).pathname,
      controls,
      axe,
      axeVersion,
      capture: file,
      captureHash: digest(await readFile(resolve(evidence, file))),
      ...binding,
    });
    await writeFile(
      resolve(evidence, "captures.json"),
      JSON.stringify(results, null, 2) + "\n",
    );
  };
}
export async function exportData(runtime, evidence, width) {
  const tables = [
    "workspace_settings",
    "operators",
    "teams",
    "workflow_statuses",
    "projects",
    "project_activity",
    "cycles",
    "labels",
    "issues",
    "issue_labels",
    "issue_activity",
    "team_issue_sequences",
    "saved_views",
    "audit_records",
    "administration_audit_details",
  ];
  const data = Object.fromEntries(
    tables.map((table) => [table, runtime.sql(`SELECT * FROM ${table}`)]),
  );
  const bytes = JSON.stringify({ width, data }, null, 2) + "\n";
  const file = `database-${width}.json`;
  await writeFile(resolve(evidence, file), bytes);
  return { file, sha256: digest(bytes) };
}
