# sd-vector-c-f201-fix2 report

Product custody: **PUSHED**, branch `cloud/sd-vector-c-f201-fix2`, head `7131292c5cb5aa95fe26960e13c1efbe32967bb6`.
Repository: just-every/run-vector. Product push succeeded on attempt 1.
Verify 42519524580: in_progress/None; exact SHA 7131292c5cb5aa95fe26960e13c1efbe32967bb6.
CI URL: https://github.com/just-every/run-vector/actions/runs/42519524580
No PR was created: this brief requires the named branch; no repository PR-only landing rule was found.
No landing or clause acceptance is claimed.

## Plan and source custody

The complete pre-edit plan is PLAN.md. All seven steps remain represented by the checks and custody receipts in this packet.
The checkout was a fresh `git clone --filter=blob:none` without a depth limit; `git rev-parse --is-shallow-repository` returned false.
Fetched fix1 and main; required and printed fix1 head `1f64f9b95b0316367438e9f95e1ce65dfae28386`.
Created fix2 from fix1 and ran `git merge --no-commit origin/main`: Already up to date.
Main `0e8a686c06eddd55943ed1d2690df32a8fc82213` was already an ancestor of fix1, so no merge commit or conflict resolution was needed.
No published history was rebased or rewritten. All main tests, CONTRACT rows and ID-MAP were preserved.
Main's highest migration was 0133_release_notes.sql; the candidate's 0134_issue_types.sql does not collide.
The baseline lease stat is fix1-lease-stat.txt; complete before provenance is provenance-before.json.

## Product change

Ran the documented `node sdk/generate.mjs` from docs/API.md. No SDK content was hand-edited.
The generated SDK now includes issueType query filtering, issueTypeId on create/update/copy, and customFields on copy, exactly as schema/api-v1.json declares.
The generator still describes 56 published operations.
Only sdk/generated.ts (four replacement lines) and its sources.lock.json digest changed in this continuation:

```
sdk/generated.ts  | 8 ++++----
 sources.lock.json | 2 +-
 2 files changed, 5 insertions(+), 5 deletions(-)
```

The actual generated hunk is sdk-regeneration.patch. No route, schema, migration, test or contract definition was changed by fix2.
The earlier role-door, deployment-spec and snapshot fixes remain from fix1.

## Reproduction and probes

REPRO sdk-freshness: head -> exit=1, SDK is stale; run node sdk/generate.mjs.
PROBE sdk-freshness: fixed -> exit=0, SDK checked: 56 published operations.
PROBE SDK compilation: fixed -> exit=0 via node sdk/build.mjs.

REPRO role-door census: head -> exit=0; 372 routes and 27 forms.
PROBE role-door census: fixed -> exit=0; same counts, unchanged census.
REPRO integration: head -> initial exit=1 because dist was absent in a fresh checkout, not a stale spec.
REPRO integration after documented production build: head -> exit=0.
PROBE integration: fixed -> exit=0; deployment spec, setup digest and producer workflow match.
No further deployment spec regeneration was required.

REPRO snapshot suites: head -> 3 files, 7 tests passed, none skipped.
PROBE snapshot suites: fixed -> 3 files, 7 tests passed, none skipped.
The suites are cycle-schedule.test.ts, source-ingest.test.ts and outbound-webhooks.test.ts.
PROBE typecheck: fixed -> exit=0.
The production build passed. Local rer build used the repository Node 22.20.0; direct checks used Node 24.19.0 under the prescribed toolchain script. pnpm was 10.12.4.
No UI change was made, so no additional browser capture was required.

## Mechanical proof

MECHANICAL ledger=timeout 300 node --test scripts/deployment/tests/migration-head.test.mjs exit=0; lock=timeout 180 pnpm sources:lock / timeout 180 pnpm sources:check exit=0/0; views=timeout 60 node scripts/contract-docs.mjs write ISSUE-021 / timeout 60 node scripts/contract-docs.mjs check ISSUE-021 exit=0/0.
The ledger test applied every migration, compared exact name/digest/state rows, and proved repeated migration produced no writes.
After contract write/check, restored ACCEPTANCE.md and docs/CLAIMS.md whole from origin/main.
CONTRACT.md required no source change. Staged sdk/generated.ts before regenerating the source lock last, then checked it.
The lock changed only the generated SDK digest to `30f6b0bff5a6c4251e2980dfb23960572cf791bd2af8ad5b3fa9637142014c54`.

