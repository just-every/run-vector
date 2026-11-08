# sd-vector-c-f205-fix2 — TEAM-006 continuation

Repository: just-every/run-vector. Product branch: cloud/sd-vector-c-f205-fix2.

## Plan and source custody

See PLAN.md for the complete plan. Fresh full-history clone used `git clone --filter=blob:none` without depth. The fix1 fetch was checked out and `git rev-parse HEAD` printed `cf2bb091b0e6168b3a3924f31d1ef812e5be3b31` as required. fix2 was created from it. Fresh main is `0e8a686c06eddd55943ed1d2690df32a8fc82213`; `git merge --no-ff --no-commit origin/main` reported already up to date because fix1 already contains main. No rebase, force push, published history rewrite, conflict resolution, or applied-migration change occurred. Main's highest migration is 0133_release_notes.sql; this candidate's 0134_sub_teams.sql does not collide. Main's Status rows and ID-MAP remain intact.

## Failures and corrections

Verify 42516503223 for fix1 failed collaboration on dashboard full-list drill-down, core-runtime on stream-controls reset, and hosted-artifact on stale SDK. Main Verify 42503991437 at the main SHA above completed/success (main-runs.jsonl).

REPRO security B: fix1 head -> PASS, non-owner hierarchy permission mutations are 403 and preserve storage; the normal permission endpoint is also 403. This fix was inherited from fix1, not newly claimed here.

REPRO data-loss B: fix1 head -> PASS, reparenting keeps configured Git targets and rule custody for child and descendant. This fix was inherited from fix1.

REPRO worker bar: fix1 head -> PASS for the inherited dependency fix and hierarchy probes. Populated cycle/schema/source-ingest upgrades also pass. No test was deleted, skipped in its definition, or weakened.

REPRO hosted-artifact: fix1 head -> `node sdk/generate.mjs --check` exit 1, SDK stale. PROBE hosted-artifact: generated with `node sdk/generate.mjs`, then the same check -> exit 0, 57 published operations. sdk/generated.ts is generated only, not hand edited.

REPRO dashboard: fix1 head -> full dashboard journey fails waiting for #issue-row-SYNDS-28 after Open full issue list. Browser diagnostic showed the route error at a URL containing includeSubTeams=false. TanStack defaultParseSearch decodes this value to boolean false; the TEAM-006 issue-list schema accepted only string values. A new worker/public-door regression reproduces this with the real router decoder and then checks parent/child results over HTTP for false and true. Original schema: regression exit 1. Fix: preprocess boolean input to the existing string enum at the shared schema boundary; API URLs and stored preferences retain their string representation. Fixed full sub-team/dependency set: 13 tests pass.

REPRO core-runtime reset: the unchanged stream-controls journey at 1440 passes on fix1, including reset after returning from issue detail. No speculative stream implementation change was made. The candidate's exact-SHA CI remains authoritative for the complete journey. The same focused 1440 stream probe also passes after the schema correction.

## Clause judgments and generated files

TEAM-006 stays missing. Its Status row gains candidate test evidence only; its Status and Gap remain unchanged. All 272 clause judgments remain unchanged: 136 done, 72 partial, 64 missing before and after. No Opus interface work or held requirements were changed.

Contract write/check were run with TEAM-006 and exited 0. ACCEPTANCE.md and docs/CLAIMS.md were restored whole from origin/main and are absent from the product diff. Deployment spec was regenerated after rer build with `node scripts/sync-integration.mjs --write`, then checked with --check; both exit 0 and output already matches. Source lock was generated last after staging and checked successfully. No migration renumber or route-inventory regeneration was necessary.

## Validation and terminal provenance

See validation-receipt.json and the actual check logs for commands, exit codes and counts. Browser proof, exact product SHA, push receipt and exact-SHA Verify results are recorded below when complete. Local evidence does not claim hosted commissioning or landing. The Mac fleet retains its independent publication scan and landing gates.

Product commit: `3503a75381109b411d3cac78293b1bbd28d3c82a`. Product push succeeded on first attempt using cloud-push.py, only the named cloud branch. All four commits in origin/main..HEAD, including side parents, have fleet author and committer identities and no co-author trailers. No PR was created; Verify has a cloud-branch push entrypoint and no PR-only landing requirement was found.

