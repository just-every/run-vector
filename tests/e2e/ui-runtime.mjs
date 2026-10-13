import { runReviewStage } from "./ui-review-stage.mjs";
import { archivePreviousProof } from "./review-stage-support.mjs";
import {
  proofAuditResults,
  assertProofBinding,
  initializeProofBinding,
} from "./ui-proof-state.mjs";
import { auditRequiredContrast } from "./ui-contrast-journey.mjs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";
import { verificationDirectory } from "../../scripts/verification-paths.mjs";
import { createUiRuntime } from "./ui-runtime-support.mjs";
import { signIn, openAuthenticatedPage } from "./ui-runtime-auth.mjs";
import { auditRoutes } from "./ui-route-audits.mjs";
import { exerciseDecision } from "./ui-decision-journey.mjs";
import { exerciseDiscussionProperties } from "./ui-discussion-properties.mjs";
import { exercisePropertyNavigation } from "./ui-property-navigation.mjs";
import { auditEdges } from "./ui-edge-audits.mjs";
import { exerciseIssueControls } from "./issue-controls-journeys.mjs";
import { exerciseConfirmationRequests } from "./ui-confirmation-requests.mjs";
import { observeUiFailure, writeUiFailureDiagnostic } from "./ui-failure-diagnostics.mjs";

const runtime = createUiRuntime();
const { base, req, sql, writeFixture, start, ready, stop, freshRequestWindow } = runtime;
const evidence = resolve(verificationDirectory);
await mkdir(evidence, { recursive: true });
const failureDiagnostic = resolve(evidence, "ui-runtime-failure-safe.json");
await rm(failureDiagnostic, { force: true });
await archivePreviousProof(resolve(evidence, "review-proof"));
const binding = await initializeProofBinding();
runtime.initialize();
let browser, page, diagnostic;
const results = [];
try {
  start();
  await ready();
  const { email, cookie } = await signIn(runtime);
  browser = await chromium.launch({ headless: true });
  page = await openAuthenticatedPage(browser, cookie, base);
  diagnostic = observeUiFailure(page, base);
  const opts = await (
    await req("/api/options", { headers: { Cookie: cookie } })
  ).json();
  const projects = opts.projects;
  await freshRequestWindow();
  await auditRequiredContrast({ page, base, results });
  await freshRequestWindow();
  await auditRoutes({ page, base, projects, evidence, results });
  await freshRequestWindow();
  const journey = await exerciseDecision({
    page,
    base,
    cookie,
    opts,
    req,
    writeFixture,
  });
  await freshRequestWindow();
  await exerciseDiscussionProperties({
    page,
    base,
    projects,
    opts,
    req,
    ...journey,
  });
  await freshRequestWindow();
  await exercisePropertyNavigation({
    page,
    base,
    req,
    opts,
    headers: journey.headers,
  });
  await freshRequestWindow();
  await exerciseConfirmationRequests({
    page,
    base,
    req,
    opts,
    headers: journey.headers,
  });
  await freshRequestWindow();
  await exerciseIssueControls({ page, base, evidence, results, runtime, browser, cookie, opts });
  await freshRequestWindow();
  await auditEdges({ page, base, writeFixture, req, email });
  results.push(...proofAuditResults);
  await assertProofBinding();
} catch (error) {
  if (browser && diagnostic) {
    try { await writeUiFailureDiagnostic(failureDiagnostic, browser, diagnostic, runtime.log); }
    catch { console.error("UI failure diagnostics could not be written."); }
  }
  if (page && !page.isClosed()) {
    await writeFile(
      resolve(evidence, "ui-runtime-failure.html"),
      await page.content(),
    );
    await page
      .screenshot({
        path: resolve(evidence, "ui-runtime-failure.png"),
        fullPage: true,
      })
      .catch(() => {});
  }
  await writeFile(
    resolve(evidence, "ui-runtime-failure.log"),
    String(error.stack) + "\n" + runtime.log,
  );
  throw error;
} finally {
  if (browser) await browser.close();
  await stop();
}

// Each review family uses a sequential genuine installation below the unchanged
// operator request budget; every new case remains an unconditional stage.
const review = await runReviewStage();
results.push(...review.results);
await assertProofBinding();
await writeFile(
  resolve(evidence, "ui-runtime-results.json"),
  JSON.stringify(
    {
      passed: true,
      binding,
      checks: results.length,
      controlChecks: results.reduce(
        (sum, row) => sum + (row.controls?.length ?? 0),
        0,
      ),
      results,
    },
    null,
    2,
  ),
);
console.info(
  `[Vector UI] Passed ${results.length} route/state audits.`,
);
