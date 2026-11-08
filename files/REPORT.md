# sd-vector-c-f204-fix1 — AUTO-002 gate FIX

Repository: just-every/run-vector. Branch: cloud/sd-vector-c-f204-fix1.
Original candidate: 3a2537c1d37eff9008b842168e54fc5f09bbc6bc, verified by rev-parse HEAD.
Fresh merged main: 442b61455234c57befcb642bf4afdaa2dc459922.
Final product SHA, push outcome and exact-SHA CI appear in product-receipt.json and ci-receipt.json.

## Scope and judgments

This fixes only private Slack destination disclosure in rule Settings and normal verification failures from the activity projection and stale generated metadata. AUTO-002 stays partial. CONTRACT.md, all parent Status rows, main's ID-MAP and summary counts are unchanged.

Before/after counts: published 98 done / 6 partial / 0 missing (104); target and push further 38 / 66 / 64 (168); all 136 / 72 / 64 (272). No clause judgment changes. The Opus Settings interface and browser qualification remain owed. FOLLOW-UP C (automation receipts and internal snapshot self-matching) is unchanged. No UI changed, so there are no changed screens for 1440/390 captures. No deployment, landing, hosted commissioning or acceptance promotion is claimed.

## Plan and merge

PLAN.md contains the full pre-edit plan. A fresh full-history clone used git clone --filter=blob:none, with no depth. The exact published candidate was required, the named FIX branch created from it, and fresh main merged without rebasing or rewriting published history. Fleet identity, credentials, commit hooks and the prescribed toolchain were installed. Bounded heavy commands ran directly in this dedicated cloud VM.

CONTRACT.md was resolved first using main's unchanged source. Main's ACCEPTANCE.md and docs/CLAIMS.md were retained whole. The archive inventory merge retained both main's Slack tables and the candidate's automation tables. The import snapshot merge retained both patches without changing their behavior. Main's newer source and tests remain intact.

Only the candidate's unapplied 0134_automation_rules.sql was renamed to 0135_automation_rules.sql, byte-for-byte. All 134 main migrations, including 0134_slack_threads.sql, remain byte-identical. The populated previous-head fixture freezes at main's 0134 before applying automation at 0135; no upgrade assertion was removed or weakened. migration-receipt.json records every retained migration hash.

## Blocking B: Settings privacy

REPRO B: head -> FAIL. A new native HTTP regression returned another private team's private-automation-secret channel name and destination ID to a public-team manager. It failed at the assertion excluding that destination. The initial five-file command completed with 17 passing tests and this one failure. See repro-privacy.log and repro-worker.log.

The destination query now limits team/project/view binding subjects through the request's existing visibility CTEs, applying current private-team membership and project/view visibility. A visible team's saved rule may still reference a withdrawn destination; its returned destination_id is now null unless available to the current reader. Storage and delivery configuration remain intact.

PROBE B: fixed -> PASS. The extended native HTTP regression proves the public binding remains listed, a non-member manager and non-member Admin receive neither private name nor ID, saved references are redacted, adding membership permits visibility, and deleting membership conceals it on the next request. The Owner retains permitted visibility. See probe-privacy-session.log and the final full worker receipt.

## Blocking BAR: sessions and generators

REPRO BAR/session: head -> FAIL (3/3). The unchanged stale edit/accept/return tests failed at projected === true. The candidate replaced the native SELECT id,actor_name FROM issue_activity projection watched by the interleaving fixture, preventing real native signout from being scheduled. This was a projection/interception regression, not evidence of a broken revocation predicate. The fix retains that native actor projection as a derived relation and decorates automation owner attribution in the outer SQL query. No session checks, signout behavior or test assertions were relaxed.

PROBE BAR/session: fixed -> PASS (3/3), using the exact original command. The fixture schedules real signout, receives 401 without private projection data and proves unchanged business storage. The combined privacy/session selection passes all four selected tests. Its fifth test was unselected by the command's name filter; no source test is skipped or disabled. The complete automation test remains in the final five-file command.

REPRO BAR/spec: head -> FAIL. After setup's production build completed, pnpm integration:check reported stale management/integration/deployment-spec.json. An earlier attempt during setup returned ENOENT for dist and was not used as the reproduction. The completed-build reproduction is repro-spec.log.