The full dashboard journey now passes in light and dark themes at 1440/390, including all 26 project issues in the full list, private omission and Viewer read-only behavior. Screenshots at both widths were inspected. The focused stream-controls journey also passes after the fix at 1440.

MECHANICAL ledger=`node --test scripts/deployment/tests/migration-head.test.mjs` exit=0; spec=`node scripts/sync-integration.mjs --write && node scripts/sync-integration.mjs --check` exit=0; lock=`pnpm sources:lock && pnpm sources:check` exit=0; views=`node scripts/contract-docs.mjs write TEAM-006 && node scripts/contract-docs.mjs check TEAM-006` exit=0, then both generated views restored from origin/main.

Migration-custody receipt confirms all 133 main migration files remain byte-for-byte unchanged; the only addition is 0134_sub_teams.sql above main's highest number. The post-push main fetch still points to the same ancestor.

The complete candidate `core-runtime.mjs current` journey has passed the formerly failing CURR-009/WORK-003 stream-control segment, including both 1440/390 widths. This is additional local proof beyond the focused 1440 probe; the full command receipt is recorded on completion.

The complete local core-current command finished exit 0 under its 1200-second bound: 59 Current checks and 54 independent project checks. Its browser used /usr/bin/chromium with --no-sandbox. Both installations, browsers and their owned servers stopped through the harness/subreaper. All focused commands and the full supplementary command pass. No unrelated stream or project code was changed.

## Terminal CI result and pending retry

Product custody is **PUSHED, not READY** at `3503a75381109b411d3cac78293b1bbd28d3c82a`. Exact-SHA Verify **42520865907 attempt 1 completed/failure**. Its collaboration/dashboard and hosted-artifact shards are green, as are imports, administration, portability and core-runtime-planning. The aggregate verify failure follows two failing shards:

- **worker-2 / job 128854053127**: `tests/worker/data-http-audit-recovery.test.ts:7` timed out at 180000 ms, with D1 foreign-key rollback/reset diagnostics. The unchanged test deliberately corrupts `issue_files.actor_operator_id` and checks failed-restore rollback. The same test on this candidate passes locally: 1/1, 118.43 seconds test time, 127.14 seconds Vitest wall time. No assertion or timeout was changed.
- **core-runtime / job 128854053169**: `tests/e2e/core-stream-controls-journey.mjs:47`, called at line 92 after returning from issue detail, timed out waiting for all filter selects to reset to `all`. This same failure appeared on fix1. The complete local command on this candidate passes 59 Current and 54 independent project checks. The relevant stream workspace, preference hook/queue and stream journey are byte-identical to main; no candidate-caused mechanism has been established. This is not claimed as a main CI failure: main Verify 42503991437 is green. No speculative fix to unleased stream/preference code or test weakening was made.

Each failing assertion job's log was downloaded once through `gh run view --job --log-failed`; the full actual logs are in the packet. The last available GitHub call requested **rerun-failed-jobs** for the same run/SHA and returned **HTTP 201 Created**. The ten-call budget is exhausted; the retry's result is unobserved. The fleet must inspect that exact-SHA retry before any READY/landing decision. This pending retry is not a green check, acceptance or landing claim. No workflow was retried until both failing paths had passed local reproduction commands.

`ci-receipt.json` records the failed attempt and accepted retry; `github-budget.json` accounts for all ten calls. No further product commit or push followed the CI failure. Clause counts and judgments remain 136 done / 72 partial / 64 missing, with TEAM-006 missing. The successful evidence transfer is separate from product readiness. The checkout and node_modules are removed only after successful evidence publication; terminal source and remote custody were saved first.

Additional retained local comparison artifacts show audit-recovery passing on both candidate and main: candidate test 122.43 s (131.30 s Vitest), main test 121.12 s (131.75 s Vitest). The comparison worktree was verified at main `0e8a686c06eddd55943ed1d2690df32a8fc82213` with no tracked changes (only an untracked dependency symlink). These artifacts support a timing investigation; they do not establish that the CI job fails on main. See audit-comparison.json and the two actual logs.
