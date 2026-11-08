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
