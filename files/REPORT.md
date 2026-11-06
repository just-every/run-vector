# sd-vector-c-f176-opus-1-fix1 — FIELD-001 mechanical repair

Repository: just-every/run-vector
Product branch: cloud/sd-vector-c-f176-opus-1-fix1
Product head: edb7d689e8e065679316c3ec455b3a3724df3d5e
Published source head preserved: 33ab112458789b64aa59310eade27a442f5270f3
Fresh main merged: da03cd1ff1b5ddf1e0baf513c33c2efe228ab115
PR: none; fleet owns guarded landing. No main/default branch was pushed.

## Plan and scope

The complete plan is in PLAN.md. The completed sequence was fleet bootstrap and safe Git setup; owned shallow blob-filtered clone; source-head verification; non-rewriting merge of fresh main; contract-first additive conflict resolution; migration renumber and ledger/boundary updates; generated SDK refresh; only the requested touched checks; source lock regenerated last; fleet-identity merge commit; identity/trailer inspection of all four candidate commits; guarded product push; exact-SHA REST Verify monitoring; separate evidence publication and clone cleanup.

Only the blocking mechanical work was performed. The six C and three D findings remain FOLLOW-UPS; their unprovided details were not invented. No new product behavior or UI change was introduced by this fix. The collaboration failure was not repaired, reproduced or rerun; only its required failed-job archive was read. Existing workflow and test assertions are retained.

## Changes

- Preserved all three published source commits by merging origin/main, with parents 33ab112458789b64aa59310eade27a442f5270f3 and da03cd1ff1b5ddf1e0baf513c33c2efe228ab115. No rebase, force push or published-history rewrite occurred.
- Resolved CONTRACT.md from fresh main first. Every unrelated clause line, status, Gap and Evidence is byte-identical to that main. Only the previously published FIELD-001 narrative/inventory changes were reapplied, with PARTIAL and the full unselected Gap retained. No new acceptance judgment was made.
- Resolved all four trial-merge conflicts: additive custom-field and project-dependency route registrations; both sets of archive tables; main's migration ledger plus the renamed custom-field migration; source lock regenerated from the merged tree.
- Renamed 0126_custom_field_definitions.sql to next-free 0127_custom_field_definitions.sql, updating the deployment migration ledger and both boundary references in custom-fields-upgrade.test.ts. The SQL bytes are unchanged (sha256 a35d44097182cdf275ef9c77f8bc4d2b43a50fa400b062831dc6bd1b8c2fc393). Main's 0126_project_dependencies.sql and ledger row are unchanged.
- Set the existing newer-main project-dependency upgrade's exact schema boundary to its own 0126 migration. Every expected object, old-schema comparison, populated-row retention, foreign-key assertion, sign-in/search check and full-head export check remains. The helper subsequently applies 0127 and checks retained data. No assertion was removed, skipped or weakened.
- Ran node sdk/generate.mjs. Against merged main, sdk/generated.ts changes three type lines (+3/-3): customFields for issue creation/update and issue readback with single-select definition/option data. All 56 published operations, including newer-main project-dependency operations, remain. Against the old source candidate, the SDK delta also includes main's generated operations (+21/-3). sdk-diff.patch has the exact fresh-main diff.
- Ran contract-docs write/check FIELD-001 successfully, then restored ACCEPTANCE.md and docs/CLAIMS.md whole from origin/main. Both view blobs are exact main and are not changed by this candidate.
- Staged sources, regenerated sources.lock.json last, and passed sources:check. No fleet report/evidence files were committed to the product tree. .github/workflows/verify.yml is exact main.

## Checks and actual receipts

| Command | Exit |
| --- | ---: |
| `node sdk/generate.mjs` | 0 |
| `node sdk/generate.mjs --check` | 0 |
| `pnpm typecheck` | 0 |
| `node --test scripts/deployment/tests/migration-head.test.mjs` | 0 |
| `pnpm exec vitest run --config vitest.config.ts tests/worker/custom-fields.test.ts tests/worker/custom-fields-upgrade.test.ts tests/worker/project-dependencies-upgrade.test.ts` | 0 |
| `node scripts/contract-docs.mjs write FIELD-001` | 0 |
| `node scripts/contract-docs.mjs check FIELD-001` | 0 |
| `pnpm sources:lock` | 0 |
| `pnpm sources:check` | 0 |

The FIELD-001 test and both populated-upgrade tests passed: 3 files / 3 tests. The migration-ledger test passed: 1 / 1. An additional one-off ledger receipt verifies all 127 SQL files and embedded ledger entries/digests, unchanged main ledger rows, and zero duplicate ordinals. The fix adds/deletes/skips zero test registrations. Browser journeys and full verification were left to branch CI as required by the brief; no local full suite, build, deploy or browser session was started. Dependency preparation was npx -y @runeditrun/rer install through cloud_run (exit 0). Toolchain selected pnpm 10.12.4; local direct checks used Node 24.19.0 (the supplied shim keeps a newer VM Node); rer install used the repository's Node 22.20.0. CI uses the repository pin.

