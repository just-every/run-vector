import { exerciseInlineNavigation } from "./ui-inline-navigation.mjs";
import {
  assertProofBinding,
  initializeProofBinding,
  proofAuditResults,
} from "./ui-proof-state.mjs";
import { auditReviewCycle } from "./ui-review-cycle.mjs";
import { auditReviewCollaboration } from "./ui-review-collaboration.mjs";
import { proveDelayedAdministration } from "./review-disclosure-delay.mjs";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";
import { createUiRuntime } from "./ui-runtime-support.mjs";
import { signIn, openAuthenticatedPage } from "./ui-runtime-auth.mjs";
import { exerciseInlineFields } from "./ui-inline-fields.mjs";
import { auditReviewUx } from "./ui-review-ux.mjs";
import { auditRequiredContrast } from "./ui-contrast-journey.mjs";
import { verificationDirectory } from "../../scripts/verification-paths.mjs";
const runtime = createUiRuntime(),
  results = [];
const directory = resolve(verificationDirectory, "review-proof");
await mkdir(directory, { recursive: true });
let browser;
try {
  const binding = await initializeProofBinding();
  runtime.initialize();
  runtime.start();
  await runtime.ready();
  const { cookie } = await signIn(runtime);
  browser = await chromium.launch({ headless: true });
  const page = await openAuthenticatedPage(browser, cookie, runtime.base);
  page.setDefaultTimeout(
    process.env.VECTOR_BASELINE_PROOF === "1" ? 4000 : 15000,
  );
  const headers = {
    Cookie: cookie,
    Origin: runtime.base,
    "Content-Type": "application/json",
  };
  const opts = await (await runtime.req("/api/options", { headers })).json();
  const runCase = async (name, run) => {
    if (
      process.env.VECTOR_PROOF_CASE &&
      !new RegExp(process.env.VECTOR_PROOF_CASE).test(name)
    )
      return;
    try {
      await run();
      results.push({ name, passed: true });
    } catch (error) {
      results.push({ name, passed: false, error: error.stack });
    }
    console.info(JSON.stringify(results.at(-1)));
    await writeFile(
      resolve(directory, "regressions.json"),
      JSON.stringify(results, null, 2),
    );
  };
  const context = { ...runtime, page, opts, headers, runCase, browser };
  if (
    !process.env.VECTOR_PROOF_GROUP ||
    process.env.VECTOR_PROOF_GROUP === "inline"
  )
    await exerciseInlineFields(context);
  if (
    !process.env.VECTOR_PROOF_GROUP ||
    process.env.VECTOR_PROOF_GROUP === "ux"
  )
    await auditReviewUx(context);
  if (
    !process.env.VECTOR_PROOF_GROUP ||
    process.env.VECTOR_PROOF_GROUP === "contrast"
  )
    await auditRequiredContrast({ ...context, results: [] });
  if (
    !process.env.VECTOR_PROOF_GROUP ||
    process.env.VECTOR_PROOF_GROUP === "navigation"
  )
    await exerciseInlineNavigation(context);
  if (
    !process.env.VECTOR_PROOF_GROUP ||
    process.env.VECTOR_PROOF_GROUP === "cycle"
  )
    await auditReviewCycle(context);
  if (
    !process.env.VECTOR_PROOF_GROUP ||
    process.env.VECTOR_PROOF_GROUP === "collaboration"
  )
    await auditReviewCollaboration(context);
  if (process.env.VECTOR_PROOF_GROUP === "delay")
    await proveDelayedAdministration(context);
  await assertProofBinding();
  await writeFile(
    resolve(directory, "audits.json"),
    JSON.stringify({ binding, results: proofAuditResults }, null, 2),
  );
  assert.ok(
    results.length && results.every((row) => row.passed),
    "independent review cases all pass",
  );
} finally {
  if (browser) await browser.close();
  await runtime.stop();
}
