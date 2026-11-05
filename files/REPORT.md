# sd-vector-c-f188 — native request forms

Product repository: just-every/run-vector.
Product branch: cloud/sd-vector-c-f188.
Candidate: 054db03cc1b5e61e0d7616e51a8bf8a7d31ff863.
First published save: 3fb52150. No PR is needed: a push of the named cloud branch starts Verify.

TRIAGE-004 remains PARTIAL → PARTIAL. Counts remain 136 DONE, 69 PARTIAL and 67 MISSING, with all 272 parent Status rows retained. No acceptance sentence or held requirement was removed. The only campaign row changed is TRIAGE-004: its Evidence now names the native journeys, and its Gap distinguishes the completed native cells from the held remainder. The clause's trailing Status description was updated to match the implementation. No other clause status changed.

The selected native cells are implemented. Settings → Teams → Automation publishes team request forms with required fields and help. The New intake screen selects a published form and submits typed, form-local answers. The native intake repository validates required answers and current form revision before allocating an issue identifier. Its existing guarded transaction then creates the real intake issue, evidence and activity, captures the exact form definition, revision and answers, and retains the existing triage notification and follower handling. The issue page and selected stream detail show the submitted revision and answers after reload and subsequent definition edits. Ordinary intake remains available.

Forms have stable identities, append-only revision records and publication withdrawal. A withdrawal affects new submissions; retained submissions keep their original definition and answers. Form-local text, number, choice and Boolean answers do not implement FIELD-001 custom fields. A zero numeric answer and a false Boolean answer satisfy a required field. Unknown fields, wrong types, invalid choices and missing required answers are refused. Current team authority is fenced again inside the transaction, as is the selected published revision.

Authority follows the existing ROLE-009 policy: workspace Owners and Admins and team owners publish; ordinary Members publish while team settings permit all members; invited Guests submit but never edit; Viewers cannot submit or edit. Current private visibility and membership withdrawal apply to the new doors. A revoked native session cannot commit a submission. The introduced matrix entry names the existing contract matrix row; the existing matrix probe and Viewer census were extended without deleting or weakening assertions.

Migration 0126 is additive. The prior 125 migration files are unchanged. Definitions, revisions and submission snapshots are classified portable domain data. The populated prior-head upgrade compares every existing table and checks foreign keys. The native HTTP archive journey exports and restores populated, edited definitions and original submitted answers, then reads them through authenticated native routes. Import snapshots include submission provenance only when present, retaining the shape of older snapshots; write, match and removal handling preserves that relation.

## Public-door probes

The consolidated mounted Worker journey is `tests/worker/request-forms.test.ts`, “published native forms retain exact versioned answers and enforce current team authority atomically”. Its public requests and business storage assertions cover:

PROBE TRIAGE-004 required-answer: POST /api/intake without Severity → 400; issues, evidence, submissions, activity, followers, notifications, receipts and sequence state unchanged.
PROBE TRIAGE-004 structured-answer: publish a form and POST native intake with Severity High, exact Unicode text, Count 0 and Blocked false → 201 real intake item; GET issue retains exact typed answers and submitted definition at revision 1 after the definition advances.
PROBE TRIAGE-004 stale-revision: submit or edit an obsolete revision → 409 without effects; change publication during intake commit → 409 with no partial issue or notification graph.
PROBE TRIAGE-004 authority: Owner, Admin, team owner and Member under all-members settings → admitted; same Member after team-owner restriction → 403; a restriction changing during commit → 409 and no unauthorized form or revision.
PROBE TRIAGE-004 invited-guest: Guest edits under both team settings → 403 unchanged; the same Guest's native submissions → 201 with exact answers; membership withdrawal → 404 on the next submission and form list.
PROBE TRIAGE-004 viewer-and-outsider: Viewer edits and submissions → 403 unchanged; private-team outsider list and submission → 404 with no exposed definition or changed domain storage.
PROBE TRIAGE-004 revoked-session: end the submitting session before native commit → 401; no submission, issue, evidence, activity or notification survives. Identifier reservations retain the existing non-reuse policy.
PROBE TRIAGE-004 notifications: native form intake with a configured two-person rotation → exactly one responsible recipient Inbox notice and one creation receipt; actor receives none.
PROBE TRIAGE-004 ordinary-intake: POST without a selected form → 201 ordinary intake, with no form provenance.
PROBE TRIAGE-004 upgrade-and-archive: populated prior schema upgrade preserves existing rows and valid foreign keys; native archive export and authenticated restore retain both current form revision 2 and original submitted revision 1 with exact answers.
PROBE TRIAGE-004 rendered-native: Settings form authoring → New intake → real triage item → reload → edit form → reload original item retains its original definition and answers. Rendered author, submit and saved screens captured at 1440 and 390, with keyboard focus, accessibility, overflow and hydration assertions in `tests/e2e/core-request-forms-journey.mjs`.

