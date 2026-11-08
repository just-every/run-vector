# sd-vector-c-f201-fix2

Repository: just-every/run-vector.
Product branch: cloud/sd-vector-c-f201-fix2.
Product head: dd03105c358e930529e188bc10b0aa7c731d7fc8.
Product tree: 49ed82020c048a0c77f59b4422c91a1f34910b24.
Product custody: READY; exact-SHA Verify completed successfully.
Verify run: 42522291237, https://github.com/just-every/run-vector/actions/runs/42522291237.
No PR was created; the named cloud branch has a push Verify entry point and no PR-only landing rule was found in repository instructions. No landing, acceptance or deployment is claimed.

## Plan

PLAN.md is the complete seven-step plan. The work initializes fleet identity, launcher, decrypted-bundle Git helper, push guard and cleanup hooks; clones full history and verifies fix1; reproduces the SDK freshness failure; regenerates only documented output; repeats the earlier three findings and types; runs contract, ledger and lock mechanics; publishes only the named branch and observes exact-SHA CI; and returns this external non-secret packet on its separate evidence ref before removing the successful clone.

## Source custody and history

The fresh clone command was `git clone --filter=blob:none https://github.com/just-every/run-vector.git /workspace/run-vector`, with no depth limit. `git rev-parse --is-shallow-repository` returned false. Fetched main and cloud/sd-vector-c-f201-fix1. Checked out fix1, required and printed its exact head `1f64f9b95b0316367438e9f95e1ce65dfae28386`, then created the named fix2 branch from it. `git merge --no-commit --no-ff origin/main` returned Already up to date. Fresh main `0e8a686c06eddd55943ed1d2690df32a8fc82213` was already an ancestor. A later main fetch confirmed the same head.

The first guarded push was rejected non-fast-forward because the named remote branch already held fleet commit `7131292c5cb5aa95fe26960e13c1efbe32967bb6`, which has exactly the same product tree as the new SDK commit. The guard retained and verified a rescue bundle outside the clone. We fetched and merged that published branch with `--no-commit --no-ff`, reran contract write/check, restored views, rechecked SDK freshness and regenerated/checked the lock last. The merge commit preserves both histories, without rebase, force push or main publication. The retry succeeded. Both original product commits and the final merge point to the same tree; all executed local checks therefore cover the final product content. Complete actual observations are in product-push.log, product-push-retry.log and product-receipt.json.

New commits in this invocation:
- e3034575143f257922a6ad3abeedddd49d12e67e — Regenerate issue-type SDK declarations.
- dd03105c358e930529e188bc10b0aa7c731d7fc8 — Merge published issue-type SDK regeneration without rewriting history.

The pre-existing packet's older report, receipt and unique actual logs are retained under prior-run/. Its previous product SHA and CI 42519524580 are historical evidence only; they are never used to claim the new head green. Five historical GitHub observation receipts plus the current discovery are conservatively counted against the task's ten-call budget.

## Product change

Ran the documented generator `node sdk/generate.mjs`, named by the generated file header and docs/API.md. No generated code was hand-edited. Four SDK operation declarations now match the published schema: issueType filtering on list, issueTypeId on create/update/copy, and customFields on copy. The operation count remains 56. Only sdk/generated.ts and its source-lock digest differ from fix1: two files, five insertions and five deletions. product-diff.patch contains the complete delta.

No route, migration, schema, test, contract definition, ID-MAP or generated contract view was changed in this continuation. The earlier census, deployment spec and snapshot corrections remain inherited from fix1. No test was deleted, skipped or weakened. FOLLOW-UP C and the stream-control 429 flake remain outside this round. SDK regeneration changes no application screen, so no new UI capture was required.

## Reproduction and probes

REPRO sdk-freshness: head -> exit=1, SDK is stale; run node sdk/generate.mjs.
PROBE sdk-freshness: fixed -> exit=0, SDK checked: 56 published operations.
PROBE SDK compilation: fixed -> exit=0 with node sdk/build.mjs.
REPRO role-door census: head -> exit=0, 372 routes and 27 forms.
PROBE role-door census: fixed -> exit=0, 372 routes and 27 forms.
REPRO integration: initial fresh-checkout attempt -> exit=1 because dist was absent; this was a build prerequisite, not another stale spec. After documented setup built the product, the baseline integration check passed.
REPRO integration after setup: head -> exit=0.
PROBE integration: fixed -> exit=0; deployment spec, setup digest and producer workflow match. No further deployment-spec regeneration was needed.
REPRO snapshot suites: head -> 3 files and 7 tests passed; none skipped.
PROBE snapshot suites: fixed -> 3 files and 7 tests passed; none skipped.
PROBE typecheck: fixed -> exit=0.
PROBE broader verification: fixed -> `cloud_run timeout 900 npx -y @runeditrun/rer verify`, exit=0, including source/Base checks, command contract, production build, integration freshness, delivery artifact, hosted hydration boundary and 1483/1483 agent-door conformance points.

