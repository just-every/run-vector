# sd-vector-c-f201-fix1 report

Repository: just-every/run-vector. Product branch: cloud/sd-vector-c-f201-fix1.
Original candidate: 02470ada018c84f79ab67091bb1d6dfd30fae998.
Fetched main: 0e8a686c06eddd55943ed1d2690df32a8fc82213.

## Scope and plan

The complete execution plan is PLAN.md. This FIX round addresses only the three gate blockers: role-door census, generated deployment spec, and populated-upgrade snapshot defaults. FOLLOW-UP C and the stream-control 429 flake were not changed. No UI changes were made in this round.

Fleet identity was configured before repository work. The launcher was refreshed and its AGENTS.md read. Decrypted-bundle Git authentication, credential-config cleanup, cloud product push guard and commit-message hooks were installed. The existing evidence entrypoint is outside product checkouts. No lane INBOX or STATE was read or written.

A pre-existing unfinished checkout and receipts were found on entry. They were preserved while a separate fresh `git clone --filter=blob:none` with full history was made into checkout/. The fetched cloud/sd-vector-c-f201 head was asserted and printed as the original candidate above, and the named fix branch was created from it. All current proof is in fresh-* receipts and logs; previous receipts are retained locally but are not substituted for this execution.

Setup used the published rer CLI with the explicit fleet owner and the cloud subreaper. Private setup output and settings are excluded from this packet. The supplied cloud toolchain selected Node v24.19.0 and pnpm 10.12.4; the script retains an installed newer Node, so local commands emitted the Node 22.20.0 engine warning. Exact-SHA CI uses the repository's Node 22.20.0 workflow pin.

All three findings were reproduced on the clean exact candidate, before any fix. Fresh origin/main was then merged with the required fleet environment, without rebase: Git reported Already up to date, since main was already an ancestor. Thus main's tests, CONTRACT rows, ID map and existing migrations were retained unchanged. Main's highest migration is 0133_release_notes.sql; candidate 0134_issue_types.sql has no collision and was retained unchanged.

## Fixes

1. src/core/features/roles/doors.ts: declare the PUT and PATCH issue-type Settings routes against the existing teams.settings matrix row and subject team resolver. The existing typeManagementFence in the mutation definitions still independently requires a workspace Owner. The census, policy matrix and Owner-only fence are unchanged.
2. management/integration/deployment-spec.json: build with rer and regenerate with `pnpm integration:sync`. The only generated addition is migration 0134 with its exact SQL and digest. The spec now contains 134 migrations instead of 133.
3. tests/worker/team-cycles-journey.ts, triage-upgrade.ts and outbound-subscription-upgrade.ts: extend exact expected rows with issue_types_enabled=0 and/or issue_type_id=null. Full-row equality and all previous field assertions remain. No columns were removed and no test was deleted, skipped or weakened.
4. sources.lock.json: regenerate last after staging the product/test/spec changes; only five file hashes change.

The fix is six files, 19 insertions and 11 deletions relative to the original candidate. No evidence or reports are staged in the product branch.

## Reproduction and probes

REPRO role-door: head -> exit 1, Door has no role-matrix row: PUT /settings/teams/:id/issue-types.
REPRO integration: head -> exit 1, Stale integration management/integration/deployment-spec.json.
REPRO snapshots: head -> exit 1, 3 failed / 4 passed across cycle-schedule, source-ingest and outbound-webhooks (7 tests).
PROBE role-door: fixed -> exit 0, 372 actual routes and 27 forms covered.
PROBE integration: fixed -> exit 0, integration deployment spec, setup digest and producer workflow match.
PROBE snapshots: fixed -> exit 0, all 7 tests pass in the same three files.
PROBE typecheck: fixed -> exit 0.
PROBE rer build: fixed -> exit 0.
PROBE authorization: fixed -> exit 0, all 8 tests pass across issue-types, issue-types-upgrade and role-matrix (260.52 seconds). This exercises Owner-only type management and current-role refusals without changing the tests.

