# sd-vector-c-f197-fix1 repair report

Repository: just-every/run-vector. Product branch: cloud/sd-vector-c-f197-fix1.
Product head: 162434f06698b04c918d3e3e1d060aa4ae5f6ec0.
Product push succeeded once through the fleet guard. No PR was required or created; Verify has a push entry point for cloud/**. No landing or deployment was performed. Evidence publication is separate from product custody.

## Plan and scope

The complete plan is in PLAN.md. This was a mechanical stale-deployment-spec repair of the retained f197 candidate. It introduced no new feature scope and no new clause judgment. The only added merge-resolution changes beyond the retained candidate and main are the generated integration specification and source lock, plus migration filename/reference reconciliation required by the brief.

1. Fleet identity was configured before repository work; launcher refresh and bundle-only Git credential helper/push guard were installed. No alternate credential was sought. The fleet commit-msg wrapper stayed active, preserving original repository hooks. A per-push identity audit also ran through the preserved hook chain.
2. Fresh `git clone --filter=blob:none https://github.com/just-every/run-vector.git` had no depth restriction; `git rev-parse --is-shallow-repository` returned false. Fetch of cloud/sd-vector-c-f197 yielded exactly 091e707eee124b0a52421053e5c142f40f8178bf, printed by `git rev-parse HEAD`. The repair branch began there.
3. Fresh main 243b843de99e0ed460e736a27aa2622c13a52ddd was merged without rebasing or rewriting published history. Final parents are 091e707eee124b0a52421053e5c142f40f8178bf and 243b843de99e0ed460e736a27aa2622c13a52ddd. CONTRACT.md was resolved first by retaining main whole. All 272 parent clause IDs and every main Status row are retained exactly. No ID-MAP changes were made. Both parents' test assertions were preserved; conflicts were resolved by individual line-delimited blocks, without a DOTALL replacement.
4. Main already contained byte-identical resolution SLA, restore-hold, label-start and import-admission SQL as 0128, 0129, 0130 and 0131. The duplicate candidate paths 0126–0129 were removed in favor of those published main files. Candidate-only 0130_sla_team_archive.sql became 0132_sla_team_archive.sql, above main's maximum. Its SQL bytes stayed unchanged; docs/SLAS.md and resolution-sla-upgrade.ts references were updated. Every existing main migration is byte-identical in the result. No test was deleted, skipped or weakened.
5. Dependencies were installed through rer. Setup's first attempt returned exit 4 because the concurrently running task-owned Vitest process held the checkout; it was retried after the test process completed and passed. Private setup logs, runtime state, owner links and settings are excluded from the packet. The provided toolchain selected pnpm 10.12.4 and the VM's Node 24.19.0 for direct commands; rer selected the repository's Node 22.20.0 for install, setup and build. The browser proof explicitly used the installed Node 22.20.0 and /usr/bin/chromium with --no-sandbox.
6. After the production build, `pnpm integration:sync` changed only management/integration/deployment-spec.json; rer-project.json and the producer workflow did not change. `pnpm integration:check` passed. Staged changes preceded the final `pnpm sources:lock`; `pnpm sources:check` passed. Contract views generated and checked for AUTO-004, then ACCEPTANCE.md and docs/CLAIMS.md were restored whole from main. Neither view has a diff against main.
7. The single new merge commit has explicit fleet author and committer and no AI trailer. All six candidate commits, including side parents, passed the required `git log origin/main..HEAD --format="%an <%ae>%n%cn <%ce>%n%(trailers:only,unfold)"` audit. Product push used cloud-push.py and succeeded on attempt 1. The checkout was clean afterward.
8. Exact-SHA Verify was discovered and polled using REST under one watcher, with at least 300 seconds between calls for that run and a ten-call overall budget. Current result is recorded below and in the actual CI receipts. Reports and selected actual receipts are published only to refs/heads/evidence/sd-vector-c-f197-fix1. Product cleanup is recorded separately after evidence publication.

## Before and after

| Inventory | Source candidate | Fresh main | Repaired candidate |
| --- | ---: | ---: | ---: |
| Core SQL migrations | 130 | 131 | 132 |
| Generated spec migration entries | 129 | 131 | 132 |
| Done clauses | 136 | 136 | 136 |
| Partial clauses | 70 | 71 | 71 |
| Missing clauses | 66 | 65 | 65 |
| Total clauses | 272 | 272 | 272 |

The only status difference between the source candidate and fresh main is BASE-AGENT-010 missing → partial, already judged on main and retained without modification. This repair changes no main status or judgment: counts are 136/71/65 before and after relative to main. AUTO-004 stays partial. The SLA Status row remains main's exact row. No promotion, acceptance or landing is claimed.

## Mechanical and public-door probes

MECHANICAL deployment-spec=pnpm integration:sync exit=0; lock=pnpm sources:lock exit=0; views=node scripts/contract-docs.mjs write AUTO-004 exit=0; ledger=node --test scripts/deployment/tests/migration-head.test.mjs exit=0.

The companion checks `pnpm integration:check`, `pnpm sources:check`, and `node scripts/contract-docs.mjs check AUTO-004` all returned 0 before restoring main's view files. The explicit check after restoration returned 1 on ACCEPTANCE.md, as expected under the cloud view-file rule. Main's generated views remain uncommitted as repair changes.

PROBE SLA: native team Settings and PUT /api/settings/teams/:id/sla, enabled Urgent resolution target 120 business minutes, advance warning 60, UTC working calendar → target persists, countdown renders, no early warning, exactly one eligible warning and one breach through the real fixed-clock scheduler. Native Inbox shows the warning. Native archive true/false between scheduler requests → GET /api/issues/:identifier/sla reports stopped, remaining minutes stay fixed, and no new occurrence is emitted. Existing worker tests also prove combined filters, immutable target/timezone snapshots, current-recipient and actor exclusion/deduplication, populated forward upgrade, imported snapshot admission, historical occurrence retention, native archive round-trip and effect review without replay. Observed results: 13 tests passed in four worker files; no skips.

PROBE SLA browser: the candidate's existing runResolutionSlaRuntime/exerciseResolutionSla journey passed using a task-side driver and real mounted native Worker. Assertions run at 1440; settings, countdown, Inbox and archive-stopped screen were captured once at both 1440 and 390. Browser/runtime cleanup ran in finally blocks. Screenshots contain synthetic fixture records only. No product UI code was added or redesigned in this repair.

PROBE ledger: the existing migration-head deployment test applies all 132 SQL files with digest/state receipts, retains owner/invitation guards and foreign-key integrity, then repeats with zero new writes and identical history. It passed. Migration receipt separately verifies every published main SQL byte and all generated 0126–0132 digests.

Typecheck and production build passed with hard timeouts. All long-lived local development, build and browser commands ran through the supplied cloud_run subreaper; no Mac slot polling was used.

## Actual check receipts

| Check | Bounded command | Exit | Actual log |
| --- | --- | ---: | --- |
| typecheck | `timeout 300 pnpm typecheck` | 0 | typecheck.log |
| ledger | `timeout 180 node --test scripts/deployment/tests/migration-head.test.mjs` | 0 | ledger.log |
| build | `timeout 600 npx -y @runeditrun/rer build` | 0 | build.log |
| deployment-spec-write | `timeout 120 pnpm integration:sync` | 0 | deployment-spec-write.log |
| deployment-spec-check | `timeout 120 pnpm integration:check` | 0 | deployment-spec-check.log |
| views-write | `timeout 60 node scripts/contract-docs.mjs write AUTO-004` | 0 | views-write.log |
| views-check | `timeout 60 node scripts/contract-docs.mjs check AUTO-004` | 0 | views-check.log |
| views-restored-check | `timeout 60 node scripts/contract-docs.mjs check AUTO-004` | 1 | views-restored-check.log |
| lock-write | `timeout 120 pnpm sources:lock` | 0 | lock-write.log |
| lock-check | `timeout 120 pnpm sources:check` | 0 | lock-check.log |
| sla-worker | `timeout 300 pnpm exec vitest run --config vitest.config.ts tests/worker/due-reminders.test.ts tests/worker/data-http.test.ts tests/worker/data-import-atomic.test.ts tests/worker/role-matrix.test.ts` | 0 | sla-worker.log |
| sla-browser | `timeout 300 node .artifacts/verification/sla-cloud-browser.mjs` | 0 | sla-browser.log |
| product-push | `python3 /home/agent/rer-consolidation/.tools/cloud-push.py origin cloud/sd-vector-c-f197-fix1` | 0 | product-push.log |

Additional actual receipts: browser-receipt.json, test-preservation-receipt.json, local-results.json, setup-receipt.json, setup-retry-receipt.json, migration-receipt.json, clause-receipt.json, parent-status-comparison.json, merge-provenance.json, product-receipt.json, identity-audit.log, product-commit.txt, deployment-spec.diff, product-v-main.diff and task-metrics.json. Source test changes were read from the five source commits with git show and retained in source-test-changes.diff. No gate-held material was accessed.

## CI and terminal custody

Verify run: 42490910222 — https://github.com/just-every/run-vector/actions/runs/42490910222.
Exact head: 162434f06698b04c918d3e3e1d060aa4ae5f6ec0.
Observed status: completed; conclusion: success.
Assessment: Exact-SHA Verify completed/success; ordinary READY. No generated-view exemption was needed..
PR: none. Required workflow has a pre-main branch entry point.
Blockers: none.

Product custody and report transport are independent. A report-only evidence ref does not assert READY, acceptance or landing. No default branch was pushed or fast-forwarded. The fleet's publication scan and Mac landing gates remain outside this cloud run.
