# sd-vector-c-f203-fix2

## Plan
1. Create a fresh full-history, filtered clone of just-every/run-vector. Confirm fix1 is exactly 2806e3bc158a0b63035276534ab1b20d310699a3; create cloud/sd-vector-c-f203-fix2 and merge fresh main without rewriting published history. Retain every existing clause judgment, test and ID-MAP.
2. Reproduce SDK staleness, regenerate with node sdk/generate.mjs, and check it. Re-run the continuation's Figma OAuth/archive, mounted route inventory, deployment-spec and original populated upgrade probes; do not weaken coverage.
3. Read the prior collaboration failure once. Run its project-report/document tooltip journey on candidate and main with the same bounded command, Node and Chromium. Touch collaboration only if the candidate causes the failure and the cause is within lease. Administration, Figma UI qualification and CDN compatibility remain outside scope.
4. Run typecheck, touched-clause contract write/check, migration ledger proof, documented spec generation/check. Restore generated contract views to main. Stage product changes, generate source lock last, check it, audit all commit identities/trailers, and push only the named cloud branch through the fleet guard.
5. Check the exact-SHA Verify through REST within the ten-call budget and polling cadence. Publish the explicit non-secret report/receipt packet to the separate evidence ref. Report terminal product provenance and inbox outcome without claiming landing or raising a clause status. Remove successful disposable checkouts at the end; preserve recoverable unpushed work if blocked.

## Initial provenance
- Full-history clone: git clone --filter=blob:none; git rev-parse --is-shallow-repository returned false.
- fix1 observed HEAD: 2806e3bc158a0b63035276534ab1b20d310699a3 (matches required head).
- Fresh main: 0e8a686c06eddd55943ed1d2690df32a8fc82213. Merge reports Already up to date: main is already an ancestor. No source or clause conflict.
- Main's highest migration is 0133_release_notes.sql; candidate's 0134_figma.sql does not collide.
- Previous Verify 42515193427 collaboration job 128836857107: timeout at tests/e2e/project-documents-journey.mjs:63 after keyboard focus succeeds and hover waits for the document issue-reference tooltip. Failure excerpt retained; full logs with unrelated fixtures excluded from public packet.
- API calls recorded in github-calls.jsonl; product and evidence publication remain separate.

## Results
### SDK correction
REPRO SDK: required fix1 head -> `timeout 60 node sdk/generate.mjs --check` exit 1, "SDK is stale".
PROBE SDK: documented `node sdk/generate.mjs` -> exit 0; same check -> exit 0. `node sdk/build.mjs` compiles the generated SDK successfully. Generated typed/runtime operation counts increase from 56 to 58, adding Figma capture POST and its unauthenticated OPTIONS preflight. No generator or schema was hand-edited.

### Continuation probes
The four gate-1 corrections were already present on required fix1; this continuation does not falsely claim to reproduce their pre-fix red states. On that head:
- REPRO Figma OAuth: `timeout 240 pnpm exec vitest run --config vitest.config.ts tests/worker/link-cascade.test.ts -t Figma` -> exit 0. Its provider fixture requires the documented Basic header and authorization-code form; the journey also covers preview isolation, captures and archive boundaries.
- REPRO mounted-route inventory: `timeout 240 pnpm exec vitest run --config vitest.config.ts tests/worker/integration-api.test.ts -t 'versioned schema is published'` -> exit 0. The real app's mounted routes still exactly equal declared inventory; no check loosened.
- REPRO deployment spec: `timeout 60 pnpm integration:check` -> exit 0. Candidate migration 0134 is included.
- REPRO original populated upgrade: `timeout 240 pnpm exec vitest run --config vitest.config.ts tests/worker/project-fields-upgrade.test.ts` -> exit 0. `preserveAfter:'0125_issue_templates.sql'` matches main, so historical release rows are inserted before 0133. No migration on main was renamed or changed.
Final-SHA repetitions are recorded as probe-figma, probe-inventory and probe-upgrade in local-receipts.jsonl.

