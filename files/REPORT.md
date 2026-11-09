# sd-vector-c-f205-fix4-pc1

Repository: just-every/run-vector. Product branch: cloud/sd-vector-c-f205-fix4-pc1.
Published continuation head: dfc91418aed7c38860042448e2f442cd78633dde.
Starting published head: 845d247813161432dec41959a2faa72090397bb1.
Merged main: 0b10199c8e0e680447e15291dd8d5b622d5d18c1.

## Plan

The complete operational plan is PLAN.md. Continue the saved head without rewriting published commits; inspect its failed exact-SHA Verify; reproduce the blocker; merge main while retaining newer judgments/tests; prove the parent-list toggle through browser and server doors; regenerate contract/spec/lock metadata; validate touched behavior; publish only the named cloud branch and separately publish explicitly selected reports. Never promote a clause or claim landing.

## Findings and changes

The saved head already implements supported boolean, plain, JSON-quoted and encoded-quoted true/false forms, rejects garbage with HTTP 400, and exposes the sub-team checkbox. Those changes are preserved.

Main now owns 0138_member_suspension.sql. Only the candidate's 0138_sub_teams.sql is renamed to 0139_sub_teams.sql, retaining its bytes. The generated deployment specification contains 0134_slack_threads.sql and both 0138 member suspension and 0139 sub-teams. Conflicting populated-upgrade expectations now assert exact defaults for both migrations and preserve every pre-existing value. The merged member-suspension upgrade fixture initially failed its complete added-object census because 0139 adds two further indexes. Its expected schema census now includes precisely those indexes and altered tables, with explicit root/inheritance default assertions; every existing row, credential, legacy-removal, archive and foreign-key assertion remains. See upgrade-finding.json. Archive-policy comments preserve both candidates' domain-history requirements. SDK regeneration was run and compiled, with no further output change required. Source lock is regenerated after staging the final source changes.

CONTRACT.md changes only the TEAM-006 evidence row relative to main; every clause Status row equals main. Actual source status is TEAM-006 missing -> missing, despite the brief's PARTIAL wording; no judgment is changed. Counts remain done 136 -> 136, partial 72 -> 72, missing 64 -> 64, total 272 -> 272. Migration inventory is 138 -> 139 after merging main and renumbering the candidate. All parent role rows and main's newer judgments are retained. The child-team permission fixes and sibling-door safeguards remain intact; reparented saved-template status references (follow-up C) are outside this round.

## Reproduction and validation

REPRO TEAM-006 server forms: saved head -> 7/7 focused server tests pass, including actual router serialization through native and bearer routes.
REPRO collaboration: saved head -> 25 desktop checks passed; the deliberately bounded 600-second command expired during next-fixture startup. This is not reported as a product assertion failure.
REPRO exact-SHA CI: starting Verify 42562058136 attempt 1 failed collaboration job 128980668346 and final verify job 128987124978. Both prescribed gh run view --log-failed commands returned exit 0 with zero output. A separate REST job receipt confirms the independent shard step failed after roughly 13 minutes; no archive/blob retry was attempted. See starting-ci-receipt.json and starting-collaboration-job.json.

The first external browser probe used a link locator against button rows, then an inappropriate direct-API response waiter and synchronous checkbox-check assertion. Those probe errors were corrected without changing product code or weakening repository tests: the final probe clicks the real control and waits for rendered inclusion/exclusion, then asserts checkbox state, reload persistence and successful HTTP responses.

Actual commands, exit statuses and source provenance are in local-checks.json. Browser receipt and captures are selected separately. Final candidate and CI custody will be recorded in final-receipt.json.

## Mechanical checks

Contract generator: node scripts/contract-docs.mjs write TEAM-006; node scripts/contract-docs.mjs check TEAM-006. Both pass before restoring ACCEPTANCE.md and docs/CLAIMS.md whole from origin/main. Neither generated view is changed relative to main. No view-only failure is concealed.
Migration ledger: node /tmp/vector-ledger.mjs, invoking the package's validateMigrations over all 139 migration files, passes. Deployment migration-repeat test passes.
Deployment specification: node scripts/sync-integration.mjs --write; node scripts/sync-integration.mjs --check. Both pass.
SDK: node sdk/generate.mjs; node sdk/build.mjs. Both pass.
Source lock: pnpm sources:lock; pnpm sources:check. Both pass after staging changes; sources.lock.json is staged last.

## Publication boundaries

Only the declared repository is cloned and written. No PR, main push, deployment, landing, clause promotion or history rewrite is performed. No test is deleted, disabled or weakened; diagnostic test-name selection is recorded explicitly. Fleet evidence stays outside the product tree. Evidence publication proves report custody only; it is separate from product readiness and the fleet's independent publication/landing gates.

## Additional local regression observations

The broad ten-file Worker invocation reached its 600-second bound before printing all failure stacks. Re-running role-matrix alone without changing limits produced four timeouts (30s/120s), not differing expected/actual data assertions. Detached fresh main on the same VM produced three of the same role-suite timeouts. The candidate additionally exceeded the existing 30-second combined team-permission journey; a focused unchanged-limit probe is recorded separately. No role assertions or time limits were changed.