The browser helper is invoked by the existing planning branch of `tests/e2e/core-runtime.mjs`, so the existing push Verify path reaches it. Its additional focused argument is for local execution; no workflow was edited and no existing journey was moved out of its CI path. All behavioral assertions use 1440; 390 is the corresponding phone screen and overflow proof. Six screenshots are included in the packet.

## Validation and development findings

Exact-HEAD receipts and final command outcomes are in RECEIPTS.json. The full non-secret plan is PLAN.md. MIGRATION-RECEIPT.json records the additive migration integrity comparison. The JSON output of `rer check --profile first-party` is included.

During development the existing role probes and Viewer census initially reported missing coverage for the new registry entry and write doors. The fixtures were extended, keeping their enforcement and unchanged-storage assertions. The populated-upgrade helper was corrected to sort by real columns because some existing tables have no rowid. The browser helper's Team selector was corrected to use the existing accessible label. These are fixed development failures, not CI repair rounds.

The first optional import snapshot implementation duplicated the existing large snapshot SQL expression and caused SQLITE_NOMEM in the import regression journeys. It now evaluates the original snapshot once and merges only the optional form relation. Existing atomic import, replay, order and rollback journeys pass after that fix. Temporary diagnostic code and the temporary probe test were removed. No test assertion was removed, narrowed, skipped or weakened. One consolidated Worker journey was added; existing archive and authority journeys were extended. No permanent per-point tests or pin tests were added.

MECHANICAL lock=`pnpm sources:lock` followed by `pnpm sources:check`; views=`node scripts/contract-docs.mjs write TRIAGE-004` followed by `node scripts/contract-docs.mjs check TRIAGE-004`, both passed, then restored main's ACCEPTANCE.md and docs/CLAIMS.md; ledger=125 applied migration sources unchanged plus populated forward-upgrade and foreign-key checks. Final exact-HEAD outcomes are in RECEIPTS.json. Source lock was generated after all product and contract edits. Generated views and workflow files are absent from both product commits.

## DONE riders and limits

1. Selected native outcomes have mounted and rendered sanity journeys. Whole-clause completion is not claimed: the Slack shortcut outcome and other held receiving integrations remain unproved.
2. Supported and refused paths use populated real local D1 and native routes; security refusals assert unchanged domain storage. Exact typed data and a populated archive are read back.
3. The Worker glob and existing planning runtime load the new proof in push Verify. Exact-SHA CI status is recorded separately; local proof does not claim a green workflow.
4. Final receipts bind the committed candidate. Earlier development logs are not substituted for final proof.
5. ROLE-009 authority is already named in TRIAGE-004. No new Base inheritance or receiving duty is claimed.
6. Evidence and Gap are updated. Generator write and check pass locally; generated views are intentionally restored for the lander. The clause stays PARTIAL.
7. Acceptance text and every original Status row are retained. Only the clause's trailing status description, Evidence and Gap changed.
8. Owner and team-authorized writes are exercised, as are refused Member, Guest, Viewer, private outsider and revoked-session paths with no unauthorized effects.
9. No live Slack, Teams, provider, hosted or customer receipt is claimed.
10. No new custody, consent, spending or authority policy was adopted. Existing ROLE-009 and native intake policy remain the source of authority.
11. Publication scan, guarded landing, main equality, candidate Run site and independent interface judgment remain fleet gates. This cloud pushed neither main nor another product branch.

The selected controls use existing app styling, labelled text buttons and native labelled controls. No new icon-only control was introduced. Form text is at least 13px, inputs have complete borders, and configuration is under Settings. The supplied Claude Opus interface qualification and independent gate remain explicitly unqualified; this Codex implementation does not claim either.

Held remainder: Slack shortcut submission and its second triage item, Teams, form operations through /api/v1, ISSUE-016 template association, FIELD-001 typed and required custom fields, ISSUE-021 and CUST-006 and CUST-008 receiving integration, and broader channel qualification. TRIAGE-001's producer and channel qualification and TRIAGE-002 routing remain separate and held. The declared repository was the only cloned or written product repository. No deployment, extra provider workflow, main push, PR or direct inbox write was performed.

Final local validation: all six touched Worker files passed, 12 tests total, on the committed candidate. The final build with typecheck, first-party check, source-lock check and focused browser run also passed on this HEAD. No local command remains pending. Verify run 42125063262 was in progress at its 22:57 UTC poll; a later CI receipt, if present, supersedes that observation. No known local blocker remains.
