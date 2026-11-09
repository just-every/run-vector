# TEAM-006 child-team permission authority repair

Outcome: **BLOCKED**.

Repository: `just-every/run-vector`  
Branch: `cloud/sd-vector-c-f205-fix3`  
Product head: `36530f6ec447f66fe76ca2c7cef9adecbab53d1f`  
PR: none; this repository permits the named branch's push Verify before landing.

## Result

The child permission setter now uses the same ROLE-009 team-owner authority as the root setter for both accepted keys, `settings` and `planning`. The shared service independently checks and transactionally fences that authority before no-op or write paths. Team owners, workspace Owners and Admins still succeed. Ordinary Members are refused even when both parent and child permit all members to manage ordinary settings.

The sibling-door audit also closed permission changes through hierarchy inheritance: changing values, inheritance choice or an inherited source parent requires the same owner authority. Identical current values do not permit a Member to move an inherited child under a parent they own and widen its permissions later. Ordinary hierarchy/workflow edits that do not alter permission authority retain the existing settings rule. Parent/child, graph, current-role, membership and old-value transaction fences remain active.

Implementation: `src/core/features/roles/doors.ts`, `src/core/features/team-membership/permissions.ts`, `src/core/features/sub-teams/hierarchy.ts`. Public regressions are in the existing permission test file `tests/worker/sub-teams.test.ts`. [DOOR-AUDIT.md](DOOR-AUDIT.md) lists every permission/visibility writer checked, including native and API hierarchy/privacy, creation, strict ordinary updates, descendant propagation, membership, restore and scoped/agent surfaces. No sibling explicit-value, inheritance-choice or source-parent permission path remains open to an ordinary child-team Member.

## Plan and ancestry

[PLAN.md](PLAN.md) contains the full plan and audit expansion. Execution: fleet identity and preserving hooks; fresh full-history filtered clone; require fix2 pin; merge fresh main preserving judgments; reproduce before fixing; repair and audit public doors; run touched/membership/type/build/browser checks; generate allowed metadata and source lock; inspect all candidate identities/messages; push only the named branch; inspect exact-SHA Verify; publish this explicitly selected report packet on the separate evidence ref; remove the clone and node_modules after transfer.

The clone used `git clone --filter=blob:none` without depth and `--is-shallow-repository` returned false. The checked-out candidate printed exactly `3503a75381109b411d3cac78293b1bbd28d3c82a`. Fix3 was created there. Fresh main `ea77c904c8e553bca43f152710a5d04e4e9e2587` was merged; a subsequent fresh fetch/merge found main unchanged. Additive door-registry and archive-policy conflicts retain both candidate hierarchy code and main's newer Slack/automation work. No applied migration was changed, removed or renamed. CONTRACT.md is unchanged from the required candidate, including its pre-existing candidate-only evidence narrative and every Status judgment.

Our two product commits, both pushed through the guard on attempt 1:

- `d5b49dd4127152146f2e4bf4b668a2da430e4ed5` — owner authority for child permission writes and merged main.
- `36530f6ec447f66fe76ca2c7cef9adecbab53d1f` — inherited source-parent authority, stronger no-op proof, exact upgrade defaults and regenerated deployment metadata/lock.

Every candidate commit, including side parents, has fleet author and committer. Full messages and trailers were inspected before each push; no OpenAI/Codex co-author or personal-address trailer survived. No published history was rewritten, default branch pushed, PR opened or landing attempted. Product commits contain no fleet report/evidence files.

## Before and after

The tests use the actual `createServerApp()` HTTP routes, native sign-in/invitation/session flows, Cloudflare Worker runtime and migrated real local D1. There are no application mocks. The plain Member belongs to parent and child; both have settings=all_members.

| Door | Member before | Member after | Owner after |
| --- | ---: | ---: | ---: |
| Child permission setter | 200 | 403 | 200 |
| Root permission setter | 403 | 403 | 200 |
| Explicit hierarchy permission values | 403 | 403 | 200 |
| Inherited reparent with broader values | 200 | 403 | 200 |
| Inherited reparent with identical current values | 200 | 403 | 200 |

REPRO child permission door: 200  
REPRO root permission door: 403  
REPRO hierarchy permission door: 403  
PROBE child permission door: Member -> 403; Owner -> 200

The original regression failed before repair specifically on 200 versus 403 (REPRO-worker.log). The two inheritance probes also failed on actual 200 responses before their repairs (REPRO-inheritance.log and REPRO-delegation.log). Targeted pre-fix `-t` selection accounts for their reported unselected tests; no test is marked skipped, deleted or weakened in source.

Payload detail: the setter's existing strict schema requires both keys. The actual valid reproduction supplies `{settings:"all_members",planning:"all_members"}`; the brief's planning-only JSON is abbreviated. This report claims 200 for that valid payload, not for an invalid partial body.

A second fresh production Worker was built on the final Git SHA and exercised over actual loopback HTTP with native Owner/Member browser sessions, a parent and child, and settings=all_members on both. HTTP-PROBE.mjs, HTTP-PROBE.json and HTTP-PROBE.log contain the complete driver and actual non-secret status receipt.

Final regressions cover both keys, root/hierarchy parity, refused unchanged-value submissions in both inherited and custom states, unchanged teams/workflows/audit/details, retained inheritance on refused no-op, Owner/Admin/team-owner success, propagated descendant values, and native/API inherited-source changes including a Member who owns the destination parent.

