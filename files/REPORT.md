# sd-vector-c-f207-fix2 — PUSHED

Repository: just-every/run-vector. Branch: cloud/sd-vector-c-f207-fix2.
Terminal head: aca2bf27220ae4cfbdf2c53b3903b9dd9bb09090.
Latest integrated main: ea77c904c8e553bca43f152710a5d04e4e9e2587.

The SD erasure ruling and personal-time cleanup are implemented. Two further candidate regressions found by CI were repaired: missing legacy removal receipts and contradictory agent-event erasure expectations. The final merged tree passes 33 worker tests, typecheck, native verification and mechanical checks. The full native archive round trip passes on the repair checkpoint. ROLE-011 stays PARTIAL and the separate ROLE-012 member-erasure flow remains owed.

Terminal custody is PUSHED, not READY. The conservative ten-call GitHub observation budget is exhausted. Verify 42530676501 was completed/failure on the earlier e0acd71c5e7ce8ce10a6f57bf947b9d1ce20b326, and is never represented as green or as a result for the terminal SHA. The terminal normal-CI push requests the existing cloud-branch workflow, but its exact-SHA run ID/conclusion is unobserved. Independent fleet verification/publication scanning and landing are still required.

## Plan, history and scope

PLAN.md records the complete plan and its two follow-up steps: fleet setup; full-history filtered clone and integration; resolve sources and migration collisions; reproduce findings/compare main; repair only leased candidate code; repeat touched tests/typecheck; regenerate/check outputs; audit and push named saves; observe exact-SHA CI within budget; publish explicit report-only evidence; clean up owned resources.

The initial environment execution left this task's fresh full-history clone and an unfinished main merge. Resumed work preserved the checkout and actual receipts. The clone is not shallow, its filter is blob:none, and fix1 was printed/verified as exactly 5b5292f80ce0b391e972787c338489c04e40af3d. The branch begins there, merges main 442b61455234c57befcb642bf4afdaa2dc459922, and later merges fresh main ea77c904c8e553bca43f152710a5d04e4e9e2587 without rebasing or rewriting any published history.

Product commits:

- e0acd71c5e7ce8ce10a6f57bf947b9d1ce20b326: first integration/ruling/personal-time repair, normal CI.
- 070baa9ac630996a95fd79d668a3f1af724681cf: legacy receipt and native title-event erasure repair, [skip ci] preservation save. The real archive harness clones committed source, so this unit/typechecked save enabled its complete probe.
- aca2bf27220ae4cfbdf2c53b3903b9dd9bb09090: terminal normal-CI merge of the latest main, renumbered candidate migration and final contract/lock regeneration.

All three guard pushes succeeded on their first attempt. Every candidate commit, including side parents, was checked before every push. All eleven terminal candidates have fleet author/committer, allowed trailers and no OpenAI/Codex co-author. Hooks stayed active and all commit commands carried the required four identity variables. No PR, main/default-branch push, force push, deployment, provider delivery, acceptance or landing is claimed.

## SD ruling and original findings

REPRO erasure: integrated head -> outbound-comment erasure returned 409 instead of 200; release notes returned operator_active. The suspended-native refusal was removed while the active-member/invitation refusal remains. Only candidate-added post-suspension refusal assertions were removed from imported-person-erasure. The shipped outbound-comment and release-notes consumers are unchanged.

Dropping the guard exposed release-notes.test.ts:190: native name/email still remained. The existing person-erasure transaction now anonymizes matching removed native/auth identities and clears reversible suspension metadata, retaining removed state and human-authored release revisions. PROBE erasure: fixed -> the unchanged release-notes and outbound tests pass, together with imported-person erasure. This does not implement ROLE-012's separate native member preview, typed confirmation or complete member-erasure action.

REPRO personal-time: head -> personal-time.test.ts:227 received one operator_personal_time row rather than zero. Suspension now clears it in the same receipt-guarded transaction. PROBE personal-time: fixed -> the unchanged personal-time tests pass.

