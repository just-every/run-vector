# sd-vector-c-f205-fix4 — targeted TEAM-006 parent list

Product repository: just-every/run-vector
Product branch: cloud/sd-vector-c-f205-fix4
Product head: 845d247813161432dec41959a2faa72090397bb1
Required fix3 base: 213e0580f8238114beb1016eb788de0d130849ab
Fresh main before and after publication: bf872df8566011be5e46c6b5f777fb46d11b0f27
Exact-SHA Verify: 42562058136, https://github.com/just-every/run-vector/actions/runs/42562058136
PR: none; this repository's supplied landing rules do not require one. No main/default-branch push, rebase, force push, landing, deployment or acceptance claim.

## Plan and implementation

The complete plan is PLAN.md. The executed steps were fleet identity/authentication/hooks/toolchain setup; full-history filtered clone; exact fix3 verification; fresh-main integration; server and browser reproduction; narrow shared-filter normalization, document admission and filter control; the same regression and browser probes plus types/build; migration/SDK/spec/contract/source-lock mechanics; candidate identity inspection and guarded publication; exact-SHA CI observation and separate report publication.

The clone used `git clone --filter=blob:none` with no depth. `git rev-parse --is-shallow-repository` returned false. The fix3 branch was fetched and its checked-out HEAD printed and required to equal 213e0580f8238114beb1016eb788de0d130849ab before starting this candidate. Fresh main was already an ancestor. A second post-publication fetch/merge also reported Already up to date. The initial required-branch fetch received HTTP 503; after the prescribed 15-second backoff, launcher refresh and decrypted-bundle Git helper setup, the second fetch succeeded.

The cause was the shared issue-list schema accepting booleans and plain `true`/`false` strings but rejecting the router's JSON-quoted strings. SSR parses the browser URL before loading the issue resource, so `includeSubTeams=%22true%22` raised an exception and returned HTTP 500. The schema now normalizes booleans, plain strings, quoted strings and encoded quoted strings to the same canonical string. Unknown values remain invalid. An authenticated parent-list document guard returns HTTP 400 for a malformed filter before SSR. Native and bearer issue routes retain their normal HTTP 400 validation. The existing Team filter now exposes Include sub-teams when a team is selected; it uses the existing router and preference path.

Changed product files: src/core/features/issues/list-schema.ts, src/core/features/issues/ui/issue-filters.tsx and src/core/app/worker.ts. The new public-route regression is tests/worker/sub-team-filter.test.ts. Only the TEAM-006 Status table evidence cell in CONTRACT.md changed; sources.lock.json was regenerated. No permission, sibling audit, saved-template reparenting, migration SQL or unrelated clause was changed.

## Reproduction and proof

REPRO A: head -> HTTP 500 at 1440 and 390 for the actual quoted parent-list URL. See repro-browser.json and repro-1440.png/repro-390.png.

REPRO A server: head -> the new focused regression failed with ZodError on a quoted filter; command `timeout 180 pnpm test:worker tests/worker/sub-team-filter.test.ts`, exit 1. See repro-filter.log.

PROBE A: fixed -> HTTP 200 at 1440 and 390. Through Chromium /usr/bin/chromium with --no-sandbox, the owner opened a real parent list, clicked Include sub-teams, saw both parent and child issues, reloaded successfully, clicked it off and saw only the parent issue. Invalid document filter -> HTTP 400. Browser fixtures use native authenticated product routes, not application mocks. See fixed-browser.json, browser-proof.mjs and parent-list-1440.png/parent-list-390.png. The script waits for hydration around real clicks; earlier harness attempts that used link locators for button rows or synchronous checkbox checking were corrected before the passing run.

PROBE A server: fixed -> `timeout 240 pnpm test:worker tests/worker/sub-team-filter.test.ts tests/worker/sub-teams.test.ts`, exit 0, 7/7 tests across two files. The regression directly checks boolean inputs and sends plain, quoted and encoded-quoted true/false values and the actual TanStack serializer's output through both native and bearer routes, asserting exact returned parent/child identities. Six garbage forms are refused HTTP 400 on each route. Existing hierarchy and child-permission safeguards still pass. See probe-filter.log.

`timeout 240 pnpm test:worker tests/worker/base-refresh-upgrade.test.ts tests/worker/dependencies.test.ts tests/worker/project-report.test.ts` -> exit 0, 13/13 tests. See probe-upgrade-dependencies-reports.log.

The broad shard-2 reproduction was bounded at 600 seconds and returned 124, after reporting two role cases as failed without completing the shard. The unchanged Owner-role and private-visibility cases subsequently passed separately: `pnpm test:worker tests/worker/role-matrix.test.ts -t 'Owners change roles'` (1 selected test, exit 0) and `-t 'current private'` (1 selected test, exit 0). No test was deleted, skipped in source or weakened, and no timeout/assertion was changed. A separate initial unsharded discovery and a redundant broader probe were stopped by their own process IDs (exit 143) to narrow this work. These interrupted/bounded invocations are not full-wall passes. See repro-worker.log, repro-shard-2.log, probe-regressions.log, repro-role-owner.log and probe-role-private.log.

