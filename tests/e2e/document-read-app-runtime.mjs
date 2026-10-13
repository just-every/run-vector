import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";
import {
  createAdminRuntime,
  bootstrapOwner,
} from "./admin-runtime-support.mjs";
import { createCapture, sourceBinding } from "./admin-capture.mjs";
import { assertDocumentReadRecovery } from "./document-read-app-journey.mjs";

const evidence = resolve(
  process.env.DOCUMENT_READ_EVIDENCE ??
    ".artifacts/verification/document-read-app",
);
await mkdir(resolve(evidence, "temporary"), { recursive: true });
process.env.TMPDIR = resolve(evidence, "temporary");
const binding = await sourceBinding();
const results = [],
  checks = [];
let browser, runtime;
try {
  browser = await chromium.launch({ headless: true });
  for (const viewport of [
    { width: 1440, height: 1000 },
    { width: 390, height: 844 },
  ]) {
    runtime = createAdminRuntime(viewport.width);
    runtime.initialize();
    await runtime.start();
    const context = await browser.newContext({ viewport });
    try {
      const page = await context.newPage();
      await bootstrapOwner(page, runtime);
      await assertDocumentReadRecovery({
        page,
        runtime,
        clause: async (id, name, run) => {
          await run();
          checks.push({ id, name, width: viewport.width });
        },
        capturePage: (actualPage) => {
          const capture = createCapture(actualPage, evidence, binding, results);
          return async (name) => {
            await capture(`${viewport.width}-${name}`);
            return results.at(-1);
          };
        },
      });
    } finally {
      await context.close();
      await runtime.stop();
      runtime = null;
    }
  }
  const final = await sourceBinding();
  assert.equal(final.sourceInputDigest, binding.sourceInputDigest);
  assert.deepEqual(final.builtClientHashes, binding.builtClientHashes);
  assert.deepEqual(final.builtWorkerHashes, binding.builtWorkerHashes);
  await writeFile(
    resolve(evidence, "result.json"),
    JSON.stringify({ passed: true, checks, results, ...binding }, null, 2) +
      "\n",
  );
  console.log("Native product document recovery: both widths passed.");
} catch (error) {
  await writeFile(
    resolve(evidence, "failure.json"),
    JSON.stringify(
      { passed: false, failure: error.message, checks, results, ...binding },
      null,
      2,
    ) + "\n",
  );
  throw error;
} finally {
  await browser?.close();
  await runtime?.stop();
}