## Checks and CI corrections

| Check | Actual result |
| --- | --- |
| Touched sub-teams + role-matrix/membership | 2 files, 11 tests pass; expanded suite passes again in 234.79 s |
| Stronger inherited no-op sub-team suite | 6 tests pass in 34.17 s |
| Full affected outbound/Slack populated-upgrade suite | 8 tests pass in 41.66 s |
| Typecheck | passes after each functional/test correction |
| Published rer application build | CLI complete exit 0; shell-captured exit 0 |
| Final-SHA build + live HTTP parent/child probe | build exit 0; both keys Member 403 / Owner 200; root/hierarchy Member 403; refused inherited no-op preserved; child privacy Member 403 / Owner 200; post-build integration check passes |
| Full existing administration browser suite | 79 tests, 78 clause journeys, 102 checkpoints pass in 1032.43 s; existing 390-width entrypoint, Chromium /usr/bin/chromium with --no-sandbox |
| Integration deployment check | passes after documented regeneration |
| Contract write/check TEAM-006 | both pass before restoring generated views |
| Source lock/check | both pass, regenerated last after staging the final fixture/source/spec changes |

No UI was changed. The additional full browser run investigated an actual CI transport failure without changing or weakening that test. Build and tests ran through cloud_run with hard timeouts. The first rer setup encountered unresolved merge source and exited 2; the resolved source setup rerun completed with exit 0 and hooks were reinstalled.

Initial exact-SHA Verify [42542996717](https://github.com/just-every/run-vector/actions/runs/42542996717) completed/failure on d5b49dd4127152146f2e4bf4b668a2da430e4ed5. Three known completed failed-job archives were each read once using the required gh run view --job --log-failed command, all exit 0:

- Hosted-artifact job 128922112557 named `management/integration/deployment-spec.json` stale. Only then was `pnpm integration:sync` run. It adds the unchanged sub-team migration beside main's unchanged Slack/automation migrations; integration:check passes. SDK was not named stale and was not regenerated.
- Administration job 128922112570 reported `apiRequestContext.fetch: socket hang up` at the TEAM-005 Owner permission PUT, not a wrong-status authorization assertion. The full unchanged administration suite subsequently passed locally, including that exact request and all later checkpoints. No retry or product workaround was added.
- Imports job 128922112578 found that the new main Slack upgrade fixture expected pre-hierarchy row shapes. `tests/worker/slack-thread-upgrade.ts` now adds exact expected defaults: teams parent_team_id=null, workflow_inherited=0, permissions_inherited=0, hierarchy_version=1; workflow_statuses inherited_from=null. Full equality still compares every prior field and row; new Slack tables remain empty and foreign-key checks remain enabled. The full affected suite passes.

The initial job-list snapshot predates completion of two other jobs; their final individual conclusions were not separately queried. No claim is made that this initial run was green or generated-view-only. The final candidate requires its own exact-SHA result below.

## Mechanical and judgments

MECHANICAL lock=pnpm sources:lock exit=0; lock_check=pnpm sources:check exit=0  
MECHANICAL views=node scripts/contract-docs.mjs write TEAM-006; node scripts/contract-docs.mjs check TEAM-006 exit=0

After each successful contract generation/check, ACCEPTANCE.md and docs/CLAIMS.md were restored whole with `git checkout origin/main -- ACCEPTANCE.md docs/CLAIMS.md`. Neither generated view is committed. Deployment generation/check, view generation/check and final lock/check outputs are retained in GENERATION.log and LOCK-final.log.

| Clauses | Before | After |
| --- | ---: | ---: |
| Done | 136 | 136 |
| Partial | 72 | 72 |
| Missing | 64 | 64 |
| Total | 272 | 272 |

TEAM-006 remains **missing**. ROLE-009 remains **done**. No clause judgment or Status row was raised or changed; unrelated legacy prose is retained.

## Final exact-SHA Verify and custody

- Verify [42548348381](https://github.com/just-every/run-vector/actions/runs/42548348381): completed / failure on `36530f6ec447f66fe76ca2c7cef9adecbab53d1f`.

BLOCKED: the final exact-SHA workflow is not successful. The ten-call workflow/diagnostic budget is exhausted; no unobserved failure cause or generated-view exemption is assumed.

Product and evidence custody are separate. This packet is published only to `refs/heads/evidence/sd-vector-c-f205-fix3`; the evidence manifest records the product branch/head and selected-file hashes. It never signals acceptance or landing. The Mac publication scan and independent security re-gate remain fleet work; this cloud has not claimed either.

The product clone and node_modules are scheduled for deletion after successful report transfer and terminal provenance checks. Their actual post-transfer cleanup is reported in the terminal handoff. Actual reports/receipts remain under the fleet work packet outside the clone.

## Receipt limitations

RECEIPT.json records actual command results and the full initial/final provenance. Two enclosing execution sessions reported exit 1 after their shell explicitly captured test/build exit 0 and printed successful results; this instrumentation discrepancy is retained rather than relabeled. Subsequent source/type/upgrade/browser checks exit 0. No failed assertion was suppressed. Logs are complete non-secret outputs with credential-bearing headers, injected values and URL queries/fragments redacted where needed; no settings, databases, outbox bodies, environment dumps, credentials, symlinks or private held-out material are selected.
