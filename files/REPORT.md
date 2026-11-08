# sd-vector-c-f203-fix1

Repository: just-every/run-vector
Product branch: cloud/sd-vector-c-f203-fix1
Product SHA: 2806e3bc158a0b63035276534ab1b20d310699a3
Parent candidate: 5fd3e3aa1131abe2a3b003f2c29c47f3d148b9df
Fetched main: 0e8a686c06eddd55943ed1d2690df32a8fc82213
PR: none created; product custody is the explicitly named branch.

## Plan and provenance

The full plan is in PLAN.md. The launcher was refreshed first after the required global Git identity setup. Git uses the decrypted-bundle helper and guarded product push. A fresh `git clone --filter=blob:none` made a full-history checkout (not shallow). The fetched source branch was checked out and `git rev-parse HEAD` printed exactly 5fd3e3aa1131abe2a3b003f2c29c47f3d148b9df. The fix branch was created from it. `git fetch origin main cloud/sd-vector-c-f203` was followed by `git merge --no-commit origin/main`, which reported Already up to date. Main is already an ancestor. No rebase, force push, main push or published-history rewrite occurred.

The lease was derived from the requested diff stat, recorded in baseline.json. Only six leased files changed in the FIX commit: the OAuth client, its existing protocol fixture, schema/api-v1.json, the historical upgrade test, the generated deployment specification and sources.lock.json. No migration SQL, unrelated prose, CONTRACT row, ID-MAP, workflow, UI or administration code changed.

## Reproduction and fixes

REPRO A: head -> exit 1. With the existing mounted member callback journey's synthetic provider fixture corrected to demand Figma's documented HTTP Basic app authentication, the valid callback returned 503 instead of 303. See repro-A.log.

PROBE A: fixed -> exit 0. OAuth token exchange now sends `Authorization: Basic base64(clientId:clientSecret)` to the fixed Figma token endpoint, with the authorization code, grant type and redirect URI in the URL-encoded body. The bounded transport, response checks, redirect refusal, deadlines, state consumption and grant storage remain in force. File/image reads retain bearer authentication. The stricter fixture verifies Basic authentication and the exact body fields; valid callbacks redirect with 303. Existing failure, replay, revocation, preview, plugin and archive assertions remain. See probe-A.log.

REPRO B: head -> exit 1. The unchanged schema-publication journey's exact mounted-route comparison found `OPTIONS /integrations/figma/issues` mounted but undeclared: 58 mounted routes versus 57 declarations. See repro-B.log.

PROBE B: fixed -> exit 0. Added that operation to the published schema with no bearer requirement for preflight, empty scopes and its 204/403 responses. POST retains its personal-token authority. The inventory comparison is unchanged and now has 58 mounted routes and 58 declarations. See probe-B.log.

REPRO C: head -> exit 1. `pnpm integration:check` reported stale management/integration/deployment-spec.json. Baseline source had 134 migrations, while its published spec contained 133 and omitted 0134_figma.sql. See repro-C.log and baseline.json.

PROBE C: fixed -> exit 0. Built through `npx -y @runeditrun/rer build`, then ran the documented `pnpm integration:sync` generator. The sole deployment-spec addition is the exact 0134_figma.sql migration with SQL and digest; it now declares all 134 source migrations. `pnpm integration:check` passes. See probe-build.log, mechanical-spec-sync.log and probe-C.log.

REPRO D: head -> external fixture-position audit exit 1. The original checkpoint was 0125_issue_templates.sql on main; the candidate moved it to 0133_release_notes.sql, placing the historical release fixture after the ownership migration it must cross. The direct comparison is captured in repro-D-position.log. The upgrade test was also run with main's original checkpoint restored and already passed (repro-D.log); no migration SQL change was needed.

PROBE D: fixed -> fixture-position audit exit 0 and unweakened upgrade journey exit 0. Restored exactly main's 0125 checkpoint and original fixture insertion, so populated historical releases cross migration 0133 with unknown ownership intact. The candidate's independent empty-Figma-table assertion remains. The rest of the file, excluding that additive assertion, matches main byte-for-byte. See check-upgrade-fixture.py, probe-D-position.log and probe-D.log.

## Mechanical checks and tests