PROBE BAR/spec: fixed -> PASS. Final cloud_run timeout 600 npx -y @runeditrun/rer build passes, including pnpm typecheck. pnpm integration:sync and pnpm integration:check pass and record 0135 after main's 0134. node sdk/generate.mjs and its --check pass, producing 56 operations with no SDK byte changes relative to main. Existing mounted Settings permission registrations/census fixtures remain intact. rer check passes. Generated metadata was not hand-edited.

## Mechanical checks and local environment

MECHANICAL ledger=timeout 120 node --test scripts/deployment/tests/migration-head.test.mjs exit=0; spec=pnpm integration:sync && pnpm integration:check exit=0; lock=pnpm sources:lock && pnpm sources:check exit=0; views=node scripts/contract-docs.mjs write AUTO-002 && node scripts/contract-docs.mjs check AUTO-002 exit=0.

The ledger test applies all migrations, verifies exact names/digests, guards and foreign keys, and proves repeat migration writes nothing. The deployment suite passes 9/9. Final build includes passing typecheck. Source lock generation follows staged changes and its check passes. Contract views were generated and checked for AUTO-002, then restored whole from origin/main. Checking after restoration reports the expected ACCEPTANCE.md mismatch; those view changes are not committed. CONTRACT.md is unchanged.

The first seven-file post-merge command passed 13 tests, including automation, privacy, stale sessions and populated upgrade, but all nine base-auth tests failed with setup's private .dev.vars present. A base-auth-only command reproduced those failures. The settings file was moved without reading/printing it outside the checkout and outside the packet; the final five-file command uses CI's synthetic fixture bindings. No product or test source was changed for this environment issue. Actual failed and final successful receipts are retained.

## Publication and custody

Only product, migration, generated spec, source lock and requested documentation enter the product branch. Reports/receipts remain outside it. Every candidate commit author, committer and trailer, including side parents, is audited before the mandatory cloud-push.py guarded push. No OpenAI/Codex co-author trailer is added. Push and exact-SHA CI outcomes are recorded in receipts.

Evidence is separate on evidence/sd-vector-c-f204-fix1 and establishes no product acceptance or landing signal. No PR is required by the supplied repository rules. The branch is returned to SD and main is never pushed. After successful publication, the product clone and node_modules are deleted; the packet and published refs preserve the work. Any transfer failure or CI blocker is stated in the terminal report and receipts.

Additional published-head role-matrix probe: 4/6 cases pass; two timed out at existing test limits (30s and 120s), with no failed product assertion. The private/invited-team case passes in isolation (33.67s test duration). The isolated owner-role case reached its 180s command bound without an assertion result. These extra local timing results are retained, not represented as a green full role suite, and no test or product changes were made for them. Exact-SHA CI remains the independent normal-verification requirement.

Product evidence references at ea77c904c8e553bca43f152710a5d04e4e9e2587:

- Scoped destination read: src/core/features/automation-rules/settings.ts:29.
- Saved-reference redaction: src/core/features/automation-rules/settings.ts:38.
- Preserved native projection and ownership decoration: src/core/features/issues/service.ts:42.
- Privacy HTTP regression: tests/worker/automation-rules.test.ts:100.
- Previous-main populated checkpoint: tests/worker/project-fields-upgrade.test.ts:10.
- Generated migration metadata: management/integration/deployment-spec.json:820.

## Final exact-SHA outcome

Product: cloud/sd-vector-c-f204-fix1 at ea77c904c8e553bca43f152710a5d04e4e9e2587, pushed successfully on the first guarded attempt. Verify run 42530509805 completed/success on that exact SHA: https://github.com/just-every/run-vector/actions/runs/42530509805. Seven GitHub calls were used (one discovery and six spaced run polls). No generated-view exemption is needed for this actual success. Custody is READY, with no task blocker and no landing claim. No PR was created. The extra local role timeouts remain disclosed above; the independent full exact-SHA workflow succeeds.

Final local counts: original five-file repro 17 pass / 1 privacy failure -> fixed 18 pass / 0 failure; stale-session repro 0 pass / 3 failure -> fixed 3 pass / 0 failure; deployment 9/9; migration ledger 1/1. Clause counts and all judgments are unchanged (136 done / 72 partial / 64 missing, total 272). AUTO-002 remains PARTIAL.