REPRO Boolean saved views: not reproduced on the candidate or comparison main 442b61455234c57befcb642bf4afdaa2dc459922. The unchanged journey returns the exact two saved-view issue identifiers, checks private-membership withdrawal, Guest admission and unchanged Viewer refusals. The broader Current phase also passed SEARCH-004 and all 59 checks. No Boolean test is edited.

REPRO administration: the first candidate command hit its external 900-second bound after 63 passes, before the historical final request assertion. The interrupted PROJ-009 attempt is retained as incomplete. An initial concurrent main attempt hit the fixed local-port collision and is retained separately. Complete sequential reruns with an external 1,800-second bound then passed: main 79/79 and exact e0acd71c candidate 80/80, with 79 clause journeys and 102 functional checkpoints. The historical integrations/channels ERR_ABORTED did not reproduce. Assertions and their own time limits are unchanged. Main's complete passing TAP summary is retained; its original outer-shell exit was not captured after environment reattachment. The candidate retry's actual exit is 0. CI administration also passed on e0acd71c.

REPRO original seven: original 806b1715d89a5383b5722b1b6c37a615b0665763 -> 7 failed/6 passed, Verify 42513319748. Fix1 already repaired those causes. Its public original excerpts and reproduction report were read from the existing evidence ref, without another workflow call. PROBE original seven: the same five-file command passes 13/13, and those tests pass again in the terminal 33-test run. No projection/session, upgrade-preservation or recipient-cleanup assertion is weakened.

## Additional CI findings and repairs

Exact-SHA Verify 42530676501 failed on e0acd71c. Its passing shards were imports, administration, collaboration, core-runtime-planning and hosted-artifact. The ordinary failed shards were core-runtime (job 128884258394), portability (128884258409) and worker-2 (128884258467), plus the final summary (128890014130). This was not classified as a generated-view-only failure.

One permitted job-specific archive command downloaded the run archive; its already-local contents supplied the other job excerpts without more GitHub calls. Commands/times/exits are in ci-receipt.json, job metadata in ci-jobs.json and assertions in ci-final-failure-excerpts.txt. Workflow environment blocks and generated private entry URLs are excluded/redacted in the published log copies.

REPRO archive receipt: exact e0acd71c -> data-roundtrip-fixture.mjs:44 failed "Complete archive category: operator_removals". The bounded local complete command reproduced it. Suspension had replaced the native receipt with member_lifecycle_events only. The repair retains a current compatibility receipt in operator_removals, before native revocation, while the lifecycle ledger keeps the full history. Reactivation removes only that current compatibility receipt, so later self-service token revocation cannot inherit the prior suspender's actor. A real token create/revoke after reactivation verifies the current member as audit actor.

PROBE archive receipt: fixed checkpoint 070baa9ac630996a95fd79d668a3f1af724681cf -> the same complete native round-trip command exits 0. Independent source/restored installations preserve complete categories and equality, two live attachments, private/shared view admission, native references, restore access/effect review, OAuth exclusions/history and no historical Cron replay. probe-roundtrip-native-proof.json contains the actual result. This full clone-based probe preceded the final merge of main's workflow-rule migration; terminal upgrade, automation archive and native checks are recorded separately.

REPRO agent event: e0acd71c -> agent-events.test.ts:42 expected the removed suspension erasure refusal (409), but got 200. The bounded local worker command reproduced it. This was another candidate-owned contradiction of the SD ruling. The test now restores main's actual explicit erasure call, Removed operator event expectation, no-old-name check and later agent_custody_unavailable hold. An additional assertion proves the name stays before explicit erasure. Existing native title-event redaction now runs inside the person-erasure transaction; native active/invitation admission is rechecked in that atomic batch as well. The rollback snapshot includes both receipt ledgers. No shipped main assertion is weakened.

PROBE agent event: fixed -> the test passes, including mounted MCP replay, native event redaction and the existing agent-custody hold. The lifecycle/public token-audit test passes as well; all are included in the terminal 33-test command.

