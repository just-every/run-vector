# sd-vector-c-f202-fix2

Repository: just-every/run-vector. Product branch: cloud/sd-vector-c-f202-fix2. Scope is the two INIT-003 gate blockers, with no status promotion, no change to start-only lifecycle styling and no landing claim.

## Provenance and plan

A fresh full-history blob-filtered clone confirmed origin/cloud/sd-vector-c-f202-fix1 at exactly 4881b2069146819298fe5f7672bcea2d71a93704. The fix2 branch starts at fresh main 442b61455234c57befcb642bf4afdaa2dc459922 and merges that published candidate. No history was rebased or force-pushed. PLAN.md contains the full execution plan.

## Reproduction and correction

REPRO body: 4881b2069146819298fe5f7672bcea2d71a93704 merged with main -> FAIL. A physical mouse drag at the one-day body center hit the target-date handle. The request contained only targetDate; startDate stayed 2026-11-09 and targetDate became 2026-11-12.

PROBE body: fixed -> PASS. The same mouse gesture hits Move One-day project; the request contains both dates, and both move from 2026-11-09 to 2026-11-12 with one date activity and zero-day duration retained. The narrow bar body has precedence and its date handles sit outside its body. The existing journey gains a physical one-day body drag and endpoint checks.

REPRO milestone: same merged head -> FAIL. The API returns the undated project's 2026-11-14 milestone; desktop has zero matching markers.

PROBE milestone: fixed -> PASS. Desktop has one visible dated milestone marker on its own timeline row; the project still has no dates or project bar and remains in Unscheduled. The milestone also remains visible at 390px. The existing journey gains an undated project with a dated milestone and asserts no invented project dates. Actual browser captures are roadmap-fixed-1440.png and roadmap-fixed-390.png.

Commands (each run via cloud_run with a hard timeout): `timeout 300 node /tmp/roadmap-blockers.mjs body repro`, `timeout 300 node /tmp/roadmap-blockers.mjs milestone repro`, followed by the identical body/milestone commands with phase `probe`. The actual runner is retained as roadmap-blockers.mjs, and JSON receipts contain requests/results without sessions, cookies or credentials.

Before/after gate blockers: 2 -> 0 in the targeted probes.

## Mechanical checks

- `npx -y @runeditrun/rer setup --owner-email fleet@runeditrun.com --non-interactive`: exit 0, owned temporary server stopped.
- `npx -y @runeditrun/rer build`: exit 0, including `pnpm typecheck` and production build.
- `node --test scripts/deployment/tests/migration-head.test.mjs`: exit 0, one test. All 134 main migration files remain byte-for-byte unchanged. The candidate introduces no migrations, so no renumbering or upgrade-fixture rewrite is needed.
- `node sdk/generate.mjs`, then `node sdk/generate.mjs --check`: exit 0, 56 operations, no generated diff.
- `node scripts/contract-docs.mjs write INIT-003`, then `node scripts/contract-docs.mjs check INIT-003`: exit 0. Restored ACCEPTANCE.md and docs/CLAIMS.md whole from origin/main; neither view is committed.
- `pnpm integration:sync`, then `pnpm integration:check`: exit 0, no generated spec diff.

No CONTRACT.md or ID-MAP judgment changed. Main's actual INIT-003 row and narrative say **missing**, whereas the brief labels the candidate PARTIAL. Following the instruction to retain main's judgments and make no judgment change, the repository stays missing; the candidate is not promoted beyond the brief's PARTIAL ceiling. Status counts remain 136 done / 72 partial / 64 missing / 272 total, before and after.

## Verification notes

An initial worker invocation incorrectly passed a literal `--` to Vitest and started the broad suite rather than the intended file. It was stopped by its own PID (exit 143), with a data-http test timeout observed; it is not claimed as a passing suite. The corrected targeted invocation and final browser journey results are recorded below when complete.

The first expanded browser journey reached the diamond drag, then timed out dragging an Unscheduled project: the two regression fixtures pushed the drop row below the timeline's scroll viewport. The helper now scrolls the drop target into view during its physical drag. Existing assertions are preserved; no test was removed, skipped or weakened.

Corrected targeted worker: `cloud_run timeout 300 pnpm exec vitest run --config vitest.config.ts tests/worker/roadmap.test.ts` -> exit 0, one file / one test passed.

Full roadmap browser journey: `cloud_run timeout 600 node /tmp/roadmap-blockers.mjs journey probe2` -> exit 0. Passed placements, initiative spans, dated markers, target diamond and Unscheduled drags, body and both endpoints including one-day body, keyboard zoom movement, planning fields, stale 409 refusal, private-team projection, Guest/Viewer read-only behavior, phone list, Light/Dark/System themes, text/control and mark contrast, axe and hydration checks.

Final `pnpm sources:lock` and `pnpm sources:check` both exited 0 after staging the final regression helper edit. No generated view file is in the staged product tree. A staged diff whitespace check reports the candidate's pre-existing blank EOF line in src/core/features/administration/project-fields.ts:41 (exit 2); that unrelated source line is preserved under this fix-only lease. Diff whitespace checks for all fix2-touched files against the published candidate pass.

MECHANICAL ledger=`node --test scripts/deployment/tests/migration-head.test.mjs` exit=0; spec=`pnpm integration:sync && pnpm integration:check` exit=0; lock=`pnpm sources:lock && pnpm sources:check` exit=0; views=`node scripts/contract-docs.mjs write INIT-003 && node scripts/contract-docs.mjs check INIT-003` exit=0 (views then restored from origin/main).

## Product custody

