import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const groups = [
  "inline",
  "ux",
  "contrast",
  "navigation",
  "cycle",
  "collaboration",
  "setup",
];

export async function archivePreviousProof(directory) {
  await mkdir(dirname(directory), { recursive: true });
  try {
    await rename(
      directory,
      `${directory}-previous-${Date.now()}-${process.pid}`,
    );
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

export async function runReviewGroups(runChild, environment = process.env) {
  const env = { ...environment };
  // Diagnostic selectors must never narrow ordinary verification.
  delete env.VECTOR_PROOF_GROUP;
  delete env.VECTOR_PROOF_CASE;
  delete env.VECTOR_BASELINE_PROOF;
  const failures = [];
  for (const group of groups) {
    try {
      const status = await runChild(group, {
        ...env,
        VECTOR_PROOF_GROUP: group,
      });
      assert.equal(
        status,
        0,
        `${group}: genuine isolated review installation passes`,
      );
    } catch (error) {
      failures.push(error);
    }
  }
  if (failures.length)
    throw new AggregateError(failures, "Review stages failed");
}

export async function createReviewStageDirectory(directory) {
  await mkdir(dirname(directory), { recursive: true });
  const staging = await mkdtemp(`${directory}-stages-`);
  try {
    await rename(directory, resolve(staging, "ordinary"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  return staging;
}

export async function aggregateReviewReports(
  staging,
  directory,
  binding,
  capture,
) {
  const results = [],
    regressions = [],
    captures = [];
  for (const group of groups) {
    const groupDirectory = resolve(staging, group);
    const report = JSON.parse(
      await readFile(resolve(groupDirectory, "audits.json"), "utf8"),
    );
    assert.deepEqual(
      report.binding,
      binding,
      `${group}: ordinary and review stages bind identical inputs and built assets`,
    );
    assert.ok(
      report.results.length > 0,
      `${group}: ordinary review audit rows are non-vacuous`,
    );
    results.push(...report.results);
    regressions.push(
      ...JSON.parse(
        await readFile(resolve(groupDirectory, "regressions.json"), "utf8"),
      ),
    );
    if (capture) {
      const manifest = JSON.parse(
        await readFile(resolve(groupDirectory, "manifest.json"), "utf8"),
      );
      assert.deepEqual(
        manifest.binding,
        binding,
        `${group}: capture binding matches the ordinary installation`,
      );
      assert.equal(
        manifest.captures.length,
        report.results.length,
        `${group}: every audited state is captured`,
      );
      assert.deepEqual(
        manifest.captures.map((row) => row.name),
        report.results.map((row) => row.name),
        `${group}: captures identify every audited state in order`,
      );
      for (const row of manifest.captures) {
        assert.equal(
          row.sourceInputDigest,
          binding.sourceInputDigest,
          `${row.name}: capture source digest matches`,
        );
        assert.equal(
          row.filename,
          `${row.name}.png`,
          `${row.name}: capture filename identifies its audited state`,
        );
        const bytes = await readFile(resolve(groupDirectory, row.filename));
        assert.equal(
          createHash("sha256").update(bytes).digest("hex"),
          row.sha256,
          `${row.name}: retained PNG matches its capture hash`,
        );
        captures.push({ ...row, filename: `${group}/${row.filename}` });
      }
    }
  }
  assert.ok(
    regressions.length && regressions.every((row) => row.passed),
    "independent review cases all pass",
  );
  assert.equal(
    new Set(results.map((row) => row.name)).size,
    results.length,
    "every review audit state is retained exactly once",
  );
  await rename(staging, directory);
  const report = { binding, results };
  await writeFile(
    resolve(directory, "audits.json"),
    JSON.stringify(report, null, 2),
  );
  await writeFile(
    resolve(directory, "regressions.json"),
    JSON.stringify(regressions, null, 2),
  );
  if (capture)
    await writeFile(
      resolve(directory, "manifest.json"),
      JSON.stringify({ binding, captures }, null, 2),
    );
  return report;
}