Bounded touched commands:
- `timeout 180 node --input-type=module -e "const {assertRoleDoorCoverage}=await import('./tests/e2e/role-door-coverage.mjs'); console.log(JSON.stringify(await assertRoleDoorCoverage()));"`
- `timeout 180 pnpm integration:check`
- `timeout 900 pnpm test:worker tests/worker/cycle-schedule.test.ts tests/worker/source-ingest.test.ts tests/worker/outbound-webhooks.test.ts`
- `timeout 60 node sdk/generate.mjs --check`
- `timeout 180 node sdk/build.mjs`
- `timeout 300 pnpm typecheck`

The dedicated cloud VM ran commands directly, with no Mac heavy-slot or load polling. Setup and long-lived verification ran through cloud_run. The provided toolchain script kept the VM's newer direct-command Node v24.19.0 and pnpm 10.12.4; rer reported selecting the project Node 22.20.0 internally. Exact-SHA CI uses the repository's Node 22.20.0 pin. local-build-checks.json records pre-commit HEAD 1f64f9b9 while testing the regenerated working tree; this is explicitly local content evidence, separate from exact-SHA CI. Its tested tree is identical to the pushed tree.

## Mechanical checks and clause custody

MECHANICAL ledger=`timeout 300 node --test --test-concurrency=1 scripts/deployment/tests/migration-head.test.mjs` exit=0; lock=`pnpm sources:lock` / `pnpm sources:check` exit=0/0; views=`node scripts/contract-docs.mjs write ISSUE-021` / `node scripts/contract-docs.mjs check ISSUE-021` exit=0/0.

Restored generated ACCEPTANCE.md and docs/CLAIMS.md whole from origin/main after generation. CONTRACT.md remained unchanged. The same mechanics ran again after merging the pre-existing published branch. The lock was generated after staging product source, and changed only sdk/generated.ts's digest to `30f6b0bff5a6c4251e2980dfb23960572cf791bd2af8ad5b3fa9637142014c54`. Every source-lock check passed.

Main has 133 migrations, through 0133_release_notes.sql. The candidate adds only 0134_issue_types.sql. All main migration bytes remain identical, all numbers are unique and no renumbering was needed. The migration-head test applied the entire ledger with exact names/digests/states and proved a repeat produced no writes.

Before -> after: done 136 -> 136; partial 72 -> 72; missing 64 -> 64; total 272 -> 272. ISSUE-021 stays missing -> missing. The parser compared all 272 clause statuses against both main and fix1; every status was preserved. No judgment was raised and no contract source resolution was needed.

## Publication, CI and cleanup

The author and committer of all ten origin/main..HEAD commits, including both merge parents, are Run Edit Run fleet <fleet@runeditrun.com>. The required git log was read before each push, and identity-scan.json verifies complete messages and identities. No co-author trailer is present. Fleet cleanup hooks preserved repository hooks and remained enabled.

The current exact-SHA observation and subsequent polling receipts are github-call-*.json and github-calls.json. A single watcher loads only the injected bundle token into gh without printing it, waits at least 300 seconds between calls, counts the prior five calls, and uses at most ten total. READY requires completed/success on dd03105c358e930529e188bc10b0aa7c731d7fc8, except the specifically permitted generated-view-only failure. Evidence publication is separate from product custody and signals no acceptance or landing.

Complete command outputs, actual receipts, counts, source provenance and the plan are selected explicitly for evidence publication. No credentials, environment dump, private runtime database or held-out gate material is included. Cleanup removes the fresh successful clone and its node_modules only after evidence return; the external packet and prior rescue bundle remain available.

Exact-SHA observation at 2026-11-08T21:07:21Z: Verify 42522291237 remains in_progress with null conclusion on dd03105c358e930529e188bc10b0aa7c731d7fc8. Seven of ten GitHub calls used, including the five retained prior-run receipts. The initial evidence ref was fetched back with expected head e42c8e9b3101b9f2e1ee0d42c5aa8bc5195885d2, and all 77 file hashes plus the product identity were verified (evidence-initial-readback.json).

## Final result

Exact-SHA Verify 42522291237 was observed completed/success at 2026-11-08T21:22:21Z on dd03105c358e930529e188bc10b0aa7c731d7fc8. This is a full workflow success; no generated-view exemption was needed. ci-receipt.json and github-call-8.json are the actual current-head receipts. Eight GitHub calls were counted in total (five retained older-head observations and three current-head observations). All touched checks, mechanical checks and broader local verification passed. Counts and every clause status remain unchanged. No PR, deployment or landing was performed, and no blocker remains. The final report and complete relevant receipt packet are published only through the evidence ref.
