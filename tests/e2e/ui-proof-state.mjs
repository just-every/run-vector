import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { sourceBinding } from "./admin-capture.mjs";
import { assertControls } from "./ui-controls-checks.mjs";
import { auditProofClearance } from "./ui-proof-clearance.mjs";
import { verificationDirectory } from "../../scripts/verification-paths.mjs";
const require = createRequire(import.meta.url);
const axeSource = await readFile(
  require.resolve("axe-core/axe.min.js"),
  "utf8",
);
const captures = [];
export const proofAuditResults = [];
let binding;
export async function initializeProofBinding() {
  binding = await sourceBinding();
  return binding;
}
export async function assertProofBinding() {
  assert.ok(binding, "proof binding was initialized before runtime startup");
  const final = await sourceBinding();
  assert.equal(
    final.sourceInputDigest,
    binding.sourceInputDigest,
    "review capture source inputs remain unchanged",
  );
  assert.deepEqual(
    final.builtWorkerHashes,
    binding.builtWorkerHashes,
    "review capture worker assets remain unchanged",
  );
  assert.deepEqual(
    final.builtClientHashes,
    binding.builtClientHashes,
    "review capture client assets remain unchanged",
  );
  return binding;
}
export async function auditProofState(
  page,
  name,
  { clauses = [], measurements } = {},
) {
  await page.locator("main").waitFor();
  await page.waitForFunction(
    () =>
      ![...document.querySelectorAll("main [role=status]")].some((element) =>
        /^Loading|^Saving(?:…|\.\.\.| commitment)/.test(
          element.textContent.trim(),
        ),
      ) && !document.querySelector('main [aria-busy="true"]'),
  );
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve)),
    );
  });
  const controls = await assertControls(page, name);
  const clearance = await auditProofClearance(page, name);
  await page.evaluate(axeSource + ";0");
  const violations = await page.evaluate(async () =>
    (await axe.run(document, { resultTypes: ["violations"] })).violations
      .filter((violation) => ["serious", "critical"].includes(violation.impact))
      .map((violation) => ({
        id: violation.id,
        nodes: violation.nodes.map((node) => node.target),
      })),
  );
  assert.deepEqual(
    violations,
    [],
    `${name}: ordinary-run axe has zero serious/critical`,
  );
  const geometry = await page.evaluate(() => ({
    width: innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    height: document.documentElement.scrollHeight,
  }));
  assert.ok(
    geometry.scrollWidth <= geometry.width,
    `${name}: no horizontal overflow ${JSON.stringify(geometry)}`,
  );
  if (process.env.VECTOR_PROOF_CAPTURE === "1") {
    const directory = resolve(verificationDirectory, "review-proof");
    await mkdir(directory, { recursive: true });
    const filename = `${name}.png`;
    await page.screenshot({
      path: resolve(directory, filename),
      fullPage: true,
    });
    const sha256 = createHash("sha256")
      .update(await readFile(resolve(directory, filename)))
      .digest("hex");
    captures.push({
      name,
      clauses,
      measurements,
      clearance,
      filename,
      sha256,
      sourceInputDigest: binding.sourceInputDigest,
      ...geometry,
      violations,
    });
    await writeFile(
      resolve(directory, "manifest.json"),
      JSON.stringify({ binding, captures }, null, 2),
    );
  }
  const result = {
    name,
    clauses,
    measurements,
    clearance,
    viewport: page.viewportSize(),
    ...geometry,
    controls,
    violations,
  };
  proofAuditResults.push(result);
  return result;
}
