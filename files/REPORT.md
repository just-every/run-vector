# sd-vector-c-f207-fix1 — BLOCKED

Repository: just-every/run-vector. Product branch: cloud/sd-vector-c-f207-fix1.
Product head: 5b5292f80ce0b391e972787c338489c04e40af3d.
Original candidate: 806b1715d89a5383b5722b1b6c37a615b0665763.
Integrated main: 0e8a686c06eddd55943ed1d2690df32a8fc82213.

Product push succeeded on the first guard attempt. Two new fleet-authored commits preserves the published candidate's history. The tested final index tree b718c9ba137b6cd3cc65c62bebc30b7f7c78d1c4 exactly matches the published commit tree. No PR was created; the brief assigns custody to the fleet lane. No main/default-branch push, history rewrite, publication scan, deployment or landing is claimed.

## Plan and scope

The complete seven-step plan is in PLAN.md. Fleet setup and hooks preceded the fresh full-history filtered clone. The candidate branch was fetched and its exact expected SHA printed. Fresh main fetch/merge attempts reported already up to date because main is an ancestor. Main's CONTRACT judgments, ID-MAP, tests and migration bytes remain intact. Main ends at 0133_release_notes.sql, so candidate 0134 has no collision and was not renumbered. No unprovided ruling was needed.

Only seven files change from the published candidate: the issue activity projection, transactional suspension cleanup, the candidate's collaboration-mail and browser pagination expectations, the triage populated-upgrade fixture, generated deployment specification and generated source lock. CHANGES.md explains each change. The original seven failing assertions are unchanged; the candidate-added contradictory Inbox retention expectation is restored to main's explicit zero-notification check, with exact preference and mute retention checks preserved. No test is deleted, skipped or weakened, and no timeout is raised. No UI is changed in this FIX round.

## Reproduction and repair

Original exact-SHA Verify 42513319748 failed. Its failed-job archives were read once for jobs 128831161230, 128831161235, 128831161241 and 128831161257. The hosted-artifact archive ended during source-lock output and supplied no terminal assertion; the complete seven assertions are present in the other three archives. No retry of a blocked blob or archive was attempted. original-failures.txt and REPRO.md preserve the relevant non-secret evidence.

REPRO seven: head -> 7 failed, 6 passed, 13 total; exit 1.
PROBE seven: fixed -> 13 passed, 0 failed; exit 0 in the exact same five-file command on the final code. The same 13 tests passed on main on this runner. A final expanded command including collaboration-mail and member suspension passed all 17 tests.

The three stale edit/accept/return session tests now observe the original activity read and enforce native session revocation at final admission. Suspended-person names come from the existing snapshot, while agent/stored attribution remains intact. The internal selection flag is stripped before returning activity. The final projection adds no correlated SQL lookup.

The populated upgrade fixture now expects the exact null defaults for suspended_at and suspended_by while retaining every pre-existing value assertion. Project recipient notifications, document recipient notifications/followers and subject subscriptions are cleared in the suspension transaction. Personal settings, private views, history and subscription event receipts remain retained.

REPRO spec: head -> integration:check exit 1, stale deployment-spec.json.
PROBE spec: fixed -> integration:check exit 0. The generator adds byte-identical 0134_member_suspension.sql; spec migration entries increase 133 -> 134.

The full browser command reproduced the same contradiction at collaboration-pagination.mjs:114, with the first 24 browser checks passing and recipient custody correctly empty instead of 40 retained rows. A focused Chromium 1440 run of that existing journey passed after the correction: 31 real UI comments, 32 actual notifications across both pages, zero recipient rows after suspension, preferences retained and cached pages/session admission checked. The full existing command passed on the final head at both 1440 and 390: 53 tests, 52 clause journeys, 122 functional checkpoints and 10 live timings; zero failures or skips. Assertions and browser time limits are unchanged.

## Verification

Typecheck passes on the final code. The mounted-route inventory passes with 374 routes and 27 Settings forms. All nine deployment tests pass, including migration-head ledger consistency and no-write repeat application. Build passed. Native rer verify passed again on final head 5b5292f80ce0b391e972787c338489c04e40af3d: 1,139 declaration/contract checks, hydration over 16 pages/129 loads and 1,483 agent-door conformance points. The final exact-SHA CI result and pinned reruns are recorded below and in RECEIPT.json. checks.jsonl contains actual bounded commands, timestamps and exits, including failed intermediate runs.

The broader local regression run exposed the contradictory candidate Inbox assertion, which was corrected. It also hit two unchanged role timeouts under Node 24; after restoring the base activity query, both the second role run and the pinned Node 22.20.0 role run passed five tests and hit the unchanged 120-second visibility-journey timeout. No role assertions or time limits changed. The detached-main comparison on the same VM also failed two of the six unchanged role tests; its exact failures are retained in role-main-pinned-comparison.log. None of these local timing results is described as a pass. Final exact-SHA CI remains the required readiness gate.

