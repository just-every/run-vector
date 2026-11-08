# sd-vector-c-f199-fix1 — INIT-004 runtime duplication fix

Repository: just-every/run-vector. Branch: cloud/sd-vector-c-f199-fix1.
Candidate under repair: 389f173eb6ff277885dbc1f6fbf81790571136c0 (fetched and verified exactly).
Initial fresh main: 442b61455234c57befcb642bf4afdaa2dc459922.
Full plan: PLAN.md. The clone was fresh, `--filter=blob:none`, without a depth limit; `git rev-parse --is-shallow-repository` returned false.

## Scope and source judgment

Only the gate's blocking runtime duplication is being fixed, plus the required fresh-main reconciliation, migration renumbering, and generated artifacts. No product acceptance is raised; the independent Opus interface work remains owed. No tests are deleted, skipped, or weakened.

There is a pre-existing discrepancy: the assignment describes INIT-004 as PARTIAL, but both the exact supplied candidate and fresh main define it as `missing` in the clause and Status row. The FIX brief forbids a judgment change, so those source judgments and all parent Status rows are preserved. The builder's PARTIAL qualification is retained as context and is not converted into a source promotion.

Source counts before the fix: Published 98 done / 6 partial / 0 missing = 104; Target and push further 38 done / 66 partial / 64 missing = 168; All 136 done / 72 partial / 64 missing = 272. Accepted DONE remains 136/272.

## Cause

`tests/e2e/core-runtime.mjs` admitted `current` to the inline projectMembershipJourney guard, while its existing final `current` block already launches the `projects` child after the parent's browser and Worker close. Both processes inherit VECTOR_CHANNEL_EDGE. Initiative provider assertions therefore see writes from the two executions in the same log. Project proofs must execute once in their independently owned child installation for the `current` entry point; the public `all` entry point must retain its inline execution.

## Initial checks

The unchanged candidate passed `pnpm typecheck` (exit 0) and `node sdk/generate.mjs --check` (56 published operations, exit 0). Setup completed with `npx -y @runeditrun/rer setup --owner-email fleet@runeditrun.com --non-interactive` through cloud_run. Private setup output is excluded from this public packet.

Further executed results and terminal provenance follow below.

## Reproduction and implementation

REPRO finding-1: head 389f173eb6ff277885dbc1f6fbf81790571136c0 -> exit 1, `one bound initiative update through the durable dispatcher`, actual 2 / expected 1, at tests/e2e/initiatives-journey.mjs:92:10. The parent passed 93 checks before its existing child failed. See repro-receipt.json and repro-parent-results.json.

Fetched main again immediately before merging; it remained 442b61455234c57befcb642bf4afdaa2dc459922. Merged without rebasing or rewriting published history. CONTRACT.md matched main without a conflict; every source Status row was retained. Only deployment-spec.json and sources.lock.json conflicted; both were taken from main as inputs for regeneration. The automatic archive inventory/policy/snapshot merge retained main's Slack-thread work and the candidate's leadership history.

The runtime guard now admits only `all` and `projects` to the inline project journey. `current` retains its existing `projects` child after its own browser and Worker close. An explanatory comment records that ownership. No journey or assertion is removed, skipped or weakened; every project assertion still executes once for the current entry point.

Main already used migration 0134 for Slack threads. The candidate's 0134_leadership_digests.sql became 0135_leadership_digests.sql and 0135_leadership_restore_holds.sql became 0136_leadership_restore_holds.sql, preserving their SQL bytes. The populated-upgrade fixture follows the new names and keeps all prior schema/data assertions. A namespace and byte comparison confirmed 136 unique migration numbers and all 134 main migrations unchanged. The generated deployment spec and source lock are regenerated after this reconciliation.

The documented contract generator write/check for INIT-004 passed. ACCEPTANCE.md and docs/CLAIMS.md were restored whole from origin/main and are not committed. SDK generation/check passed with 56 published operations.

## Completed mechanical checks

MECHANICAL ledger=`cloud_run timeout 180 node --test --test-concurrency=1 scripts/deployment/tests/migration-head.test.mjs` exit=0; spec=`pnpm integration:sync && pnpm integration:check` exit=0; lock=`pnpm sources:lock && pnpm sources:check` exit=0; views=`node scripts/contract-docs.mjs write INIT-004 && node scripts/contract-docs.mjs check INIT-004` exit=0.

The migration ledger test applied all migrations, verified the exact name/hash ledger, exercised owner/invitation/removal guards, checked foreign keys, and repeated migration without writes (1 test passed). The external namespace receipt also proves main's migration bytes remain intact. Source changes were staged before source-lock generation; sources.lock.json was regenerated last and its check passed. The regenerated deployment descriptor and managed workflow have no changes. No generated view is included in the product diff.

The rebuilt merged product and typecheck passed. The exact same bounded runtime command is running against that rebuilt product. Touched worker proof covers weekly leadership behavior, populated migration upgrade, and HTTP archive preservation.