### Mechanical verification
MECHANICAL ledger=`node --test scripts/deployment/tests/migration-head.test.mjs` exit=0; spec=`pnpm integration:sync` and `pnpm integration:check` exit=0; lock=`pnpm sources:lock` and `pnpm sources:check` exit=0; views=`node scripts/contract-docs.mjs write DESIGN-001` and `node scripts/contract-docs.mjs check DESIGN-001` exit=0.
- Typecheck: `timeout 240 pnpm typecheck` exit 0.
- Both generated views restored with `git checkout origin/main -- ACCEPTANCE.md docs/CLAIMS.md`. Neither view, CONTRACT.md nor any summary count changes in the product candidate.
- Source lock regenerated last after staging the sole product output; only sdk/generated.ts's digest changes. Source check passes.
- Source hooks preserved and fleet coauthor cleanup active. All four candidate commits, including every reachable side parent, have fleet author and committer identities and no trailers. No force push, rebase, main push, deployment or landing.

### Product provenance and clause custody
Product branch: cloud/sd-vector-c-f203-fix2. New commit: 4c9460bbf65aa048896713d3c1f925809e64bd04. Relative to fix1: two files, 17 insertions, one deletion (16 generated SDK lines and one digest update).
Push guard succeeded on its first attempt; remote ref independently matched the exact head. No PR created: push verification has a pre-main cloud branch entry point and the lane owns landing.
DESIGN-001 remains **missing -> missing**. Every other clause judgment is unchanged. Published 98 done/6 partial/0 missing = 104; target and push-further 38 done/66 partial/64 missing = 168; total **136 done, 72 partial, 64 missing = 272**, before and after.

### CI and comparison
Previous fix1 Verify: 42515193427; its failed collaboration job 128836857107 identifies project-documents-journey.mjs:63. Main 0e8a686c06eddd55943ed1d2690df32a8fc82213 has successful exact-SHA Verify runs 42503991437 and 42501646337. Candidate run 42520664122 is watched through REST on exact head 4c9460bbf65aa048896713d3c1f925809e64bd04. Polling is at least 300 seconds apart and the total API budget is tracked.
The initial candidate project-report journey passes at 1440/390 on Node 24.19.0 and system Chromium. An explicit Node 22.20.0 comparison is run against main and the final candidate, using the same `timeout 600 node tests/e2e/project-report-runtime.mjs` command and `/usr/bin/chromium` with no sandbox. Main exit 0 in 176.66 seconds; final candidate exit 0 in 180.59 seconds. The tooltip timeout is not reproduced on either. This is not proof that main flakes: main's observed exact-SHA CI is green. There is no observed candidate cause to fix, so no collaboration/test change is made. `tooltip-source-comparison.json` records identical tooltip, markdown, reference and document sources and journey files.
Administration is outside lease; the supplied brief reports its prior main failure. No administration fix or exemption from exact-SHA gate success is claimed.

### Boundaries
Figma UI qualification, rendered-image CDN compatibility, provider commissioning and every remaining DESIGN-001 acceptance obligation remain owed. SDK regeneration and local fixtures do not qualify these. Packet publication is report transport only, separate from product READY/acceptance/landing. Reports select only regular, non-secret files; no environment dump, runtime database, credential, private gate material or symlink is published.


### Final local outcomes
PROBE Figma OAuth: fixed final SHA -> exit 0 (52.78 s).
PROBE mounted-route inventory: fixed final SHA -> exit 0 (11.93 s).
PROBE populated original upgrade: fixed final SHA -> exit 0 (22.30 s).
PROBE deployment spec: generated and checked -> exit 0; its bytes were already correct on fix1, so regeneration produces no product diff.
PROBE SDK: fixed final SHA -> check exit 0; SDK TypeScript compilation exit 0.
Final `pnpm sources:check` and `rer check --profile first-party` both exit 0.
Matched document reference journey: main -> PASS; candidate -> PASS. Final candidate diagnostic screenshots at 1440 and 390 are included; these show unchanged document reference behavior and make no Figma interface qualification claim. No product UI was changed in this continuation.


### Report custody
The complete packet is retained at `$HOME/rer-consolidation/work/sd-vector-c-f203-fix2/packet/`. It includes the actual local command receipts, the prior failed tooltip excerpt, exact-SHA REST receipts, product push/identity receipts, source-comparison receipt and two inspected synthetic document screenshots. Raw unrelated workflow archives and private local setup/runtime files are excluded. The successful disposable main control has been removed after its receipt was saved. Product checkout cleanup follows completed verification and report transfer.
