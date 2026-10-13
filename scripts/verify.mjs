import { verificationDirectory } from './verification-paths.mjs';
import { spawnSync, execFileSync } from "node:child_process";
import { mkdir, writeFile, rm } from "node:fs/promises";
const sourceValidation = spawnSync("pnpm", ["run", "sources:check"], { stdio: "inherit" });
if (sourceValidation.status !== 0) process.exit(sourceValidation.status ?? 1);
const evidence = verificationDirectory;
await mkdir(evidence, { recursive: true });
const report = {
  startedAt: new Date().toISOString(),
  sourceCommit: execFileSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8",
  }).trim(),
  note: "Commands and outcomes for this checkout.",
  passed: false,
  checks: [],
};
const save = () =>
  writeFile(evidence + "/check-results.json", JSON.stringify(report, null, 2));
await save();
for (const command of [
  "sources:verify-base",
  "check",
  "test:installer",
  "test:node",
  "test:markdown",
  "test:worker",
  "test:deployment",
  "build",
  "test:runtime",
  "artifact:delivery",
  "test:wave-b",
  "test:data",
  "test:integrations",
  "test:base-auth",
  "test:access",
  "test:mutation-refresh",
  "test:admin",
  "test:collaboration",
  "test:browse-review",
  "test:installer:native",
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
  // A successful producer owns this fresh output. Verification must leave the
  // later project artifact command its own fresh destination.
  if (command === "artifact:delivery")
    await rm("delivery-artifact", { recursive: true });
}
const uiRuntime = spawnSync(process.execPath, ["tests/e2e/ui-runtime.mjs"], {
  stdio: "inherit",
});
report.checks.push({
  command: "ui-runtime",
  completedAt: new Date().toISOString(),
  passed: uiRuntime.status === 0,
});
await save();
if (uiRuntime.status !== 0) process.exit(uiRuntime.status ?? 1);
report.passed = true;
report.completedAt = new Date().toISOString();
await save();
const registration = spawnSync("pnpm", ["run", "report:contract"], {
  stdio: "inherit",
});
if (registration.status !== 0) process.exit(registration.status ?? 1);