| Receipt | Bounded command | Exit |
| --- | --- | --- |
| repro-role-door | `timeout 180 node --input-type=module -e import {assertRoleDoorCoverage} from "./tests/e2e/role-door-coverage.mjs"; console.log(await assertRoleDoorCoverage());` | 1 |
| repro-integration | `timeout 180 pnpm integration:check` | 1 |
| repro-snapshots | `timeout 300 pnpm test:worker tests/worker/cycle-schedule.test.ts tests/worker/source-ingest.test.ts tests/worker/outbound-webhooks.test.ts` | 1 |
| probe-role-door | `timeout 180 node --input-type=module -e import {assertRoleDoorCoverage} from "./tests/e2e/role-door-coverage.mjs"; console.log(await assertRoleDoorCoverage());` | 0 |
| probe-integration | `timeout 180 pnpm integration:check` | 0 |
| probe-snapshots | `timeout 300 pnpm test:worker tests/worker/cycle-schedule.test.ts tests/worker/source-ingest.test.ts tests/worker/outbound-webhooks.test.ts` | 0 |
| probe-typecheck | `timeout 300 pnpm typecheck` | 0 |
| probe-build | `timeout 600 npx -y @runeditrun/rer build` | 0 |
| mechanical-ledger | `timeout 180 node --test scripts/deployment/tests/migration-head.test.mjs` | 0 |
| mechanical-views-write | `timeout 180 node scripts/contract-docs.mjs write ISSUE-021` | 0 |
| mechanical-views-check | `timeout 180 node scripts/contract-docs.mjs check ISSUE-021` | 0 |
| mechanical-integration-write | `timeout 180 pnpm integration:sync` | 0 |
| mechanical-lock-write | `timeout 180 pnpm sources:lock` | 0 |
| mechanical-lock-check | `timeout 180 pnpm sources:check` | 0 |

The external fresh-*.json receipts record the exact command, timestamps, base HEAD, working-tree diff digest and log SHA-256. Probes run before committing therefore name the original HEAD plus the fixed working-tree digest; the final receipt binds the resulting index tree to the published product commit.

## Mechanical proof and clause custody

MECHANICAL ledger=`timeout 180 node --test scripts/deployment/tests/migration-head.test.mjs` exit=0; lock=`timeout 180 pnpm sources:check` exit=0; views=`timeout 180 node scripts/contract-docs.mjs check ISSUE-021` exit=0.

The migration-ledger proof applies all migrations and checks retained owner and invitation guards, removal revocation, foreign keys, matching applied digests and no-write repeat migration. Contract generation used write ISSUE-021 then check ISSUE-021. ACCEPTANCE.md and docs/CLAIMS.md were restored whole from origin/main afterward and are not committed. No source contract changes were needed. The source lock was generated last and its check passed.

