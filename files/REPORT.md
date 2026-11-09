# sd-vector-ci-shape-2 report

Repository: just-every/run-vector. Product branch: cloud/sd-vector-ci-shape-2.

## Plan and scope

1. Fresh full-history clone (is-shallow-repository=false); fetch ci-shape-1 and main. Require and print ci-shape-1 HEAD 55d6f915ff823e06f674376500e3e4deb6d2d8fa. Create ci-shape-2 there and merge origin/main. Main 0b10199c8e0e680447e15291dd8d5b622d5d18c1 was already its ancestor; merge returned Already up to date. No history rewrite.
2. Measure the two prior administration cancellations and earlier green row totals using hosted job metadata and permitted log reads. Preserve non-secret timing receipts.
3. Move the full ownership group, in its original order, from administration to worker-heavy. Base-auth alone removes only about one minute and leaves administration above 23 minutes. Administration alone is about 16.5 minutes; ownership is about 8 minutes; worker-heavy was 5m33s. Estimated changed rows including runner overhead: administration ~17m, worker-heavy ~14m.
4. Prove matrix/serial-command stability, command coverage and 119-file worker coverage; run node syntax check, pnpm typecheck, pnpm check; stage plan; run pnpm sources:lock last and pnpm sources:check. Leave all tests, timeouts, product code and CONTRACT.md untouched.
5. Inspect all candidate identities/trailers including side parents, commit as fleet through the preserved repository hooks, and use the cloud push guard for the named product branch. Observe exact-SHA Verify through REST within ten-call budget; publish only explicit non-secret packet files to the separate evidence ref.
6. After publication and custody verification, delete the requested product clone and node_modules; preserve the packet outside it.

## Measurement

Command durations below are log-boundary wall times, not profiler data. Direct node runtime start lines are absent; adjacent preceding success/final-summary and next pnpm header bound them, including small launch and cleanup gaps. Base-auth is censored by job cancellation, so its duration is a lower bound. Shard build is reused (0m in administration); the separate shared build job was 1m07s including setup in prior Verify.

| Administration command | 42648235349 attempt 1 minutes | attempt 2 minutes |
| --- | ---: | ---: |
| build | 0 (shared) | 0 (shared) |
| test:admin | 16.510 | 16.479 |
| current-intake-runtime | 1.540 | 1.451 |
| theme-runtime | 2.316 | 2.290 |
| housekeeping-runtime | 1.916 | 1.892 |
| test:wave-b | 1.425 | 1.406 |
| test:base-auth | 0.918+ | 0.963+ |

Both attempts passed all 80 administration tests (79 clause journeys / 102 browser checkpoints). Attempt 1 cancelled while base-auth was running; attempt 2 printed its 9 successful checks immediately before cancellation, without runner success/cleanup completion. Both exceeded the 25-minute job cap.

| Row | prior attempt 1 total | attempt 2 total | earlier green 42621810959 total |
| --- | ---: | ---: | ---: |
| administration | 25m16s | 25m15s | 24m06s |
| worker-heavy | 5m33s | 5m33s | absent |
| core-runtime-planning | 16m28s | 16m28s | 18m33s |
| portability | 15m02s | 15m02s | 22m40s |
| worker-2 | 15m29s | 15m29s | 24m08s |
| imports | 15m10s | 15m10s | 21m24s |
| hosted-artifact | 24m04s | 24m04s | 15m51s |
| core-runtime | 18m06s | 18m06s | 20m16s |
| collaboration | 22m37s | 22m37s | 22m55s |

Prior collaboration (22m37s) and hosted-artifact (24m04s) are above the aspirational ~20m target but below 25m; the earlier green run also had several rows above 20m. Their commands are outside this rebalancing change and remain intact. New exact-SHA totals determine actual headroom; no claim that every existing row is below 20m is inferred from estimates.

Earlier green job metadata was available, but gh run view 42621810959 --repo just-every/run-vector --job 129176165475 --log returned exit 0 with zero log bytes. A single permitted gh api repos/just-every/run-vector/actions/jobs/129176165475/logs call returned exit 1: Get https://productionresultssa10.blob.core.windows.net/[actions-results path; signed query removed]: Forbidden. No numeric HTTP status was supplied by gh. No blocked blob retry was attempted. Earlier-green per-command timings could not be recovered; prior-attempt command timings above remain direct measured evidence.

## Before/after commands and matrix

Rows keep the same shard identifiers and aggregate verify dependency. The workflow and package scripts are unchanged. Receiving worker-heavy now has browser=true, native=false, prebuilt=true. The moved journeys launch Chromium and local emitted Wrangler Workers; none runs the native installer/archive/dev setup that needs the workflow disk-reservation flag. The existing ownership browser metadata supplies Chromium, and its build marker supplies the exact-SHA shared output. The other seven rows are byte-for-byte equal in the exported plan.