MECHANICAL ledger=`timeout 180 node --test scripts/deployment/tests/migration-head.test.mjs` exit=0; spec=`timeout 90 pnpm integration:sync` exit=0 and `timeout 90 pnpm integration:check` exit=0; lock=`timeout 120 pnpm sources:lock` exit=0 and `timeout 120 pnpm sources:check` exit=0; views=`timeout 120 bash -c 'node scripts/contract-docs.mjs write DESIGN-001 && node scripts/contract-docs.mjs check DESIGN-001'` exit=0.

The generated views were restored whole with `git checkout origin/main -- ACCEPTANCE.md docs/CLAIMS.md`; neither view is in the commit. All product changes were staged before sources:lock, which was generated last. The commit contains its resulting source lock. No migration number collided: main's highest is 0133 and this candidate remains 0134. Every main migration's identity and bytes remain unchanged. The migration-ledger proof applies all 134 migrations, checks their exact digest ledger, owner/invitation guards and foreign keys, then proves a repeat has zero writes.

Every functional repro command was repeated unchanged after its fix. Typecheck passed with `timeout 240 pnpm typecheck`. The full three touched suites then passed: 3 files, 8 tests, 0 failures, 0 skipped (`timeout 300 pnpm exec vitest run --config vitest.config.ts tests/worker/link-cascade.test.ts tests/worker/integration-api.test.ts tests/worker/project-fields-upgrade.test.ts`). Focused repros used test selection, accounting for their reported unselected tests; no test was deleted, disabled, skipped or weakened. See probe-touched-suite.log and checks.jsonl.

Setup and rer build were run through the required cloud_run subreaper. The supplied toolchain selects pnpm 10.12.4; the shell's Node is 24.19.0 and rer provisions its pinned Node 22.20.0 internally. CI uses the repository's Node 22.20.0. No provider credentials or real Figma account were used in tests.

## Counts and clause custody

Before/after: 272 clause Status rows, comprising 136 done, 72 partial and 64 missing, unchanged. Published counts remain 98/6/0 of 104; target/push-further counts remain 38/66/64 of 168. CONTRACT.md is byte-for-byte unchanged, including every parent Status row. Although the brief describes the earlier candidate as claimed PARTIAL, the actual source's DESIGN-001 definition and Status row say missing; this FIX makes no judgment and leaves missing unchanged. See clause-counts.json.

API inventory: 57 -> 58 declared operations, now matching 58 mounted operations. Generated spec: 133 -> 134 migrations, matching 134 source migrations. Historical fixture: moved checkpoint 0133 -> restored 0125, crossing 0133 again. No UI qualification, CDN compatibility qualification, hosted provider acceptance or landing is claimed. The administration failure named in the brief remains out of scope.

## Product publication and CI

The only product push succeeded on its first attempt through cloud-push.py, immediately after the first real FIX commit. No [skip ci] was used. Before push, `git log -1` and the required full `git log origin/main..HEAD` identity/trailer inspection covered all three candidate commits, including side parents. Every author and committer is Run Edit Run fleet <fleet@runeditrun.com>, and all trailers are absent. No OpenAI/Codex coauthor remains. See identity-audit.json, product-commit.txt, product.patch and product-push.log.

Exact-SHA Verify observation is recorded separately in CI.json, github-calls.jsonl and RECEIPT.json. The watcher explicitly loads only the injected GH_TOKEN from the decrypted bundle for each gh invocation, has a ten-call total budget and spaces all CI API calls by at least 300 seconds. Initial discovery immediately after push returned no runs; this is not a green result. Final status is appended below.

Evidence is a separate report-only publication on evidence/sd-vector-c-f203-fix1. It confers no product readiness or acceptance. No report files were committed to the product branch. Cleanup and terminal provenance are recorded in the final receipt; an unpushed clone would be preserved with an external verified rescue bundle.

Local full `cloud_run timeout 900 npx -y @runeditrun/rer verify` completed successfully (exit 0), including build, integration spec validation, artifact production, hydration and 1,483/1,483 agent-door conformance points. See probe-verify.log.

Exact-SHA Verify discovered: run 42515193427, https://github.com/just-every/run-vector/actions/runs/42515193427, head 2806e3bc158a0b63035276534ab1b20d310699a3. Initial observed status in_progress; terminal observation follows.