Clause judgment changes: none. The actual ISSUE-021 contract row is missing before and after (the candidate's backend work was described as PARTIAL in the brief, but its recorded source judgment was not promoted). All 272 source rows remain: done 136 -> 136, partial 72 -> 72, missing 64 -> 64.

Before/after counts: blocking findings 3 -> 0 in local probes; failing affected snapshot tests 3 -> 0; passing affected snapshot tests 4 -> 7; migration spec entries 133 -> 134; route declarations without a row among the added issue-type writes 2 -> 0. No acceptance or landing claim is made by these local counts.

## Publication and CI

Product fix commit: 1f64f9b95b0316367438e9f95e1ce65dfae28386. Fleet identity and full-message audit passed for all seven commits in origin/main..HEAD, including side parents. The commit has no AI co-author trailers and active repository-preserving hooks were used. Product push and exact-SHA CI receipts follow below once observed. No PR is required by the supplied repository rules or this branch-push brief.

Product push succeeded on attempt 1 via cloud-push.py to refs/heads/cloud/sd-vector-c-f201-fix1. No default branch or other product branch was pushed. Exact-SHA Verify run 42514227052 was discovered through the declared repository REST endpoint and is in progress at the first observation. GitHub calls used: 1 of 10; subsequent checks observe the 300-second interval.

All 133 migration files already on main were checked byte-for-byte unchanged. The generated 0134 spec SQL equals the migration source and its SHA-256 matches. The pre-existing unfinished checkout's staged tree is also d4ed3487f97b1a8cfba18845f183661403328a39, exactly the published fix tree; its finished changes are therefore preserved by the product push.

All 15 fresh command receipts and their saved log digests were verified. Packet selection is explicit and contains reports, receipts, sanitized transport observations, a six-file product patch and non-secret command logs only. Setup output, local dev settings/state, environment dumps, credentials, symlinks and private held-out material are excluded. The Mac fleet remains responsible for the independent publication scan and landing; neither product push nor evidence publication claims acceptance or landing. After successful evidence publication, the product clones and their node_modules will be removed as requested; the packet remains outside them.

Recovery bundle: `/home/agent/rer-consolidation/work/sd-vector-c-f201-fix1/product-1f64f9b95b03.bundle`, SHA-256 `2e921864def8bcee9d06d874030a617590819a8956f604749af863a78e6d50f0`; `git bundle verify` passed and the bundle contains complete history for the published branch. This is preservation data, separate from READY and the evidence ref.

A post-push fresh main fetch and fleet-identity merge check found origin/main still at 0e8a686c06eddd55943ed1d2690df32a8fc82213. Git again reported Already up to date. The published product head and clean working tree were retained; no rebase or additional commit was needed.

## Terminal result: BLOCKED on an additional SDK bar outside the FIX lease

Product branch is PUSHED at 1f64f9b95b0316367438e9f95e1ce65dfae28386. Exact-SHA Verify run 42514227052 completed with conclusion failure. All three assigned gate findings pass locally, and the actual CI administration and all worker partition jobs pass. The hosted-artifact archive explicitly confirms `integration:check` matched at 19:19:33Z. Its later `test:integrations` entry fails at the SDK check before exercising that integration journey.

Underlying failed job: 128833943514, `shards (hosted-artifact, true, true, false)`. Summary job 128840091106 (`verify`) reflects that incomplete wall. Plan, build, collaboration, administration, core-runtime, core-runtime-planning, imports, portability and worker-2 all concluded success on this exact SHA.

The one diagnostic archive command was:

`gh run view 42514227052 --repo just-every/run-vector --job 128833943514 --log-failed`

It succeeded. No job-log blob redirect was attempted. Nine of ten GitHub calls were used, with each run-related read separated by at least 300 seconds. Complete non-secret archive output is fresh-gh-9.txt, with credential-shaped values and URL query/fragment data redacted.

Observed error: `Error: SDK is stale; run node sdk/generate.mjs`, raised by sdk/generate.mjs:78 through sdk/build.mjs:8 and tests/e2e/integration-runtime.mjs:22. The exact local check `timeout 180 node sdk/generate.mjs --check` also exits 1 on the published clean product SHA.

The required output file, `sdk/generated.ts`, is outside the ISSUE-021 candidate's original 69-file diff lease and is not one of the three listed blockers. The brief explicitly prohibits expanding this FIX round. No SDK file, API schema, check or test was changed to bypass that boundary. The failure is not a generated ACCEPTANCE.md/docs/CLAIMS.md check, so the generated-view READY exemption does not apply. No READY or landing claim is made.

Concrete blocker proof was prepared wholly outside the product checkout: with the unchanged generated SDK, the main schema passes generation check (exit 0), the candidate schema fails it (exit 1), and external regeneration followed by check passes (exit 0, 56 published operations). SDK-BLOCKER-RECEIPT.json records the exact file digests. SDK-BLOCKER.patch contains the sole required hunk `@@ -14,11 +14,11 @@` for sdk/generated.ts, adding the issue-type shapes from the candidate API schema. It is evidence only and has not been applied to the product. A subsequent FIX lease would need to authorize sdk/generated.ts regeneration and its source-lock update before rerunning integration and exact-SHA Verify.

There was one product commit and one successful product push, made after all specified touched checks passed and before the additional CI failure was known, as required by cloud preservation. No additional product push or out-of-lease edit was made after diagnosis. The product remains clean, published, fully bundled and recoverable. Clause judgments and the 136/72/64 counts remain unchanged.