Build markers are declarative prerequisites: adding one to worker-heavy requests the shared output and verify.mjs removes that first marker before execution. Both administration and worker-heavy reuse it. Therefore the raw plan contains one additional build marker; the actual CI command multiset stays equal. Hosted-artifact retains its two fresh build boundaries.

| Row | Before (ordered) | After (ordered) |
| --- | --- | --- |
| imports | test:worker --shard=4/6 --exclude=tests/worker/role-matrix.test.ts --exclude=tests/worker/data-http-audit-recovery.test.ts; test:worker --shard=5/6 --exclude=tests/worker/role-matrix.test.ts --exclude=tests/worker/data-http-audit-recovery.test.ts; build; node tests/e2e/data-runtime.mjs; node tests/e2e/related-runtime.mjs; node tests/e2e/issue-copy-runtime.mjs | test:worker --shard=4/6 --exclude=tests/worker/role-matrix.test.ts --exclude=tests/worker/data-http-audit-recovery.test.ts; test:worker --shard=5/6 --exclude=tests/worker/role-matrix.test.ts --exclude=tests/worker/data-http-audit-recovery.test.ts; build; node tests/e2e/data-runtime.mjs; node tests/e2e/related-runtime.mjs; node tests/e2e/issue-copy-runtime.mjs |
| portability | test:worker --shard=1/6 --exclude=tests/worker/role-matrix.test.ts --exclude=tests/worker/data-http-audit-recovery.test.ts; test:worker --shard=6/6 --exclude=tests/worker/role-matrix.test.ts --exclude=tests/worker/data-http-audit-recovery.test.ts; build; node --import ./tests/e2e/integrations/register-loader.mjs tests/e2e/data-roundtrip.mjs | test:worker --shard=1/6 --exclude=tests/worker/role-matrix.test.ts --exclude=tests/worker/data-http-audit-recovery.test.ts; test:worker --shard=6/6 --exclude=tests/worker/role-matrix.test.ts --exclude=tests/worker/data-http-audit-recovery.test.ts; build; node --import ./tests/e2e/integrations/register-loader.mjs tests/e2e/data-roundtrip.mjs |
| core-runtime | build; node tests/e2e/core-runtime.mjs current | build; node tests/e2e/core-runtime.mjs current |
| core-runtime-planning | build; node tests/e2e/core-runtime.mjs planning | build; node tests/e2e/core-runtime.mjs planning |
| administration | build; test:admin; node tests/e2e/current-intake-runtime.mjs; node tests/e2e/theme-runtime.mjs; node tests/e2e/housekeeping-runtime.mjs; test:wave-b; test:base-auth | build; test:admin |
| collaboration | build; test:collaboration; sources:verify-base; check; test:installer; test:markdown; test:deployment; node tests/e2e/cycle-schedule-runtime.mjs; node tests/e2e/personal-time-runtime.mjs; node tests/e2e/cycle-report-runtime.mjs; node tests/e2e/project-report-runtime.mjs | build; test:collaboration; sources:verify-base; check; test:installer; test:markdown; test:deployment; node tests/e2e/cycle-schedule-runtime.mjs; node tests/e2e/personal-time-runtime.mjs; node tests/e2e/cycle-report-runtime.mjs; node tests/e2e/project-report-runtime.mjs |
| worker-2 | test:worker --shard=2/6 --exclude=tests/worker/role-matrix.test.ts --exclude=tests/worker/data-http-audit-recovery.test.ts; test:worker --shard=3/6 --exclude=tests/worker/role-matrix.test.ts --exclude=tests/worker/data-http-audit-recovery.test.ts; build; test:dev:ci | test:worker --shard=2/6 --exclude=tests/worker/role-matrix.test.ts --exclude=tests/worker/data-http-audit-recovery.test.ts; test:worker --shard=3/6 --exclude=tests/worker/role-matrix.test.ts --exclude=tests/worker/data-http-audit-recovery.test.ts; build; test:dev:ci |
| worker-heavy | test:worker tests/worker/role-matrix.test.ts tests/worker/data-http-audit-recovery.test.ts | test:worker tests/worker/role-matrix.test.ts tests/worker/data-http-audit-recovery.test.ts; build; node tests/e2e/current-intake-runtime.mjs; node tests/e2e/theme-runtime.mjs; node tests/e2e/housekeeping-runtime.mjs; test:wave-b; test:base-auth |
| hosted-artifact | test:public-site; verify; build; test:access; test:mutation-refresh; build; test:integrations; test:archive-upgrade | test:public-site; verify; build; test:access; test:mutation-refresh; build; test:integrations; test:archive-upgrade |

