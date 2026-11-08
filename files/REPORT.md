# sd-vector-c-f205-fix1 — Vector TEAM-006 gate fix

Repository: just-every/run-vector
Product branch: cloud/sd-vector-c-f205-fix1
Product head: cf2bb091b0e6168b3a3924f31d1ef812e5be3b31
Original gate head: 69464a9b035333e4b9bcbdbd6d2ceed672c3a378
Fresh main: 0e8a686c06eddd55943ed1d2690df32a8fc82213
Exact-head Verify: 42516503223 — completed/failure on the exact product SHA. Outcome: BLOCKED; product fixes are pushed, but READY is not claimed.
PR: none; the brief sends the product branch to the fleet lander.

## Plan and custody

The complete plan is in PLAN.md. The repository was freshly cloned with `git clone --filter=blob:none`, without depth. `git rev-parse --is-shallow-repository` returned false. The fetched candidate head was checked against the required 40-character SHA and printed before creating the fix branch. A subsequent fresh `git fetch origin main` and fleet-identity `git merge --no-ff --no-commit origin/main` returned "Already up to date": main was already an ancestor, so no artificial merge or history rewrite was needed. Its CONTRACT rows and both generated views remain byte-for-byte unchanged; SOURCE-INTEGRITY.json records their hashes and exact equality to main. No tracked ID-MAP file exists in either main or the candidate, and no map file was modified.

The final fix is one commit on the published candidate, with no skip-CI marker. Every candidate author and committer is Run Edit Run fleet <fleet@runeditrun.com>; all three complete candidate messages were inspected, including side-parent traversal, and contain no co-author trailers. The product push used the supplied cloud-push.py guard, succeeded on attempt one, and targeted only the named cloud branch. Reports and receipts are outside the product tree. Product custody is independent of evidence publication and of the fleet's later publication scan and landing.

## Blocking findings and fixes

REPRO security: head -> a non-owner Member with all-members team-setting permission gets 403 at the ordinary permission door but 200 when setting root planningPermission through hierarchy. The regression assertion fails 200 versus expected 403.

PROBE security: fixed -> the same sub-teams test command passes. Both session and bearer hierarchy requests return 403 and preserve teams, workflow rows, audit records and audit details. A team owner, Admin and workspace Owner can still set the permission. `changeHierarchy` now uses the existing teams.permissions policy in addition to hierarchy authority when explicit permission values are supplied, and includes that authority fence in the transaction.

REPRO automation: head -> reparenting an inheriting child with configured Git automation produces status_id=null and leaves its rule version at 1. The workflow-status foreign key clears the target when replacement IDs are deleted.

PROBE automation: fixed -> the same sub-teams test command passes. Both child and inheriting descendant retain their configured target in the effective workflow, allow-reopen and environment options remain intact, rule versions advance to 2, stale version-1 edits return 409, and foreign-key checks remain empty. Replacement writes remap matching configured rules before deleting the former status in the same transaction. This does not add Git-rule inheritance or qualify held TEAM-006 requirements.

REPRO workers: head -> `pnpm test:worker tests/worker/dependencies.test.ts tests/worker/source-ingest.test.ts tests/worker/cycle-schedule.test.ts` exits 1: exactly 3 failures and 11 passes, reproducing the original CI assertion causes on Node 22.20.0. The dependency fixture uses seven positional workflow-status values after the additive eighth column. The triage and cycle upgrade fixtures compare whole historical rows without the new hierarchy defaults.

PROBE workers: fixed -> the identical command exits 0: all 14 tests pass. The dependency fixture now names its existing columns. The triage fixture asserts every historical value plus explicit null/zero/one hierarchy defaults and null workflow inheritance. The cycle fixture compares complete upgraded rows against the complete original rows plus the explicit new defaults. No test was deleted, skipped or weakened.

REPRO deployment spec: head -> `pnpm integration:check` exits 1, reporting stale management/integration/deployment-spec.json.

PROBE deployment spec: fixed -> after the documented build and `pnpm integration:sync`, the same check exits 0. The generated spec gains the complete 0134_sub_teams.sql migration record and digest. Main's highest migration is 0133_release_notes.sql; there is no collision, and no main migration was edited or renumbered.

## Validation and mechanical receipts

