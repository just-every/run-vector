import assert from "node:assert/strict";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";
import { documentReadFixture } from "./document-read-fixture.mjs";
import { settleReads, trackRequests } from "./collaboration-navigation.mjs";
import { assertNativeReadRecovery } from "./document-read-recovery.mjs";

const evidence = resolve(
  process.env.DOCUMENT_READ_EVIDENCE ??
    ".artifacts/verification/document-read-lifecycle",
);
await mkdir(resolve(evidence, "temporary"), { recursive: true });
process.env.TMPDIR = resolve(evidence, "temporary");
const inputs = [
  "src/core/app/read-lifecycle.ts",
  "src/core/app/document-read-lifecycle.ts",
  "tests/e2e/document-read-fixture.mjs",
  "tests/e2e/document-read-recovery.mjs",
  "tests/e2e/document-navigation-controls.mjs",
  "tests/e2e/document-read-lifecycle.mjs",
  "tests/e2e/collaboration-navigation.mjs",
];
const sourceHashes = async () =>
  Object.fromEntries(
    await Promise.all(
      inputs.map(async (name) => [
        name,
        createHash("sha256")
          .update(await readFile(name))
          .digest("hex"),
      ]),
    ),
  );
const report = {
  passed: false,
  sourceHashes: await sourceHashes(),
  checks: [],
  events: [],
  lifecycle: [],
};
let browser, fixture;
try {
  fixture = await documentReadFixture();
  browser = await chromium.launch({
    headless: true,
    channel: "chromium",
    ignoreDefaultArgs: ["--disable-back-forward-cache"],
  });
  const page = await browser.newPage();
  const errors = [],
    failures = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
    if (m.text().startsWith("lifecycle:"))
      report.lifecycle.push(JSON.parse(m.text().slice(10)));
  });
  page.on("requestfailed", (r) => failures.push(new URL(r.url()).pathname));
  trackRequests(page);
  await page.goto(fixture.base + "/app/start");
  await page.waitForSelector('body[data-ready="true"]');
  assert.equal(
    await page.locator("body").getAttribute("data-navigation"),
    "true",
    "native Navigation API exists",
  );
  await settleReads(page);
  const navigation = page.goto(fixture.base + "/app/next");
  await fixture.requested;
  // Several genuine poll opportunities occur while the browser holds the
  // outgoing document, before committing the delayed destination response.
  await page.waitForTimeout(450);
  fixture.releaseDocument();
  await navigation;
  await page.waitForSelector('body[data-ready="true"]');
  await settleReads(page);
  assert.deepEqual(
    fixture.events.filter(
      (e) =>
        e.type === "request" &&
        e.path === "/api/read" &&
        e.provisional &&
        e.receipt.startsWith("/app/start:"),
    ),
    [],
    "no outgoing-document read is admitted during provisional navigation",
  );
  assert.ok(
    fixture.events.some(
      (e) => e.type === "finish" && e.receipt?.startsWith("/app/next:"),
    ),
    "new document reads finish natively",
  );
  report.checks.push(
    "held provisional navigation: strict pending zero, no old-document admission, new-document completion",
  );
  assert.deepEqual(errors, [], "no module, page or console errors");
  assert.deepEqual(failures, [], "no failed native requests");
  await assertNativeReadRecovery(browser, report);
  assert.deepEqual(
    await sourceHashes(),
    report.sourceHashes,
    "native fixture and production sources stayed immutable",
  );
  report.passed = true;
} catch (error) {
  report.failure = error.message;
  throw error;
} finally {
  report.events = fixture?.events ?? [];
  await browser?.close();
  await fixture?.close();
  await writeFile(
    resolve(evidence, "result.json"),
    JSON.stringify(report, null, 2) + "\n",
  );
}
console.log("Native document read admission: passed.");
