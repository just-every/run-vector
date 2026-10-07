import { verificationDirectory } from '../../scripts/verification-paths.mjs';
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "@playwright/test";
const base = "http://127.0.0.1:15928",
  evidence = verificationDirectory;
await mkdir(evidence, { recursive: true });
assert.equal((await fetch(base + "/health")).status, 200);
const sent = await fetch(base + "/auth/request", {
  method: "POST",
  headers: { Origin: base, "Content-Type": "application/json" },
  body: JSON.stringify({ email: "sarah@vector.test" }),
});
assert.equal(sent.status, 202);
const output = execFileSync(
  "pnpm",
  [
    "exec",
    "wrangler",
    "d1",
    "execute",
    "vector-local",
    "--local",
    "--config",
    "wrangler.jsonc",
    "--persist-to",
    ".wrangler/vector-dev",
    "--command",
    "SELECT sign_in_url FROM local_mail_outbox ORDER BY created_at DESC LIMIT 1",
    "--json",
  ],
  { encoding: "utf8" },
);
const link = JSON.parse(output)[0].results[0].sign_in_url;
const browser = await chromium.launch({ headless: true });
let trace, capturePage;
try {
  const page = await browser.newPage({
      viewport: { width: 1280, height: 900 },
    }),
    errors = [],
    failed = [],
    paths = new Set(), badResponses = [];
  capturePage = page;
  trace = { errors, failed, badResponses, paths };
  page.on('response', r => { if (r.status() >= 400) badResponses.push({url:r.url(),status:r.status()}) });
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("requestfailed", (r) => failed.push(r.url()));
  page.on("request", (r) => {
    paths.add(new URL(r.url()).pathname);
  });
  await page.goto(link);
  await page.getByRole("heading", { name: "Current", exact: true }).waitFor();
  await page
    .getByRole("heading", { name: "Why this needs attention", exact: true })
    .waitFor();
  const origin = await page.evaluate(() => performance.timeOrigin);
  await page
    .getByRole("link", { name: "My work", exact: true })
    .first()
    .click();
  await page.getByRole("heading", { name: "My work", exact: true }).waitFor();
  assert.equal(await page.evaluate(() => performance.timeOrigin), origin);
  await page
    .getByRole("link", { name: "Projects", exact: true })
    .first()
    .click();
  await page.getByRole("heading", { name: "Projects", exact: true }).waitFor();
  assert.equal(await page.evaluate(() => performance.timeOrigin), origin);
  await page
    .getByRole("link", { name: /New issue/ })
    .first()
    .click();
  await page.getByRole("heading", { name: "New issue", exact: true }).waitFor();
  assert.equal(await page.evaluate(() => performance.timeOrigin), origin);
  await page
    .getByRole("link", { name: "Current", exact: true })
    .first()
    .click();
  await page
    .getByRole("heading", { name: "Why this needs attention", exact: true })
    .waitFor();
  await page.screenshot({ path: evidence + "/current-dev-1280.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: evidence + "/current-dev-mobile.png" });
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  );
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.waitForLoadState("networkidle");
  await page.goto(base + "/signin");
  await page
    .getByRole("heading", { name: "Sign in to your workspace" })
    .waitFor();
  await page.getByRole("link", { name: "← Return to welcome" }).click();
  await page.waitForURL(base + "/");
  assert.deepEqual(errors, []);
  assert.deepEqual(failed, []);
  await writeFile(
    evidence + "/dev-runtime-results.json",
    JSON.stringify(
      { passed: true, errors, failed, requestedPaths: [...paths].sort() },
      null,
      2,
    ),
  );
  console.log(
    "Vite development hydration, native sessions, client navigation and responsive capture passed.",
  );
} catch (error) {
  await writeFile(evidence + '/dev-failure.json', JSON.stringify({passed:false, message:error.message,errors:trace?.errors, failed:trace?.failed,badResponses:trace?.badResponses,requestedPaths:[...trace?.paths ?? []].sort()},null,2));
  if (capturePage) await capturePage.screenshot({path:evidence+'/dev-failure.png'});
  throw error;
} finally {
  await browser.close();
}