The product push succeeded on attempt 1 through cloud-push.py. identity-check.json records all four reachable commits, including all side-parent ancestry: fleet or configured owner identity, only allowed Claude noreply trailers, and no surviving OpenAI/Codex co-author. push.log is the actual transport receipt with credential fingerprint metadata omitted.

## Counts and clause custody

Before and after against fresh main: 136 DONE / 69 PARTIAL / 67 MISSING / 272 total. Published: 98/6/0 of 104. Target/push-further: 38/63/67 of 168. FIELD-001 PARTIAL → PARTIAL. No status promotion/demotion; the already-published evidence narrative and full Gap are preserved. Test registration delta for the fix: +0/-0. SDK operations: old source candidate 54 → merged candidate 56 (both additions come from fresh main); against fresh main 56 → 56. Custom-field migration: 0126 → 0127; merged migration sequence has no duplicate ordinal.

CLAIM FIELD-001 PARTIAL points=1,2,3,4,5,6 tests=tests/worker/custom-fields.test.ts#[FIELD-001 ISSUE-023 ROLE-001 ROLE-009] a team Severity field is defined by its team owners, set through the browser door, /api/v1, templates and the agent tool, refuses other values, renames without moving stored identity, copies by destination and survives an archive round-trip; tests/e2e/custom-fields-journey.mjs#severityFieldJourney
DEFAULT FIELD-001: Retain the existing default Team owners only permission and the unchanged full clause obligation; this fix adopts no new product policy.
GAP FIELD-001: Only team single-select fields are built. Text, number (unit and decimals), multi-select, date, person, URL and checkbox types; workspace definitions and their Owner and Admin row; project fields and PROJ-001's inherited duties; restricting workspace fields to chosen teams; required fields for issue types (ISSUE-021) and templates; option colors, reordering and archiving; and counted-confirmation field deletion with its audit entry remain absent. Imports report custom-field columns as omissions until FIELD-002 maps them, and Slack forms and automation (AUTO-002) set no custom-field values yet; they must use the same typed boundary when they do.

## CI and publication custody

Exact-SHA Verify 42224234085 completed/failure for edb7d689e8e065679316c3ec455b3a3724df3d5e. Build and seven of eight independent shards passed, including hosted-artifact job 127914090630, which fixes the original stale SDK blocking job. Collaboration job 127914090497 failed in the PROJ-012 390 template journey with Miniflare ERR_ADDRESS_IN_USE at 127.0.0.1:40127; the parent collaboration test fails with the same startup error (31 passed / 2 failed including the parent). Aggregate job 127925330049 failed because that shard failed. Every other job succeeded. This is not a contract-view generator-only failure, so no READY exception applies.

One status watcher performed discovery plus six polls at five-minute intervals. After completion, the jobs list was read once and each of the two failed-job archives was read once, using all ten GitHub calls. Both archive commands exited 0:

- gh run view 42224234085 --repo just-every/run-vector --job 127914090497 --log-failed
- gh run view 42224234085 --repo just-every/run-vector --job 127925330049 --log-failed

Public log copies omit runner environment listings and any authentication material, retaining all failure diagnostics. ci-log-publication-receipt.json describes the omissions. No workflow, test or product behavior was changed to accommodate this collaboration failure. The brief explicitly says not to chase the collaboration flake; no rerun, dispatch, empty commit or reproduction was attempted.

The original reported red Verify was 42037627181 on 33ab112458789b64aa59310eade27a442f5270f3, with stale SDK in hosted-artifact job 127280442157. This fix does not claim that historical run is green.

The Mac fleet owns the complete publication scan, exact landing checks, generated contract views and landing. This cloud has not run or waived that scan. Evidence publication is a report-only tree on evidence/sd-vector-c-f176-opus-1-fix1 and proves neither product acceptance nor landing. The packet includes actual checks, Git custody, CI receipts and diffs; no credentials, environment dumps, private gate material or symlinks are selected.

BLOCKED: exact-SHA Verify is red on collaboration job 127914090497 (PROJ-012 native template journey, Miniflare port collision 127.0.0.1:40127); aggregate job 127925330049 therefore fails. The SDK and migration mechanical fixes are complete and pushed, and hosted-artifact is green. Resolving or accepting the separately owned collaboration CI failure requires the fleet; this brief forbids chasing it. Product is not READY. Ten-call budget is exhausted. No push or report transfer rejection occurred. All completed product work is on the named branch; no unpublished product changes remain.