- Sub-teams command: before 2 failed / 1 passed, after 3 passed. This includes the existing unconditional membership/hierarchy/list journey.
- Three affected worker files: before 3 failed / 11 passed, after 14 passed.
- Typecheck: `pnpm typecheck`, exit 0.
- Build: `npx -y @runeditrun/rer build` through cloud_run, exit 0, including artifact privacy checks.
- Mounted permission-door inventory: assertRoleDoorCoverage, exit 0, 372 mounted routes and 27 forms. Its existing dynamic census already covers the hierarchy doors; no inventory weakening or removal was needed.
- Migration ledger: `node --test scripts/deployment/tests/migration-head.test.mjs`, exit 0. It applies the complete migration set, compares the exact ledger, proves idempotence and checks foreign keys and retained owner/invitation guards.
- Contract: `node scripts/contract-docs.mjs write TEAM-006` then `check TEAM-006`, both exit 0. ACCEPTANCE.md and docs/CLAIMS.md were restored whole from origin/main; neither is committed in this fix.
- Deployment spec: `pnpm integration:sync` and `pnpm integration:check`, both exit 0.
- Source lock: product edits were staged first; `pnpm sources:lock` was the last regeneration, followed by `pnpm sources:check`, both exit 0.
- Bootstrap/auth setup diagnosis: rer setup had generated a local setup token that alters the configured-owner bootstrap path. With the generated settings file moved aside without reading or publishing it, all 9 existing bootstrap/auth tests pass. No product change was made for that local condition.
- Focused API/base/project upgrade runs: 7 tests pass. Focused role-matrix/custom-field/project-dependency upgrade runs: 7 tests pass.
- Final `rer verify`: exit 0, including production artifact and hydration boundaries. An external test-process launch adapter selected `/usr/bin/chromium` and `--no-sandbox`; its first optional invocation was stopped before completing to enforce this cloud browser setting. No assertion or dependency file was changed for it.
- A preliminary broad baseline run was deliberately stopped with exit 143 after the exact three-failure scoped reproduction completed. It is not claimed as a completed baseline wall. The fixed serial `pnpm test:worker` invocation reached its 1,500-second hard limit with exit 124 before completing, without reporting an assertion failure. Its owned Vitest child was stopped and reaped. It is explicitly **not** claimed as a passed complete local wall; the complete exact-SHA CI wall is the readiness gate. The required scoped before/after command completed: all 14 affected worker tests and all 3 sub-teams tests passed.

MECHANICAL ledger=node --test scripts/deployment/tests/migration-head.test.mjs exit=0; spec=pnpm integration:sync && pnpm integration:check exit=0; lock=pnpm sources:lock && pnpm sources:check exit=0; views=node scripts/contract-docs.mjs write TEAM-006 && node scripts/contract-docs.mjs check TEAM-006 exit=0.

## Clause counts and scope

Before and after: 136 done, 72 partial, 64 missing, 272 total. Clause status changes: none. TEAM-006 remains **missing** in both its actual CONTRACT definition and inventory row; the brief's historical "claimed PARTIAL" description is not a persisted judgment in the supplied candidate. No judgment was raised. The Opus interface work and the held TEAM-006 requirements were untouched. No UI file changed, so changed-screen browser proof is inapplicable to this fix.

## CI observations and remaining gates

Original Verify 42510260429 is completed/failure on 69464a9b035333e4b9bcbdbd6d2ceed672c3a378. The retained failed-job archives identify the exact three worker assertion causes. Its core-runtime job also had a stream-controls waitForFunction timeout at tests/e2e/core-stream-controls-journey.mjs:47; that UI file was not changed. The final candidate's independent exact-SHA wall determines readiness.

Final Verify 42516503223 is **completed/failure** on cf2bb091b0e6168b3a3924f31d1ef812e5be3b31. The worker-2 job 128840864479, portability job 128840864538, and imports job 128840864565 all pass, covering every one of the six worker partitions. Build, administration and core-runtime-planning also pass. The three worker failures from the brief are cleared on exact-head CI.

The remaining failed jobs are collaboration 128840864547, core-runtime 128840864548 and hosted-artifact 128840864595, plus the aggregate verify job. The collaboration failure log was retrieved once with the required archive command. Trigger: after a dashboard project filter selects the 26-issue fixture and its "Open full issue list" link is followed, navigation reaches `/app/issues` but `#issue-row-SYNDS-28` never becomes visible. The 20-second locator timeout is at `tests/e2e/dashboards-journey.mjs:88:65`, in the hunk at lines 86–90. The underlying product cause is not established. No dashboard/UI file or assertion was changed: this is outside the brief's three blocking fixes and explicitly held interface work. The remaining two failed job logs were not retrieved because the ten-call GitHub budget is exhausted; their causes are not guessed. CI-RECEIPT.json includes every actual API/archive invocation, job ID and observed conclusion.

**BLOCKED:** the required exact-SHA Verify is red for a substantive browser assertion, not generated contract views. The FIX-round source changes and required scoped checks are complete and pushed, but a READY line would be false. The lane must supply an authorized follow-up for the dashboard/UI failure and inspect the other failed jobs, or independently rerun the gates. No missing builder receipt or absence of READY is presented as an independent reason to reject the pushed product.

The complete report packet is selected explicitly for publication to `refs/heads/evidence/sd-vector-c-f205-fix1`; the terminal EVIDENCE line supplies its exact resulting head. The clone and its dependencies will be removed only after successful evidence publication, as requested. No landing, provider commissioning, held acceptance, or fleet Mac publication-scan success is claimed. Actual per-command logs, SHA-256 receipts, product provenance and the exact fix diff accompany this report.