Before -> after counts: done 136 -> 136; partial 72 -> 72; missing 64 -> 64; total 272 -> 272.
ISSUE-021: missing -> missing. Every parent Status row is byte-for-byte preserved. No clause judgment changed.

## Actual commands and receipts

All entries below ran under hard timeouts in this dedicated VM; no Mac heavy-slot/load polling was used.
Raw outputs are the explicitly selected accompanying log files; checks.json records timestamps and exit codes.

| Phase | Finding/check | Command | Exit |
| --- | --- | --- | ---: |
| repro | sdk-freshness | `timeout 60 node sdk/generate.mjs --check` | 1 |
| repro | role-door-census | `timeout 180 node --input-type=module -e import {assertRoleDoorCoverage} from "./tests/e2e/role-door-coverage.mjs"; console.log(JSON.stringify(await assertRoleDoorCoverage()));` | 0 |
| repro | integration | `timeout 180 pnpm integration:check` | 1 |
| repro | snapshots | `timeout 600 pnpm exec vitest run --config vitest.config.ts tests/worker/cycle-schedule.test.ts tests/worker/source-ingest.test.ts tests/worker/outbound-webhooks.test.ts` | 0 |
| repro | production-build | `timeout 900 npx -y @runeditrun/rer build` | 0 |
| repro | integration-built | `timeout 180 pnpm integration:check` | 0 |
| probe | sdk-generation | `timeout 60 node sdk/generate.mjs` | 0 |
| probe | sdk-freshness | `timeout 60 node sdk/generate.mjs --check` | 0 |
| probe | sdk-build | `timeout 180 node sdk/build.mjs` | 0 |
| probe | role-door-census | `timeout 180 node --input-type=module -e import {assertRoleDoorCoverage} from "./tests/e2e/role-door-coverage.mjs"; console.log(JSON.stringify(await assertRoleDoorCoverage()));` | 0 |
| probe | integration | `timeout 180 pnpm integration:check` | 0 |
| probe | snapshots | `timeout 600 pnpm exec vitest run --config vitest.config.ts tests/worker/cycle-schedule.test.ts tests/worker/source-ingest.test.ts tests/worker/outbound-webhooks.test.ts` | 0 |
| probe | typecheck | `timeout 300 pnpm typecheck` | 0 |
| mechanical | migration-ledger | `timeout 300 node --test scripts/deployment/tests/migration-head.test.mjs` | 0 |
| mechanical | views-write | `timeout 60 node scripts/contract-docs.mjs write ISSUE-021` | 0 |
| mechanical | views-check | `timeout 60 node scripts/contract-docs.mjs check ISSUE-021` | 0 |
| mechanical | source-lock | `timeout 180 pnpm sources:lock` | 0 |
| mechanical | source-lock-check | `timeout 180 pnpm sources:check` | 0 |

## Publication and remaining custody

The commit author and committer are Run Edit Run fleet <fleet@runeditrun.com>.
The fleet cleanup hook remained active. identity-check.txt records the required log for every candidate, including side parents; complete candidate messages were inspected and contain no co-author trailers.
Used cloud-push.py only for the product branch. Product push succeeded on attempt 1, without force or main publication.
Github API reads load only the launcher bundle credential into the gh process. github-calls.json and github-call-*.txt retain actual non-secret terminal observations.
Exact-SHA Verify is observed only for `7131292c5cb5aa95fe26960e13c1efbe32967bb6`; polling is spaced by at least 300 seconds and limited to ten calls.
Verify 42519524580: in_progress/None; exact SHA 7131292c5cb5aa95fe26960e13c1efbe32967bb6.
Product READY/PUSHED custody is independent of report publication. Independent publication/acceptance/landing gates remain fleet work.
FOLLOW-UP C and the stream-control 429 flake remain outside this round.
The successful product clone and node_modules will be removed after packet publication; no started browser/server needs cleanup.