The terminal Verify observation was completed/failure on the exact product SHA. The first failed-job inventory request returned HTTP 401 (Bad credentials). Fleet refresh and the required Git setup were repeated; a second Git probe after the first 15-second backoff succeeded and confirmed the remote product SHA. Only the injected bundle credential was used. See AUTH-RECOVERY.jsonl and ci-jobs-7.log. A verified external incremental FIX bundle was also saved, with the already-published candidate parent as its prerequisite; BUNDLE.json records its path, digest and exact head. Failure classification follows below.

## Exact-SHA CI blocker: SDK outside the lease

Run 42515193427 completed/failure on 2806e3bc158a0b63035276534ab1b20d310699a3. Plan, build, imports, portability, core-runtime, core-runtime-planning and worker-2 succeeded. Hosted-artifact, administration and collaboration failed, and the aggregate verify job failed with them. Job inventory is ci-jobs-8.json.

The single permitted hosted-artifact log read succeeded: `gh run view 42515193427 --repo just-every/run-vector --job 128836857095 --log-failed` (GitHub call 9). Its deployment-spec validation passed, as did local artifact and agent-door checks. It later failed in `test:integrations` at `sdk/generate.mjs --check` with “SDK is stale; run node sdk/generate.mjs”. This is not a generated-view-only failure.

Local `timeout 60 node sdk/generate.mjs --check` reproduced exit 1. Isolated copies outside the checkout prove main's schema/SDK check passes, while the original candidate's schema/SDK check and this FIX head's check both fail. Regenerating only in that external fixture produces the exact owed diff for sdk/generated.ts: hunks at original lines 68 and 527 add figma_capture and figma_capture_preflight operation types and declarations. See SDK-LEASE-BLOCKER.json and SDK-REQUIRED.patch for exact bytes. Neither sdk/generated.ts nor sdk/generate.mjs is in the candidate diff/explicit lease. No SDK product file was touched.

The four requested local probes are repaired. This newly exposed CI requirement cannot be completed inside the explicit lease. The follow-up needs authorization for `sdk/generated.ts` regeneration, its source lock update and a new exact-SHA verification run. No clause promotion, READY or landing is claimed. Product publication already occurred immediately after the first real FIX commit under the cloud preservation instruction; it remains pushed and has not been rewritten. The administration code remains explicitly out of scope. Collaboration diagnosis follows below.

## Remaining CI diagnosis and terminal outcome

The single collaboration log read succeeded: `gh run view 42515193427 --repo just-every/run-vector --job 128836857107 --log-failed` (call 10). It failed in `tests/e2e/project-report-runtime.mjs`, through `projectDocumentsJourney`, waiting for the synthetic issue-link tooltip at 1440 in `tests/e2e/project-documents-journey.mjs:63:67`. See ci-failed-job-10.log. This document UI/test is outside the explicit lease; no causal claim about main or the Figma changes is made, and neither file was changed.

All ten permitted GitHub invocations are recorded in github-calls.jsonl, spaced at least 300 seconds apart. Both requested log archives were read successfully once, without custom Authorization headers or signed-URL fetching. The administration shard also failed; its assertion log was not read because administration was expressly excluded and the remaining budget prioritized the newly exposed hosted-artifact and collaboration failures. The brief's existing-administration report is context, not independent proof that this particular assertion is identical. No workflow was rerun, and no green status is claimed from another SHA.

Terminal product state: PUSHED but BLOCKED, head 2806e3bc158a0b63035276534ab1b20d310699a3 on cloud/sd-vector-c-f203-fix1. The requested four fixes and their same-command probes pass; exact-SHA Verify remains red. SDK regeneration outside the lease and the outside-lease collaboration timeout prevent READY. The generated-view-only exemption does not apply. The lane should expand the next brief to include sdk/generated.ts (required hunks are attached), address or rule on the collaboration failure, and retain the already-owned administration follow-up. No permission or clause judgment was invented to expand this FIX.

The final six-file product commit remains unchanged and the checkout is clean. Product, contract and evidence custody remain separate. All non-secret actual reports, receipts, required SDK diff and CI logs are selected explicitly for the evidence-only ref. After successful evidence publication, the disposable checkout and node_modules are removed as requested. The external packet and verified incremental backup are retained; BUNDLE.json records its exact path, SHA-256 and published parent prerequisite. Publication identity checks do not claim the fleet's independent Mac publication scan or landing.
