import { verificationDirectory } from './verification-paths.mjs';
import { spawnSync, execFileSync } from "node:child_process";
import { mkdir, writeFile, rm } from "node:fs/promises";
const args = process.argv.slice(2);
if (args.length > 1 || (args.length === 1 && args[0] !== '--ci'))
  throw Error('Use no arguments for build verification, or --ci for the test suites.');
const ci = args[0] === '--ci';
const sourceValidation = spawnSync("pnpm", ["run", "sources:check"], { stdio: "inherit" });
if (sourceValidation.status !== 0) process.exit(sourceValidation.status ?? 1);
const evidence = verificationDirectory;
await mkdir(evidence, { recursive: true });
const report = {
  startedAt: new Date().toISOString(),
  sourceCommit: execFileSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8",
  }).trim(),
  note: ci ? "Vector CI test suites and build checks." : "Build, artifact and contract checks; no test suites.",
  passed: false,
  checks: [],
};
const save = () =>
  writeFile(evidence + "/check-results.json", JSON.stringify(report, null, 2));
await save();
const commands = ci ? [
  "sources:verify-base",
  "check",
  "test:installer",
  "test:markdown",
  "test:worker",
  "test:deployment",
  "test:public-site",
  "build",
  "integration:check",
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
] : [
  "sources:verify-base",
  "check",
  "build",
  "integration:check",
  "artifact:delivery",
];
for (const command of commands) {
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
report.passed = true;
report.completedAt = new Date().toISOString();
await save();