## Coverage and checks

No standalone verification-plan test/check script exists in the checkout. node --check scripts/verification-plan.mjs and the external check-plan.mjs assert serial/build command equality, unchanged row IDs/other rows, receiving flags, preserved moved sequence, effective command multiset equality, and zero duplicate non-build commands. The repository pnpm check is also required and passed.

Plan coverage: 9 -> 9 rows; 36 -> 36 non-build commands, zero duplicates; 38 -> 38 executed commands after normal shared-build reuse. Worker wall: 119 -> 119 files, zero duplicates/omissions, worker invocations unchanged. Vitest list --filesOnly bypasses runtime sharding, so the inventory uses its actual installed BaseSequencer.shard after collecting the exact post-exclusion candidates. No tests are executed/changed by inventory collection.

Local checks: node syntax and plan coverage pass; pnpm typecheck exit 0; pnpm check exit 0. Installed with pnpm install --frozen-lockfile; hooks reinstalled after dependency setup. Local toolchain per supplied bootstrap: Node v24.19.0 / pnpm 10.12.4; hosted Verify pins Node 22.20.0. Full row execution is supplied by hosted exact-SHA Verify, not inferred from local inventory.

MECHANICAL lock=pnpm sources:lock exit=0; check=pnpm sources:check exit=0

Only scripts/verification-plan.mjs and its sources.lock.json hash are product changes for this continuation. The inherited ci-shape-1 commit adds the two-file worker isolation; this branch replaces it for landing. No product behavior, test, timeout, workflow, generated acceptance/claims view or contract change. No evidence files enter the product tree.

## Clause custody

Before/after done/partial/missing: 136/72/64 -> 136/72/64 (272 total). Clause status changes: none. CLAIM: none. No acceptance, landing, or hosted commissioning claim.

## Exact-SHA Verify result

Verify 42662451317 completed/failure on 8c8ae182873d8ca4a6c33fae3b7c0f63d78bd2eb. This is not READY. Both changed rows succeeded, each below 16 minutes including setup. The independent, unchanged hosted-artifact row failed at its verification step (9m56s in that step, 10m30s total), not a 25-minute cancellation. The aggregate verify job then failed. There is no evidence that the generated-contract-view exception applies.

| Job | Exact-SHA total | Result |
| --- | ---: | --- |
| plan | 0m09s | success |
| build | 0m44s | success |
| shards (worker-heavy, true, false, true) | 15m52s | success |
| shards (hosted-artifact, true, true, false) | 10m30s | failure |
| shards (core-runtime, true, true, true) | 18m53s | success |
| shards (collaboration, true, true, true) | 21m54s | success |
| shards (portability, true, true, true) | 22m56s | success |
| shards (worker-2, true, true, true) | 13m25s | success |
| shards (core-runtime-planning, true, true, true) | 18m25s | success |
| shards (imports, true, true, true) | 23m32s | success |
| shards (administration, true, true, true) | 15m49s | success |
| verify | 0m04s | failure |

Changed rows: administration 25m16s cancelled -> 15m49s success; worker-heavy 5m33s success -> 15m52s success while taking all five ownership commands. No shard was cancelled in this candidate. Imports (23m32s), portability (22m56s), and collaboration (21m54s) remain above the aspirational ~20-minute target; all are unchanged and passed.

Blocker: hosted-artifact job 129317819048 failed pnpm verify:ci --shard hosted-artifact. Its package setup and Chromium steps passed. The precise failing nested command/assertion was not retrieved: the ten-call budget was exhausted by timing measurement and exact-SHA status/job discovery. The unexecuted diagnostic is gh run view 42662451317 --repo just-every/run-vector --job 129317819048 --log-failed. This requires lane follow-up or a renewed diagnostic budget. No infrastructure cancellation was established, so no rerun was attempted. No test/product change outside the lease is made.

The branch is pushed and retained on origin, not accepted or landed. No PR was created; the checkout rules did not require one. The Mac fleet publication scan and a successful exact-SHA wall remain landing prerequisites.

## Terminal provenance