The nine remaining touched Worker files completed: 24 tests passed and the sole failure was the member-suspension upgrade schema census described above. The corrected upgrade fixture then passed its targeted rerun. Triaging the role timeouts did not discard or weaken tests.

The first complete merged collaboration run passed 31 clause checks and failed the second outer viewport's native project-template formatting exercise while pressing `z` into a 100,000-character controlled textarea (tests/e2e/project-templates-journey.mjs:96, existing 20-second action timeout). No Worker exception was recorded. It did not fail the parent-list route or report HTTP 500. The safe, complete assertion/stack and clause results are in collaboration-failure-receipt.json; raw Worker logs, runtime keys and environment files are excluded. This is not represented as a successful full collaboration run.

The isolated combined team-permission test passed in 21.09 seconds under its unchanged 30-second limit (47.98 seconds including transformation/import). This diagnostic selected one existing test; it is not a claim that the four other tests in that file passed. No permission implementation or authority assertion was changed.

Product publication: the fleet identity/trailer audit covered every candidate commit and side parent. The guarded push succeeded on its first attempt. The continuation is a merge commit preserving both published parents; no history was rewritten. The serial collaboration rerun and bounded exact-SHA CI observer are complete; final-receipt.json records their final outcomes.

MECHANICAL ledger=node /tmp/vector-ledger.mjs exit=0; spec=node scripts/sync-integration.mjs --write followed by --check exit=0; lock=pnpm sources:lock followed by pnpm sources:check exit=0; views=node scripts/contract-docs.mjs write TEAM-006 followed by check TEAM-006 exit=0 (then generated views restored whole from origin/main).

The serial collaboration rerun also failed at the same existing native project-template `press("z")` action, this time in the first outer viewport after five clause checks passed (314.37 seconds overall). Worker exceptions remain empty. Concurrency alone therefore does not explain the failure; the full actual safe assertion and clause receipt is collaboration-serial-failure-receipt.json. No project-template code or test limit was changed.

The isolated native project-template journey passes on detached main using the same system Chromium and existing 20-second action limit. This smaller sequence differs from the full collaboration setup, so it does not establish a main/candidate full-collaboration differential. An identical candidate-only isolated comparison is recorded separately.

The identical isolated candidate native template journey also times out in `press("z")`, now in the 100,000-character Milestone description field. Main passed that smaller isolated journey. The action limit and all assertions are unchanged; no template source was edited under the TEAM-006 lease. This is an unresolved local regression observation, not claimed green. See template-comparison-receipt.json.

## Terminal outcome: BLOCKED, product pushed

Head: dfc91418aed7c38860042448e2f442cd78633dde. Exact-SHA Verify run 42576657302 completed/failure. Build, imports, portability, worker-2, hosted-artifact, core-runtime-planning and collaboration jobs succeeded. Core-runtime job 129026111179 failed; administration job 129026111191 was cancelled; final verify job 129034582951 failed. This is not a generated-view-only red and does not qualify for READY.

The actual core-runtime assertion log was read once with `gh run view 42576657302 --repo just-every/run-vector --job 129026111179 --log-failed`, exit 0. It establishes HTTP 429 instead of expected 303 on genuine invitation confirmation in `tests/e2e/core-operator-journey.mjs:34`, called by `tests/e2e/core-runtime.mjs:754` while allocating a fresh operator for stream-control preferences. The exact rate bucket is not captured by this assertion. Base's existing confirmation admission enforces per-IP and per-subject windows in `vendor/base/operator-auth/identity/email-link/index.mjs:23-35`. These files are unchanged from main. Auth-budget policy and unrelated core-fixture restructuring are outside this lease; no limit was widened, counter erased, assertion removed or test disabled. A new authorized scope is needed for that CI blocker.

The collaboration shard is successful on this exact SHA, so the local template action timeouts are retained as local observations rather than misreported as the CI failure. All Worker shards succeeded in CI, alongside the local targeted upgrade and parent-list proofs. Administration is reported honestly as cancelled, with no invented assertion diagnosis.

Repository read budget: five initial repository diagnostics, three exact-SHA discovery/status observations, one final jobs lookup and one failed-job archive read = ten repository calls. The mandatory launcher auth-status setup is recorded separately; the watcher initially counted it conservatively in its prior-call field. No further repository API calls were made. Product transport and separate report transport use ordinary Git.

No clause is promoted and no landing is claimed. TEAM-006 evidence records the working parent-list filter, supported wire forms, 400 garbage rejection, browser inclusion/exclusion/reload proof at 1440/390, and immutable migration renumbering. Counts remain 136 done / 72 partial / 64 missing / 272 total. The brief's PARTIAL wording differs from actual source `missing`; source judgment is preserved exactly. Reparented-template follow-up C remains outside this round.

The complete public-safe packet is published separately under evidence/sd-vector-c-f205-fix4-pc1. Product work is safely pushed; the report ref is evidence custody and never a readiness or landing signal. The task-owned clone and dependencies are removed only after successful report publication and remote-head verification; the packet remains under the fleet work directory.
