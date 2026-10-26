import { verificationDirectory } from './verification-paths.mjs';
import { buildCommands, ciCommands, verificationShards } from './verification-plan.mjs';
import { spawnSync, execFileSync } from "node:child_process";
import { mkdir, writeFile, rm, access } from "node:fs/promises";
const args = process.argv.slice(2);
const prebuiltSha = process.env.VECTOR_VERIFY_PREBUILT_SHA;
delete process.env.VECTOR_VERIFY_PREBUILT_SHA;
const shard = args.length === 3 && args[0] === '--ci' && args[1] === '--shard' ? args[2] : undefined;
if (!(args.length === 0 || (args.length === 1 && args[0] === '--ci') ||
  (shard && Object.hasOwn(verificationShards, shard))))
  throw Error('Use no arguments for build verification, --ci for all test suites, or --ci --shard <name>.');
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
if (shard) report.shard = shard;
const reportPath = shard ? `${evidence}/shard-${shard}.json` : `${evidence}/check-results.json`;
const save = () => writeFile(reportPath, JSON.stringify(report, null, 2));
await save();
let commands = shard ? verificationShards[shard].commands : ci ? ciCommands : buildCommands;
// Only the named shard's initial build can reuse this run's immutable artifact.
// Serial verification and the hosted-artifact fresh-build checks stay intact.
if (prebuiltSha) {
  if (!shard || shard === 'hosted-artifact' ||
      prebuiltSha !== report.sourceCommit || !commands.includes('build'))
    throw Error('Prebuilt output must belong to this SHA and a production-runtime shard.');
  await access('dist/server/wrangler.json');
  await access('dist/client');
  const firstBuild = commands.indexOf('build');
  commands = commands.filter((_, index) => index !== firstBuild);
  report.reusedBuildSha = prebuiltSha;
  await save();
}
for (const entry of commands) {
  const [script, ...scriptArgs] = typeof entry === 'string' ? [entry] : Array.isArray(entry) ? entry : [];
  const executable = script ? 'pnpm' : process.execPath;
  const commandArgs = script ? ['run', script, ...scriptArgs] : entry.node;
  const command = script ? [script, ...scriptArgs].join(' ') : ['node', ...commandArgs].join(' ');
  const startedAt = new Date().toISOString();
  const result = spawnSync(executable, commandArgs, { stdio: "inherit" });
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
