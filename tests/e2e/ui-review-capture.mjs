import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { verificationDirectory } from "../../scripts/verification-paths.mjs";

const rows = [];
export async function captureReviewState(page, name, both = false) {
  if (process.env.VECTOR_REVIEW_CAPTURE !== "1") return;
  const directory = resolve(verificationDirectory, "ui-correction");
  await mkdir(directory, { recursive: true });
  const original = page.viewportSize();
  const fieldsScrollTop = await page
    .locator(".decision-fields")
    .evaluateAll((fields) => fields[0]?.scrollTop ?? 0);
  for (const viewport of both
    ? [
        { width: 1440, height: 900 },
        { width: 390, height: 844 },
      ]
    : [original]) {
    await page.setViewportSize(viewport);
    // Callers wait for the state-specific DOM. Responsive captures measure the
    // committed repaint after fonts and ResizeObserver updates, not network quiet.
    await page.evaluate(async () => {
      await document.fonts.ready;
      await new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      );
    });
    await page.locator(".decision-fields").evaluateAll((fields, scrollTop) => {
      if (fields[0]) fields[0].scrollTop = scrollTop;
    }, fieldsScrollTop);
    const metrics = await page.evaluate(() => ({
      documentHeight: document.documentElement.scrollHeight,
      issueHeight:
        document.querySelector(".issue-inspector")?.getBoundingClientRect()
          .height ?? null,
      scrollWidth: document.documentElement.scrollWidth,
      fieldsScrollTop:
        document.querySelector(".decision-fields")?.scrollTop ?? null,
    }));
    const axeSource = await readFile(
      process.env.VECTOR_REVIEW_AXE_SOURCE,
      "utf8",
    );
    await page.evaluate(axeSource + ";0");
    const violations = await page.evaluate(async () =>
      (await axe.run(document, { resultTypes: ["violations"] })).violations
        .filter((v) => ["serious", "critical"].includes(v.impact))
        .map((v) => ({
          id: v.id,
          nodes: v.nodes.map((n) => ({
            target: n.target,
            summary: n.failureSummary,
          })),
        })),
    );
    const filename = `${name}-${viewport.width}.png`;
    await page.screenshot({ path: resolve(directory, filename) });
    await page.screenshot({
      path: resolve(directory, filename.replace(".png", "-full.png")),
      fullPage: true,
    });
    const runtimeWorkerSha256 = createHash("sha256")
      .update(await readFile("dist/server/index.js"))
      .digest("hex");
    const workingDiffSha256 = createHash("sha256")
      .update(execFileSync("git", ["diff", "HEAD"], { encoding: "utf8" }))
      .digest("hex");
    rows.push({
      name,
      viewport,
      runtimeWorkerSha256,
      workingDiffSha256,
      sourceCommit: execFileSync("git", ["rev-parse", "HEAD"], {
        encoding: "utf8",
      }).trim(),
      ...metrics,
      violations,
      axeVersion: await page.evaluate(() => axe.version),
      filename,
    });
    await writeFile(
      resolve(directory, "results.json"),
      JSON.stringify(rows, null, 2),
    );
    assert.deepEqual(
      violations,
      [],
      `${name} ${viewport.width}: no serious or critical accessibility violations`,
    );
    assert.ok(
      metrics.scrollWidth <= viewport.width,
      `${name}: no horizontal overflow`,
    );
  }
  await page.setViewportSize(original);
  await page.locator(".decision-fields").evaluateAll((fields, scrollTop) => {
    if (fields[0]) fields[0].scrollTop = scrollTop;
  }, fieldsScrollTop);
}