`pnpm typecheck` -> exit 0. `cloud_run timeout 600 npx -y @runeditrun/rer build` -> exit 0, including production typecheck/build and rer's output boundary. See typecheck.log and build.log. The supplied toolchain was sourced in checkout shells; it selected pinned pnpm 10.12.4 and used the environment's newer Node 24.19.0 under the provided shim's version rule; rer recognized the project's Node 22.20.0 pin. No pin was changed.

## The separate f207 blocking-bar reference

The required discovery found Verify 42513319748 at exactly 806b1715d89a5383b5722b1b6c37a615b0665763. Its imports, worker-2, portability and hosted-artifact jobs failed. Each requested failed-job archive command was invoked once; each exited 0 with zero output bytes and no transport error or HTTP response body. The run-wide command named in the brief was also empty. Exact commands and IDs are in github-calls.json; actual API metadata and zero-byte outputs are retained.

The referenced commit's subject is “Prove suspension retains personal history while clearing revoked Inbox pages”. Git proves it is not an ancestor of this TEAM-006 candidate and `git grep includeSubTeams 806b1715... -- src` finds no matching source. See reference-scope.json. The seven assertions therefore could not be identified from the returned logs, and no assertion repair on that separate suspension candidate is claimed. No suspension changes were imported or edited outside this lease. The actual candidate has the local proofs above; its own exact-SHA Verify remains the independent gate. The lane must retain this discrepancy when assessing the extra blocking-bar paragraph.

## Mechanical checks and clause judgments

MECHANICAL ledger=`node --test scripts/deployment/tests/migration-head.test.mjs` exit=0; spec=`pnpm integration:sync && pnpm integration:check` exit=0; lock=`pnpm sources:lock && pnpm sources:check` exit=0; views=`node scripts/contract-docs.mjs write TEAM-006 && node scripts/contract-docs.mjs check TEAM-006` exit=0.

Main's highest migration is 0137, so this candidate's 0138_sub_teams.sql has no collision and was retained byte-for-byte. The generated deployment spec includes both 0134_slack_threads.sql and 0138_sub_teams.sql. `node sdk/generate.mjs` regenerated 57 published operations; SDK and integration generation produced no new diff because the required fix3 base already had their current outputs. The migration proof applies the full ledger, verifies digests and populated guards, then repeats without writes.

The touched contract write/check passed, after which ACCEPTANCE.md and docs/CLAIMS.md were restored whole from origin/main. Neither view file is in this task's commit. The inherited candidate already contains earlier generated-view commits; to keep this commit free of view changes and its lock valid on its published tree, source locking/checking used the inherited committed view bytes. Exact-head source checking passed after the commit. The views were then restored to origin/main in the disposable worktree again, without committing them. A check of the committed inherited views against the updated TEAM-006 evidence fails only on generated ACCEPTANCE.md drift, as recorded in committed-view-check.log. The Mac lander regenerates both views from the merged CONTRACT.md and locks its own merged tree. No generated view was committed to obtain green CI.

Status counts before -> after: done 136 -> 136; partial 72 -> 72; missing 64 -> 64; total 272 -> 272. No clause status changed. The brief calls TEAM-006 PARTIAL, but both supplied fix3 source and fresh main record missing, including its parent narrative. That actual judgment was preserved; only evidence was appended to its Status table cell. No other clause or parent Status row was removed. See contract-counts.json.

## Product custody and CI

845d247813161432dec41959a2faa72090397bb1 was committed with fleet author and committer and active preserved repository hooks. Every candidate commit, including side parents, was inspected using the exact origin/main..HEAD identity/trailer command. Only fleet and the existing owner's identities appeared; there were no OpenAI/Codex co-author lines or disallowed trailer addresses. The guarded push succeeded on its first attempt and created only cloud/sd-vector-c-f205-fix4. See identity-check.log, product-push.log and RECEIPT.json. No intermediate save, retry, rewrite, second product push or PR was needed.

Final custody is PUSHED. Verify 42562058136 was still in_progress with conclusion null on the exact SHA after the final permitted observation; the ten-call GitHub budget is exhausted. READY is not claimed. CI observations are recorded in CI-STATUS.md and the actual CI JSON receipts. A queued/in-progress run is never green, and no green from another SHA is used. Product publication, report publication and landing are separate. The fleet publication scan is not available in this VM and no publication-scan/landing claim is made.

## Deferred work and cleanup

Saved issue templates that retain deleted status IDs after reparenting remain deferred to the next authorized TEAM-006 round, as instructed. Child-team permission and sibling-door implementations were not changed. Full clause acceptance, a status increase, the separate suspension candidate's seven unspecified failures and hosted behavior are not claimed.

The owned browser contexts were closed, and `rer dev --stop` stopped the owned dev server PID 3147 and its four descendants. A preview --stop command was also issued after setup's temporary local operation. All bounded tests/builds finished or were stopped through their own PIDs. After report transport and final provenance are retained, the disposable clone and node_modules are removed; the actual non-secret packet stays outside that clone under the task directory.
