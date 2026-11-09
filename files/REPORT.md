# sd-vector-ci-shape-1 — CI worker shape

Repository: just-every/run-vector. Product branch: cloud/sd-vector-ci-shape-1.
Base: 0b10199c8e0e680447e15291dd8d5b622d5d18c1 (fresh full-history origin/main).

## Plan and implementation

The complete executed plan is in PLAN.md. Only scripts/verification-plan.mjs and sources.lock.json are product changes. The plan gives role-matrix.test.ts and data-http-audit-recovery.test.ts a dedicated worker-heavy row, and every original six-partition invocation excludes those paths before Vitest partitions the remaining suite. Each command retains its isolated Vitest process. The serial ciCommands wall still runs the entire suite. No workflow or package script change is needed.

The existing workflow exports verificationMatrix dynamically, uses all entries as matrix.include, and runs the named verificationShards commands. The required aggregate job stays named verify and depends on the entire shards job. The new worker-only row has browser=false, native=false, prebuilt=false. Existing rows, flags and non-worker commands are unchanged. There are 9 matrix rows instead of 8. The existing 25-minute job cap is unchanged; combining the remaining long browser/native rows would exceed their measured budgets. No test, assertion or timeout was edited, deleted, skipped or weakened. No product code or CONTRACT.md change was made. No PR is required by this repository's AGENTS.md; no PR or landing action was performed.

## Measure first

Vitest 4.1.11 list --filesOnly --shard=2/6 unexpectedly listed all 119 configured files. The equivalent runner API was used instead: createVitest -> globTestSpecifications -> configured sequence.sequencer.shard, matching the executeTests code path in the installed Vitest. Both heavy files are in 2/6, which is combined with 3/6 and development in worker-2. The complete lists were obtained before modifying the plan and retained in the packet.

| File | Original partition / row | Hosted file seconds | Provenance |
| --- | --- | ---: | --- |
| tests/worker/role-matrix.test.ts | 2/6 / worker-2 | 265.318 | Recovered cached Verify 42621810959 job 129176165524 archive |
| tests/worker/data-http-audit-recovery.test.ts | 2/6 / worker-2 | 170.408 | Recovered cached Verify 42621810959 job 129176165524 archive |

The REST job metadata independently shows worker-2 job 129176165524 in successful Verify 42621810959 ran from 2026-11-09T13:02:29Z to 13:26:37Z: 1448 seconds = 24m08s. Subtracting the recovered 265.318-second role-matrix measurement from that successful run leaves approximately 19m43s, above the ~12-minute threshold; audit recovery therefore moves with role-matrix. This is an estimate from whole-job timing (including development/setup), not a newly measured post-move hosted duration.

Historical log limitations: gh run view 42638728947 --repo just-every/run-vector --job 129234385701 --log-failed returned “run ... is still in progress; logs will be available when it is complete”; it was not retried. gh run view 42621810959 --repo just-every/run-vector --job 129176165524 --log returned exit 0 with zero log bytes. A single gh api repos/just-every/run-vector/actions/jobs/129176165524/logs then failed on the storage redirect with Forbidden. The sanitized transport error is recorded in receipt.json. No further blob-download retries were made. The earlier zero-byte terminal output concealed a successfully downloaded gh CLI cache ZIP. During resumed validation, that local archive was inspected without another GitHub call. Its worker-2 log establishes role-matrix 265.318s, audit recovery 170.408s, partition 2/6 925.55s and partition 3/6 303.67s. Only those non-secret timing lines were retained as historical-timings.txt. The additional sequence 75, 103, 116, 266, 368 seconds and the later 180-second audit timeout remain owner-supplied historical context, not independently re-read measurements.

## Exact file coverage

COVERAGE.md and partitions-before.json / partitions-after.json contain every actual file per partition and CI row. plan-check.json records the executable assertions; partition-proof.mjs and plan-check.mjs preserve their source.

Before: 119 files (118 worker tests plus installer/outbox.test.ts), six partitions of 20,20,20,20,20,19. After: six ordinary partitions of 20,20,20,19,19,19 plus two files in worker-heavy. Union equality is exact; duplicate=0, omitted=0, added=0. Vitest rebalances remaining file boundaries after exclusions; the complete per-file lists record those movements. The dedicated CLI filters resolve to exactly the two intended files.

## Local checks

No dedicated verification-plan tests/check exist in the repository: rg over tests, scripts and .github finds the plan, scripts/verify.mjs consumer and workflow consumer only. The external executable proof checks unchanged serial commands, all original non-worker command sequences/flags, exact file coverage, all six exclusion arguments, dynamic workflow inclusion, the 25-minute cap and the aggregate guard. node --check scripts/verification-plan.mjs, that proof, pnpm check, and pnpm typecheck all passed. Setup/install were run through cloud_run and publication hooks were reinstalled afterwards. Detailed final lock, worker and CI results will be appended below.

## Clause status and boundaries

No clause status changed and no clause is claimed. Before/after: 136 done, 72 partial, 64 missing, 272 total. Published: 98 done, 6 partial, 0 missing (104); target/push-further: 38 done, 66 partial, 64 missing (168). CONTRACT.md, ACCEPTANCE.md and docs/CLAIMS.md stay untouched. This is a CI-shape round, with no acceptance, publication-scan or landing claim. The Mac fleet owns publication scanning and landing.

## Baseline execution bound

