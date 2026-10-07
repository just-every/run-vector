import { verificationDirectory } from './verification-paths.mjs';
import { spawnSync, execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const sourceValidation = spawnSync("pnpm", ["run", "sources:check"], { stdio: "inherit" });
if (sourceValidation.status !== 0) process.exit(sourceValidation.status ?? 1);
const evidence = verificationDirectory;
await mkdir(evidence, { recursive: true });
const inputFiles = execFileSync(
  "git",
  ["ls-files", "-co", "--exclude-standard"],
  { encoding: "utf8" },
)
  .split("\n")
  .filter(Boolean)
  .filter(
    (path) =>
      /^(src|migrations|scripts|tests|vendor)\//.test(path) ||
      /^(package\.json|pnpm-lock\.yaml|edition\.json|sources\.lock\.json|wrangler\.jsonc|vite\.config\.ts|vitest.*\.ts|tsconfig.*\.json|seed\.json|CONTRACT\.md|BASELINE\.md)$/.test(
        path,
      ),
  );
const sourceInputHashes = Object.fromEntries(
  await Promise.all(
    [...new Set(inputFiles)].sort().map(async (path) => [
      path,
      createHash("sha256")
        .update(await readFile(path))
        .digest("hex"),
    ]),
  ),
);
const report = {
  startedAt: new Date().toISOString(),
  sourceCommit: execFileSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8",
  }).trim(),
  sourceInputHashes,
  note: "Source may include the candidate changes pending the next local commit.",
  passed: false,
  checks: [],
};
const save = () =>
  writeFile(evidence + "/check-results.json", JSON.stringify(report, null, 2));
await save();
for (const command of [
  "test:node",
  "test:markdown",
  "test:worker",
  "test:deployment",
  "build",
  "test:runtime",
  "test:base-auth",
]) {
  const startedAt = new Date().toISOString();
  const result = spawnSync("pnpm", ["run", command], { stdio: "inherit" });
  report.checks.push({
    command,
    startedAt,
    completedAt: new Date().toISOString(),
    passed: result.status === 0,
  });
  await save();
  if (result.status !== 0) process.exit(result.status ?? 1);
}
report.passed = true;
report.completedAt = new Date().toISOString();
await save();
const registration = spawnSync("pnpm", ["run", "report:contract"], {
  stdio: "inherit",
});
if (registration.status !== 0) process.exit(registration.status ?? 1);