MECHANICAL ledger=pnpm test:deployment exit=0; spec=pnpm integration:sync and pnpm integration:check exit=0; lock=pnpm sources:lock and pnpm sources:check exit=0; views=node scripts/contract-docs.mjs write ROLE-011 and node scripts/contract-docs.mjs check ROLE-011 exit=0.

The two generated view files were then restored whole with git checkout origin/main -- ACCEPTANCE.md docs/CLAIMS.md and are not committed. CONTRACT.md is byte-identical to main. The source lock was regenerated last after staging all seven fix files and its check passed.

Before -> after counts: done 136 -> 136; partial 72 -> 72; missing 64 -> 64; total 272 -> 272. ROLE-011 PARTIAL -> PARTIAL. No DONE point or clause judgment changes and no acceptance/landing claim.

## Custody and final results

BLOCKED: exact-SHA Verify 42521374619 completed/failure on 5b5292f80ce0b391e972787c338489c04e40af3d: https://github.com/just-every/run-vector/actions/runs/42521374619. This is ordinary verification red, not a generated-view-only failure. No READY or landing claim is made.

The original seven assertions are repaired and the spec is regenerated, but the now-reachable verification tail reveals five further failing tests across four shards:

- administration: tests/e2e/admin-runtime.mjs:250 records net::ERR_ABORTED for /api/settings/integrations/channels after 79 passing checks;
- imports: tests/worker/personal-time.test.ts:227 expects no operator_personal_time row after removal, but receives one;
- portability: tests/worker/outbound-comment-journey.ts:153 and tests/worker/release-notes.test.ts:184 expect successful erasure (200) after native removal, but receive operator_active (409);
- core-runtime: tests/e2e/core-boolean-filter-journey.mjs:106 expects two saved-view identifiers and receives an empty list.

The concrete lease blocker is the erasure policy conflict. The candidate's leased src/core/features/data/erasure/service.ts:12-18 deliberately refuses a suspended native identity and says ROLE-012's separate erasure is required. Its tests/worker/imported-person-erasure.test.ts:255-265 explicitly require 409 after suspension and unchanged retained records/journal. The two legacy consumers above are outside this FIX lease and require 200 for the same class of suspended identity. Dropping the guard breaks the candidate protection assertions; weakening those assertions or adding/admitting a separate native member erasure flow makes a new ROLE-012 judgment outside this blocking list. No default in this brief authorizes that change. The stop rule applies: product edits halted, with no further commit or push after the red result.

The lane needs a follow-up lease/ruling for the native suspension-to-erasure transition and the listed legacy fixtures, plus diagnosis of the remaining administration/saved-view failures. Exact public-safe assertion excerpts are in final-failure-excerpts.txt. No failure is classified as harmless or accepted by the generated-view exemption.

The tenth and final GitHub CLI invocation was `gh run view 42521374619 --repo just-every/run-vector --log-failed`. With one budgeted call remaining, it used the brief's whole failed-run archive form rather than a separate job-ID listing call. It succeeded; failed step archives were read once, with no direct job-log blob retries, additional credentials or extra observations.

The full browser command and final native rer verify passed on the final head. Their success does not supersede the red exact-SHA workflow. Failed intermediate and baseline timing runs remain in RECEIPT.json/checks.jsonl.

Product commits are 58cceb1b4cd7ea8aeb8f55ef28cfd26fc27d19d9 and 5b5292f80ce0b391e972787c338489c04e40af3d; both were pushed on their first guard attempt after full identity/trailer scans, as required by cloud work preservation. They were published before the additional failures were observed. The brief's blocked-exit “push nothing” cannot be applied retroactively without rewriting published history. Neither published commit is discarded or rewritten. Save run 42520155621 was superseded and was never claimed green. Product head remains 5b5292f80ce0b391e972787c338489c04e40af3d. PR: none.

ROLE-011 remains PARTIAL. Counts remain 136 done / 72 partial / 64 missing of 272. Evidence is report-only, never product READY, acceptance or landing. Cleanup follows verified evidence publication; the final terminal message records its result.

POST lanes/sd/INBOX.md: sd-vector-c-f207-fix1 BLOCKED after original seven fixes and spec regeneration; head=5b5292f80ce0b391e972787c338489c04e40af3d; Verify=42521374619 completed/failure; erasure policy conflicts with unleased outbound/release fixtures, plus personal-time/admin/saved-view failures; ROLE-011 PARTIAL and counts unchanged; ten GitHub calls used; no READY or landing claim.