The unchanged original 2/6 partition was run locally with a 720-second command bound and JSON reporter. It reached that bound (exit 124) before the reporter wrote its final JSON. No local baseline per-file duration or passing result is claimed. Typecheck ran concurrently for part of that baseline; local wall time is not directly comparable to hosted timing. A fresh two-file worker selection also failed to produce a final JSON report within its command bound; no passing local worker result is claimed. The hosted exact new row did pass, as recorded below.

## Exact-SHA hosted new row

Verify 42648235349 on 55d6f915ff823e06f674376500e3e4deb6d2d8fa contains shards (worker-heavy, false, false, false). Job 129268000389 completed success from 2026-11-09T15:49:06Z to 15:54:39Z: 333 seconds = 5m33s. Its matrix inclusion and execution are directly established by ci-jobs-intermediate.json. Worker-2 was still in progress at that observation; no full-wall success is inferred from this one successful row.

Local toolchain note: the supplied toolchain script selected pnpm 10.12.4 and retained the VM's Node 24.19.0 (it installs the repository's Node 22.20.0 only when the VM version is older). pnpm warned about the engine pin. The hosted workflow explicitly uses Node 22.20.0. Local timings are reported separately from hosted timings.

## Hosted worker comparison and retry

The latest jobs observation shows worker-2 completed successfully in 929 seconds (15m29s), versus 1448 seconds (24m08s) in the measured baseline: 519 seconds (8m39s), approximately 35.84%, less whole-job wall time. Worker-heavy completed successfully in 333 seconds (5m33s); it had no baseline row. These are observed different-run timings, not controlled benchmarks. The worker-2 whole job still exceeds 12 minutes with both heavy files removed, supporting the decision to move audit recovery along with role-matrix.

At the first resumed status observation, Verify 42648235349 was completed/cancelled. At the next observation, its latest jobs showed an externally initiated retry: administration was running from 16:18:28Z, all other reported rows had passed and retained their earlier execution timestamps under new job IDs. No CI rerun was requested by this resumed executor. Full-wall success remains pending; see the final receipt.

## Terminal exact-SHA Verify result

Verify 42648235349, attempt 2, is **completed / cancelled** at exact product head `55d6f915ff823e06f674376500e3e4deb6d2d8fa`. URL: https://github.com/just-every/run-vector/actions/runs/42648235349. This terminal run observation supersedes earlier retry-running snapshots. The aggregate required verification wall is not green, and **READY is not claimed**. Both changed worker rows passed on this exact SHA. Administration was the sole still-running row in the latest jobs snapshot; its diagnostic is being retrieved once within the ten-call budget.

The terminal status is in ci-status-final.json and CI-RESULT.json. ci-jobs-final.json is an earlier retry snapshot, not a terminal job observation. No post-change per-file timing or final administration duration is claimed. Worker-2 was successful in 15m29s, and worker-heavy was successful in 5m33s.

Product custody: cloud/sd-vector-ci-shape-1 at `55d6f915ff823e06f674376500e3e4deb6d2d8fa`, pushed once through cloud-push.py. Only scripts/verification-plan.mjs and sources.lock.json changed. Remote main was rechecked and remained the original base. No merge/rebase, default-branch push, PR, deploy or landing was performed. All read-only test, timeout, workflow, package and contract source hashes remain unchanged; the product working tree is clean. Fleet author/committer identities and all messages were checked across origin/main..HEAD; no trailers exist.

Local checks passed: node syntax check, executable verification-plan and exact-file union proof, actual CLI repeated-exclusion check, pnpm check, pnpm typecheck, source lock generation/check and staged diff check. The baseline worker execution hit its 720-second bound; the separate local heavy selection produced no final JSON and is not claimed as passing. The hosted new row passed.

MECHANICAL lock=pnpm sources:lock exit=0; check=pnpm sources:check exit=0

CLAIM none — CI-shape round. Clause statuses and counts stay at 136 done, 72 partial, 64 missing, 272 total. No acceptance, publication-scan or landing claim.

The complete plan/results and actual receipts are selected explicitly for the separate evidence/sd-vector-ci-shape-1 report-only ref. Evidence publication is independent of product custody and cannot turn this cancelled required Verify into READY. The pushed clone/dependencies will be removed after successful evidence publication as requested; the product commit remains on its named remote branch.

## Remaining blocker and diagnostic

The one permitted administration archive invocation was `gh run view 42648235349 --repo just-every/run-vector --job 129285466554 --log-failed`: exit 0, zero stdout bytes. As with the historical archive, the gh CLI nevertheless cached a ZIP. Its administration log explicitly records `2026-11-09T16:43:38.6079869Z ##[error]The operation was canceled.` The job started at 16:18:28Z: approximately 25m10s earlier, consistent with the unchanged 25-minute job cap. Selected non-secret command/test-summary/cancellation lines are retained in administration-cached-diagnostics.txt; no complete raw CI log or private runtime values are published. The terminal run status remains completed/cancelled. No assertion failure was emitted in the retained lines.

All ten GitHub invocations are recorded in receipt.json; no further calls or blocked blob retries were made. Both worker rows passed, while the unchanged administration/ownership runner exhausted its existing job window. Administration/ownership commands and their tests are outside this worker-row lease, so no further product changes are made. The lane needs a separately scoped administration CI-shape decision/fix and a green exact-SHA Verify before READY. No timeout was increased.

The retained log shows test:admin passed all 80 tests in 987804.091033 ms (16m28s). The combined row then reached test:wave-b at 16:41:16Z and test:base-auth at 16:42:40Z before cancellation at 16:43:38Z. The unchanged composition is scripts/verification-plan.mjs, verificationShards.administration = combineGroups([administration, ownership]); changing that non-worker row is outside the current lease.