## Fixed-run retry

The first fixed runtime attempt exited 1 before reaching the project child: tests/e2e/core-operator-journey.mjs:34:76 reported `invitation confirmation succeeds within the native proof budget`, actual HTTP 429 / expected 303, called from core-runtime.mjs:754:5. This is the pre-existing HTTP 429 flake explicitly excluded from this FIX round. Its receipt is preserved in probe-flake-receipt.json. No product limits, assertions, retry budget or out-of-scope code were changed. The exact same bounded command is being rerun on the same staged source tree.

The unchanged retry passed the earlier 429 point. Its parent completed 59 checks and launched the existing independent project child. The original parent completed 93 checks because it also ran the 34 project checks inline; those assertions remain in the child. See probe-parent-results.json. An environment tool-session reconnect occurred during the retry; the OS timeout/runtime processes survived, the staged tree remained identical, and the existing timeout process is monitored for its kernel exit status rather than launching duplicate work.

## Fixed result

PROBE finding-1: fixed -> exit 0 on the exact same bounded `core-runtime.mjs current` command (unchanged retry after the recorded HTTP 429 flake). The parent passed 59 checks and the independent child passed 54, for 113 passed checks. The INIT-004 journey ran once, versus twice in the failing candidate. The unchanged initiative provider assertion passed at 1440 and 390. Project ordering, workload, membership, dependencies, deletion, initiatives and release checks are retained. Strict browser error, request, external-fetch and ordinary 600-request limiter assertions passed. See probe-receipt.json, probe-parent-results.json and probe-project-results.json.

Browser proof includes the existing weekly digest panel captures from the fixed child at 1440 and 390, inspected before publication; browser-proof-receipt.json records exact file hashes. The four touched worker tests, typecheck, build, migration ledger and all mechanical checks passed. No test was deleted, skipped or weakened. No hosted commissioning, clause promotion, landing or Opus interface acceptance is claimed.

Counts after the fix remain Published 98/6/0 = 104, Target and push further 38/66/64 = 168, All 136/72/64 = 272 (done/partial/missing). INIT-004 source judgment and all parent Status rows are unchanged.

## Product publication

Product merge commit: 153ab57b967b64cd4965f16c2caf4b9489206002, tree 97be96c853582df9672b7122ad892d1b26d989cd, parents 389f173eb6ff277885dbc1f6fbf81790571136c0 and 442b61455234c57befcb642bf4afdaa2dc459922. The committed tree equals the tested staged tree. The commit has no skip-ci marker. All five candidate commits including side parents passed independent author/committer name/email and full-message trailer inspection; every identity is Run Edit Run fleet <fleet@runeditrun.com>, and trailers are absent.

The cloud push guard published cloud/sd-vector-c-f199-fix1 successfully on its first attempt. No main/default-branch push, force push, rebase or published-history rewrite occurred. No PR was created; repository guidance does not require one for this branch verification handoff. Product publication is separate from evidence transport and does not claim landing. The exact-SHA Verify watcher uses REST, one watcher, a minimum 300-second interval between calls and a ten-call budget.

## Runtime provenance

The supplied cloud toolchain script selected local Node v24.19.0 and pinned pnpm 10.12.4. Both the original-head reproduction and fixed runtime used that same local toolchain; the official Verify workflow pins Node 22.20.0 and pnpm 10.12.4. Browser proof used /usr/bin/chromium with --no-sandbox. Private setup logs, runtime databases, provider call files, cookies, keys and environment dumps are excluded from the report packet.

## Exact-SHA CI and terminal custody

Verify run 42532001126 completed successfully on 153ab57b967b64cd4965f16c2caf4b9489206002: https://github.com/just-every/run-vector/actions/runs/42532001126 . The REST terminal response reports status completed, conclusion success and the exact full SHA. Seven GitHub calls were used within the ten-call budget, with at least 300 seconds between requests. No generated-view exemption or workflow rerun was needed. See ci-receipt.json and github-calls-receipt.json.

READY branch=cloud/sd-vector-c-f199-fix1 head=153ab57b967b64cd4965f16c2caf4b9489206002

Blockers: none. INIT-004 is not promoted; the brief's PARTIAL qualification and owed Opus interface work remain unchanged, and the pre-existing missing source judgment is preserved without a builder ruling. Product READY is exact-SHA verification custody, not acceptance or landing.

## Evidence and cleanup

This complete non-secret packet is selected explicitly for report-only publication to refs/heads/evidence/sd-vector-c-f199-fix1 in just-every/run-vector. Evidence transport does not signal product READY or landing. The final response carries the transport's exact EVIDENCE ref/head receipt separately from product custody.

Owned test runtimes and browsers completed and closed. node_modules has been removed. The clean product clone is retained only for the final report-only Git transport and will be removed immediately after its successful receipt; the packet and terminal provenance remain outside the clone. No private setup logs, databases, outbox bodies, cookies, keys, environment dumps, provider call files, private held-out material or symlinks are selected.
