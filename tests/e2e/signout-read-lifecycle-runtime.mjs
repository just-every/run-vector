import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";
import { createRequire } from "node:module";
import {
  createAdminRuntime,
  bootstrapOwner,
} from "./admin-runtime-support.mjs";
import { settleReads } from "./collaboration-navigation.mjs";
import { assertSignOutReadLifecycle } from "./signout-read-lifecycle.mjs";
import { createCapture, sourceBinding } from "./admin-capture.mjs";

const require = createRequire(import.meta.url);
const evidence = resolve(
  process.env.SIGNOUT_EVIDENCE ??
    ".artifacts/verification/signout-read-lifecycle",
);
await mkdir(evidence, { recursive: true });
const temporary = resolve(evidence, "temporary");
await mkdir(temporary, { recursive: true });
process.env.TMPDIR = temporary;
let browser, runtime;
const results = [],
  captures = [];
const binding = await sourceBinding();
try {
  browser = await chromium.launch({ headless: true });
  for (const width of [1440, 390]) {
    runtime = createAdminRuntime(width);
    runtime.initialize();
    await runtime.start();
    const context = await browser.newContext({
      viewport: { width, height: 1000 },
    });
    try {
      const page = await context.newPage();
      const pageErrors = [],
        consoleErrors = [],
        failed = [],
        modules = [];
      page.on("pageerror", (error) => pageErrors.push(error.message));
      page.on("console", (message) => {
        if (message.type() === "error") consoleErrors.push(message.text());
      });
      page.on("requestfailed", (request) =>
        failed.push({
          path: new URL(request.url()).pathname,
          failure: request.failure(),
        }),
      );
      page.on("response", (response) => {
        if (
          response.status() >= 400 &&
          response.request().resourceType() === "script"
        )
          modules.push(new URL(response.url()).pathname);
      });
      await bootstrapOwner(page, runtime);
      await settleReads(page);
      await page.addScriptTag({ path: require.resolve("axe-core/axe.min.js") });
      const axe = await page.evaluate(async () =>
        (
          await window.axe.run(document, {
            runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] },
          })
        ).violations
          .filter((row) => ["serious", "critical"].includes(row.impact))
          .map((row) => row.id),
      );
      assert.deepEqual(axe, []);
      await settleReads(page);
      await page
        .getByRole("button", { name: "Sign out", exact: true })
        .filter({ visible: true })
        .click();
      await page.waitForURL(runtime.base + "/signin");
      await assertSignOutReadLifecycle({
        page,
        runtime,
        clause: async (_id, _name, run) => run(),
        capturePage: (actualPage) => {
          assert.notEqual(
            actualPage,
            page,
            "lifecycle capture owns the fresh private page",
          );
          const capture = createCapture(
            actualPage,
            evidence,
            binding,
            captures,
          );
          return async (name) => {
            await capture(`${width}-${name}`);
            return captures.at(-1);
          };
        },
      });
      assert.deepEqual(pageErrors, [], "page errors");
      assert.deepEqual(consoleErrors, [], "unexpected browser console errors");
      assert.deepEqual(failed, [], "failed requests");
      assert.deepEqual(modules, [], "failed modules");
      results.push({
        width,
        passed: true,
        axe,
        pageErrors,
        consoleErrors,
        failed,
        modules,
      });
    } catch (error) {
      results.push({ width, passed: false, message: error.message });
    } finally {
      await context.close();
      await runtime.stop();
      runtime = null;
    }
  }
  assert.ok(
    results.every((result) => result.passed),
    JSON.stringify(results),
  );
  assert.deepEqual(
    captures.map((receipt) => receipt.name),
    [1440, 390].flatMap((width) => [
      `${width}-signout-paused-private-read`,
      `${width}-signout-read-deadline-retry`,
      `${width}-signout-complete-private-ui-removed`,
    ]),
    "all six lifecycle state captures are present",
  );
  const finalBinding = await sourceBinding();
  assert.equal(
    finalBinding.sourceInputDigest,
    binding.sourceInputDigest,
    "source inputs stayed immutable during lifecycle capture proof",
  );
  assert.deepEqual(finalBinding.builtWorkerHashes, binding.builtWorkerHashes);
  assert.deepEqual(finalBinding.builtClientHashes, binding.builtClientHashes);
  await writeFile(
    resolve(evidence, "results.json"),
    JSON.stringify({ passed: true, results, captures, ...binding }, null, 2),
  );
  console.log(
    "Sign-out lifecycle: both widths passed native held reads, bounded recovery, axe, privacy and zero diagnostics.",
  );
} catch (error) {
  await writeFile(
    resolve(evidence, "failure.json"),
    JSON.stringify(
      { passed: false, message: error.message, results, captures, ...binding },
      null,
      2,
    ),
  );
  throw error;
} finally {
  await browser?.close();
  await runtime?.stop();
}