REPRO stream reset: CI core-runtime timed out at core-stream-controls-journey.mjs:47, called from line 92 while returning from detail and resetting controls (30-second wait). The unmodified focused journey passes on both e0acd71c and comparison main at width 1440; the earlier complete Current phase passed both viewport invocations. No candidate cause was reproduced and no stream assertion or timeout was changed. This remains a CI-only observation for the fleet's fresh exact-SHA gate, not a claimed source fix.

## Latest-main integration and mechanical checks

Fresh main ea77c904 owns 0135_automation_rules.sql. Only the candidate migration was renumbered again: original 0134_member_suspension -> first 0135 -> terminal 0136_member_suspension.sql. Every one of main's 135 migration files retains exact bytes. Both parent archive inventories/policies survive the conflicts, including member metadata/lifecycle history and restored workflow-rule holds. Newer main tests, role doors, ID map and clause judgments remain intact. Candidate upgrade references, fixture comments, contract, generated spec and lock use 0136.

CONTRACT source was resolved first by its ROLE-011 line. It is the only row differing from latest main; every Status row matches main. Generated views were never hand-resolved or committed. The touched-clause write/check ran with ROLE-011, then ACCEPTANCE.md and docs/CLAIMS.md were restored whole from origin/main. The spec and SDK were regenerated; the source lock was generated last after staging and checked.

MECHANICAL ledger=node --test scripts/deployment/tests/migration-head.test.mjs exit=0; spec=node scripts/sync-integration.mjs --write and --check exit=0; lock=pnpm sources:lock and pnpm sources:check exit=0; views=node scripts/contract-docs.mjs write ROLE-011 and check ROLE-011 exit=0.

The terminal spec contains 136 migrations. SDK generation/check passes without a resulting SDK change. Mounted-route census: 384 routes and 27 Settings forms. Typecheck passes. Terminal worker run: 33 tests across 15 files, zero failures, including original regressions, both erasure consumers, lifecycle, populated upgrades, main's workflow-rule tests and project-field upgrade.

Native verification on the final staged tree exits 0: 1,139 declaration/contract checks, hydration over 16 pages/129 loads and 1,483/1,483 agent-door conformance points. The tested index tree e2ba3c75e9f8c24ce6cabf4041f87dfd1e0e7813 exactly equals aca2bf27220ae4cfbdf2c53b3903b9dd9bb09090's tree. Native latest-main receipts and terminal push receipts identify both parents and this exact tree. Fresh e0acd71c suspension/reactivation screenshots show the retained UI at 1440/390; receipt/table and title-erasure repairs add no UI changes.

Before -> after: done 136 -> 136; partial 72 -> 72; missing 64 -> 64; total 272 -> 272. ROLE-011 PARTIAL -> PARTIAL; ROLE-012 PARTIAL -> PARTIAL and its separate flow is still owed. No DONE point, clause judgment or acceptance is promoted.

## Limits, custody and cleanup

The two bounded 900-second attempts remain visible as failures/incomplete results. The full Current entrypoint completed its 59-check Current phase, then hit the outer bound in its independent projects phase; it is not claimed as a complete-command pass. Complete administration and archive reruns are reported distinctly. Generated local owner links are redacted from public receipts; settings, databases, cookies, credentials, private gate material and symlinks are never selected.

All functional repairs and latest-main merge are committed/pushed. There is no remaining reproduced local source blocker. The unresolved verification limit is the exhausted conservative GitHub budget: no exact-SHA success is observed for aca2bf27220ae4cfbdf2c53b3903b9dd9bb09090, and no READY is printed. The earlier core stream-reset timeout was not reproduced locally and is left unchanged. The final normal push uses the existing pre-main Verify entry point; the fleet must observe/rerun its own exact-SHA gate.

Evidence is published only to evidence/sd-vector-c-f207-fix2, independently of product custody. It never signals acceptance or landing. Owned browsers/servers stop through their own cleanup. After successful evidence publication/hash verification, the product and comparison checkouts and their node_modules are removed as requested; the packet stays outside them.