Product head: `c39e92e479af0387250fbff2d96c69a754fd640f`. Merge parents: `442b61455234c57befcb642bf4afdaa2dc459922`, `4881b2069146819298fe5f7672bcea2d71a93704`. All four candidate commits, including the side parent history, have fleet author and committer identities and no trailers. Active fleet commit-msg cleanup preserves repository hooks. The guard pushed the named branch successfully on its first attempt. Product checkout/index were clean after push. No PR was required by the seed rules or created, and main was not pushed or fast-forwarded.

Fix2-specific source/test changes relative to the published candidate are preserved in fix2.patch. Source references: src/core/features/roadmap/page.tsx:88 (undated milestone rows), :92 (one-day body class and no invented undated bar); src/core/features/roadmap/roadmap.css:7 (one-day body precedence and exposed endpoints); tests/e2e/roadmap-journey.mjs:18, :46 and :106 (fixtures, marker/no-date assertions and physical one-day drag).

## Exact-SHA CI

Verify run 42533113770 on `c39e92e479af0387250fbff2d96c69a754fd640f` completed with **failure**. Six throttled REST discovery/status calls were used. Job diagnostics are pending; no READY claim is made from this red run. CI URL: https://github.com/just-every/run-vector/actions/runs/42533113770.

Job metadata from call 7: plan=success (job 128891470225); build=success (job 128891502432); shards (portability, true, true, true)=success (job 128891744652); shards (worker-2, true, true, true)=failure (job 128891744674); shards (imports, true, true, true)=success (job 128891744699); shards (core-runtime-planning, true, true, true)=success (job 128891744700); shards (administration, true, true, true)=success (job 128891744703); shards (collaboration, true, true, true)=success (job 128891744705); shards (core-runtime, true, true, true)=success (job 128891744707); shards (hosted-artifact, true, true, false)=failure (job 128891744713); verify=failure (job 128897467539). The successful core-runtime job runs the independent projects installation, which includes the shipped roadmap journey. Failed archive-log diagnostics follow below; the aggregate verify job fails because required shards are red.

Worker-2 archive log (call 8, command `gh run view 42533113770 --repo just-every/run-vector --job 128891744674 --log-failed`, exit 0): 18 test files / 28 tests passed; one failure in tests/worker/role-matrix.test.ts:242, the existing every-role/door journey, `Test timed out in 120000ms`. This is not a generated-view failure. The timeout and assertions remain unchanged. An unchanged-limit local diagnostic is being run before determining whether the timeout is reproducible. Full sanitized log: ci-job-128891744674.log.

Unchanged-limit worker diagnostic: `cloud_run timeout 300 pnpm exec vitest run --config vitest.config.ts tests/worker/role-matrix.test.ts -t 'every role-matrix row with a door'` exited 0. The selected case passed in 58.02 seconds against its unchanged 120-second limit; the other five cases were not selected by this diagnostic filter. No test source, assertion or timeout was changed. The CI timeout was not reproduced locally. Actual receipt/log: role-matrix-diagnostic.json and role-matrix-diagnostic.log.

Hosted-artifact archive (call 9, `gh run view 42533113770 --repo just-every/run-vector --job 128891744713 --log-failed`, exit 0): test:integrations failed in exerciseSlackAppInstallation at tests/e2e/integrations/slack-app-installation.mjs:118:196 with Playwright `response.json: Protocol error (Network.getResponseBody): No resource with given identifier found` and `Response body is not available for a response that was navigated away from. Read response.body() before triggering any navigation.` The existing Slack integration journey is outside this INIT-003 fix lease. No Slack source or assertion is changed. Full sanitized log: ci-job-128891744713.log. This is not a generated-view-only failure and does not qualify for READY.

Both substantive failed-job archives were fetched exactly once, with gh handling archive redirects and no manual Authorization header. The aggregate verify failure is the workflow wall reflecting those two failed shards, not a separate product assertion. Its shell dependency guard is recorded in ci-jobs.json; the last call is reserved for rerun-failed-jobs rather than downloading that aggregate wrapper log. The existing role case passes locally unchanged and the Slack error is a browser response/navigation race outside this two-finding lease, so a same-SHA retry of failed jobs is requested with the final GitHub call. No additional product change is made.

## Final result

**PUSHED**, branch `cloud/sd-vector-c-f202-fix2`, head `c39e92e479af0387250fbff2d96c69a754fd640f`. PR: none. Verify run **42533113770** attempt 1 failed on the role-matrix timeout and Slack installation browser response/navigation race described above. GitHub accepted `gh api --method POST repos/just-every/run-vector/actions/runs/42533113770/rerun-failed-jobs --include` at 2026-11-08T23:47:09.418924+00:00 with HTTP **201**, exit 0, on the same SHA. The ten-call GitHub budget is exhausted; retry completion is unobserved. No green, READY, acceptance, promotion, merge or landing is claimed.

Both INIT-003 blocking findings are fixed and their before/after probes pass. Local build/typecheck, roadmap worker, complete roadmap browser journey, unchanged-limit focused role-matrix diagnostic, ledger, SDK, integration spec, contract generator and source lock checks pass. CI core-runtime (including the independent project/roadmap journey) passed on this exact SHA. Remaining delivery dependency: the exact-SHA failed-jobs retry must complete successfully, or its separate CI failures need handling within an appropriate lease. No tests, time limits or assertions were weakened. No contract judgment changes; counts remain 136 done / 72 partial / 64 missing / 272 total.

Evidence is published only to `refs/heads/evidence/sd-vector-c-f202-fix2`, independently of product custody. All selected files are regular files; reports contain synthetic fixtures and sanitized public workflow logs, without credential values, environment dumps, held-out gate material or settings/database/session artifacts. Product worktree is clean. Owned servers and browsers are stopped. The requested clone/node_modules cleanup follows successful evidence publication; this external packet and the remote product/evidence branches are retained.