{
  "repository": "just-every/run-vector",
  "branch": "cloud/sd-vector-ci-shape-2",
  "head": "8c8ae182873d8ca4a6c33fae3b7c0f63d78bd2eb",
  "baseCiShape1": "55d6f915ff823e06f674376500e3e4deb6d2d8fa",
  "mainMerged": "0b10199c8e0e680447e15291dd8d5b622d5d18c1",
  "productPush": "success, first attempt, non-force",
  "verifyRunId": 42662451317,
  "verifyStatus": "completed",
  "pr": null,
  "landingClaim": false,
  "publicationScan": "fleet Mac only, pending downstream",
  "cleanup": "Product clone and node_modules are to be removed after evidence publication and remote evidence verification. Packet is retained outside the clone.",
  "githubInvocationBudget": {
    "used": 10,
    "maximum": 10,
    "remaining": 0,
    "failedLogCommandNotRun": "gh run view 42662451317 --repo just-every/run-vector --job 129317819048 --log-failed",
    "reason": "All ten permitted invocations consumed by prior timing retrieval, exact-SHA discovery/status, and final job metadata. No blocked blob retry or CI rerun."
  },
  "verifyConclusion": "failure",
  "ready": false,
  "custody": "PUSHED; exact-SHA Verify red, not READY",
  "blocker": "Unchanged hosted-artifact job 129317819048 failed pnpm verify:ci --shard hosted-artifact at its Verify the independent shard step; aggregate verify job 129331355850 consequently failed. No shard was cancelled. Underlying subcommand/assertion unavailable within the exhausted ten-call GitHub budget. No infrastructure cause established; no rerun authorized on that evidence.",
  "rowTimings": [
    {
      "id": 129317259739,
      "name": "plan",
      "status": "completed",
      "conclusion": "success",
      "seconds": 9,
      "startedAt": "2026-11-09T17:13:13Z",
      "completedAt": "2026-11-09T17:13:22Z"
    },
    {
      "id": 129317376442,
      "name": "build",
      "status": "completed",
      "conclusion": "success",
      "seconds": 44,
      "startedAt": "2026-11-09T17:13:24Z",
      "completedAt": "2026-11-09T17:14:08Z"
    },
    {
      "id": 129317818994,
      "name": "shards (worker-heavy, true, false, true)",
      "status": "completed",
      "conclusion": "success",
      "seconds": 952,
      "startedAt": "2026-11-09T17:14:11Z",
      "completedAt": "2026-11-09T17:30:03Z"
    },
    {
      "id": 129317819048,
      "name": "shards (hosted-artifact, true, true, false)",
      "status": "completed",
      "conclusion": "failure",
      "seconds": 630,
      "startedAt": "2026-11-09T17:14:11Z",
      "completedAt": "2026-11-09T17:24:41Z"
    },
    {
      "id": 129317819083,
      "name": "shards (core-runtime, true, true, true)",
      "status": "completed",
      "conclusion": "success",
      "seconds": 1133,
      "startedAt": "2026-11-09T17:14:11Z",
      "completedAt": "2026-11-09T17:33:04Z"
    },
    {
      "id": 129317819117,
      "name": "shards (collaboration, true, true, true)",
      "status": "completed",
      "conclusion": "success",
      "seconds": 1314,
      "startedAt": "2026-11-09T17:14:11Z",
      "completedAt": "2026-11-09T17:36:05Z"
    },
    {
      "id": 129317819185,
      "name": "shards (portability, true, true, true)",
      "status": "completed",
      "conclusion": "success",
      "seconds": 1376,
      "startedAt": "2026-11-09T17:14:11Z",
      "completedAt": "2026-11-09T17:37:07Z"
    },
    {
      "id": 129317819187,
      "name": "shards (worker-2, true, true, true)",
      "status": "completed",
      "conclusion": "success",
      "seconds": 805,
      "startedAt": "2026-11-09T17:14:11Z",
      "completedAt": "2026-11-09T17:27:36Z"
    },
    {
      "id": 129317819228,
      "name": "shards (core-runtime-planning, true, true, true)",
      "status": "completed",
      "conclusion": "success",
      "seconds": 1105,
      "startedAt": "2026-11-09T17:14:11Z",
      "completedAt": "2026-11-09T17:32:36Z"
    },
    {
      "id": 129317819256,
      "name": "shards (imports, true, true, true)",
      "status": "completed",
      "conclusion": "success",
      "seconds": 1412,
      "startedAt": "2026-11-09T17:14:11Z",
      "completedAt": "2026-11-09T17:37:43Z"
    },
    {
      "id": 129317819589,
      "name": "shards (administration, true, true, true)",
      "status": "completed",
      "conclusion": "success",
      "seconds": 949,
      "startedAt": "2026-11-09T17:14:11Z",
      "completedAt": "2026-11-09T17:30:00Z"
    },
    {
      "id": 129331355850,
      "name": "verify",
      "status": "completed",
      "conclusion": "failure",
      "seconds": 4,
      "startedAt": "2026-11-09T17:37:45Z",
      "completedAt": "2026-11-09T17:37:49Z"
    }
  ]
}

Detailed machine receipts and the complete ordered command snapshots accompany this report. Raw workflow logs, environment sections, local settings, databases, secrets and signed URLs are excluded from publication.
