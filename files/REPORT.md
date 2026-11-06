# sd-vector-c-f192-pc1 results

Product: just-every/run-vector, cloud/sd-vector-c-f192-pc1 at 939525d461cfef7418f8563e5b05904179b98938. The guard pushed this head successfully on its first attempt. No pull request is required by the repository: branch pushes start Verify. Both prior published commits remain ancestors and main was already an ancestor at e6010126cf33eeb7e70368b741bf89ba9dae2672. No published history was rewritten.

ROLE-006: PARTIAL → PARTIAL in this continuation; the campaign had already moved MISSING → PARTIAL at the starting head. Counts remain 136 DONE, 70 PARTIAL, 66 MISSING, 272 total. Every parent Status row is retained; the full table's 409 pipe-prefixed rows are unchanged. The only campaign plan row updated is ROLE-006's continuation result. No acceptance sentence, clause scope, held duty or other plan row changed.

This continuation repairs three reproduced failures from Verify 42142856859. The complete plan is PLAN.md, the failing command and real nonzero exit records are VERIFY_REPRODUCED.json, and actual local command outputs and terminal custody are retained in this packet.

## Repairs and reproduction

1. Job 127647613875, worker-2: the exact shard command failed in source-ingest.test.ts, triageUpgrade. Historical audit rows had the three nullable actor columns added by migration 0126, while the expected preserved rows still had the previous ten columns. The repaired upgrade expectation retains every old value and explicitly requires all new actor provenance to be null for historical people. The issue activity additions are checked the same way. No equality assertion was narrowed.
2. Job 127647613996, imports: the exact shard command failed all three stale issue projection races with `expected false to be true` at issue-session-projection.test.ts:79. The scheduler hook matched the old SELECT list, so the new attribution projection never reached the hook. The hook now identifies the same activity read by its source and predicate, and the unchanged assertions require projection, actual native signout, a 401 denial and unchanged storage for edit, accept and return.
3. Job 127647614031, hosted-artifact: the exact shard command reached rer verify, built successfully, and failed integration:check with `Stale integration management/integration/deployment-spec.json; build the application and regenerate with pnpm integration:sync`. The supported generator adds migration 0126 and its digest to the deployment recipe. No workflow or Base pin changed.

Each required prior-job log archive command was called once. All three returned exit zero and empty stdout, so the failures above come from the actual local reproductions, not inferred CI log content. There was no blocked blob-download retry. The prior aggregate verify job only reflects failed dependencies.

Setup created private development settings that affected first-owner fixture configuration. The same first-run failure reproduced on main on this runner; main's source-ingest and issue-session races passed. After isolating those generated private settings outside the checkout, main's first-run and Base-auth files passed, 10 tests in two files. This was an environment correction, with no product or assertion change. The corrected candidate also passes both files.

## Validation and public-door probes

Seven affected Worker files pass, 23 registered tests: integration-api.test.ts, data-http.test.ts, project-fields-upgrade.test.ts, issue-session-projection.test.ts, source-ingest.test.ts, base-auth.test.ts and first-run.test.ts. These ran against the exact committed source and test bytes immediately before the commit; only source-lock regeneration followed. Typecheck, first-party rer check and integration:check pass. No test registration was added or removed, and no existing assertion was removed, skipped, narrowed or put behind a condition.

The existing exerciseAppActors browser journey passed on the committed and pushed head at 1440 and 390. It opens real native Settings, installs the actor, closes the one-time credential, changes a title through the mounted versioned API, reloads activity and workspace audit, then uses a separately signed-in Admin's keyboard pause and revoke controls. Refused follow-up calls leave the title and agent audit unchanged. Eight actual captures cover installed management, attributed issue, populated audit and revoked Admin readback at both widths. The journey checks keyboard focus, serious and critical accessibility findings, overflow and hydration. The captures contain no credential. System Chromium is used with the required sandbox flag; browsers and the runtime were closed.

PROBE ROLE-006 install: native POST /api/settings/app-actors with a named identity, one team and explicit read and title-write scopes -> 201, separate credential; management readback never returns it. app-actor-journey.ts lines 12–24.
PROBE ROLE-006 mutation: versioned issue detail read and title PATCH -> 200, saved own actor ID and name plus installer; native activity and workspace audit agree after restart. app-actor-journey.ts lines 25–33; browser lines 27–38.
PROBE ROLE-006 revoke: native Admin pause and terminal revoke -> subsequent read and title PATCH return 401, retained attributed history remains. app-actor-journey.ts lines 112–119; browser lines 44–56.
PROBE ROLE-006 commit fence: Admin pause before the native edit batch and revocation after activity insertion -> 401, no issue, activity or agent-audit write survives. app-actor-journey.ts lines 99–111.
PROBE ROLE-006 authority: unsupported mutations, read-only scopes, foreign team and workspace, private access withdrawal, Viewer and Guest roles, missing or ended sessions, personal tokens and foreign Origin -> refused with unchanged checked storage. app-actor-journey.ts lines 34–98.
PROBE ROLE-006 erasure: erase the installer -> remaining credentials refused, installer name redacted, safe actor history retained and a later person edit stays attributed to the person. app-actor-journey.ts lines 120–132.
PROBE ROLE-006 restore: native HTTP archive export and pristine restore -> actor, installer, activity and audit preserved; credential table and secret excluded; retained credential cannot read or write. app-actor-archive.ts lines 8–35 through data-http.test.ts.
PROBE ROLE-006 upgrade: populated prior-head migration -> all existing values retained, historical actor fields null and native archive export completes. viewer-role-upgrade.ts and triage-upgrade.ts through the existing Worker registrations.

## Mechanical and publication custody

MECHANICAL lock=pnpm sources:lock then pnpm sources:check exit=0; views=node scripts/contract-docs.mjs write ROLE-006 then check ROLE-006 exit=0; generated ACCEPTANCE.md and docs/CLAIMS.md restored whole from origin/main and not committed. ledger=node --test scripts/deployment/tests/migration-head.test.mjs exit=0 (the complete migration history applies, retains guards and repeats without writes on the exact candidate). The source lock was regenerated last, the tree was clean on push, and no new email-shaped string was added.

Before the push, the complete candidate history including side parents was checked with the required Git log format. All three candidate commits have fleet author and committer identities and no prohibited coauthor trailer. The product push uses only the named cloud branch. No evidence file is committed on that product branch. Report publication uses only the separate evidence ref.

## DONE-RIDERS review

No DONE claim is made. These are checks of the selected native slice, with the full-clause limits retained.

1. Selected native install, attribution and refusal outcomes are reached by the mounted journeys above. Broader actor families and other mutations remain unqualified, so full-clause DONE remains unmet.
2. Allowed writes complete on real seeded data; unsafe calls and races are refused with unchanged storage. Pass for this slice.
3. The existing push Verify includes integration-api.test.ts, data-http.test.ts and the integration runtime. Exact candidate run 42159071007 is pending until terminal CI status below is recorded.
4. Browser receipt names the exact pushed SHA; Worker code and test bytes did not change after their passing run. Pass for local evidence freshness.
5. Existing session, visibility, erasure, archive and Base custody duties are preserved; no new DONE inheritance claim or acceptance rewrite. Preserved.
6. PARTIAL Gap still names all missing qualification and policy boundaries. The generator write and check pass; generated views are restored for the lander. No empty DONE Gap or new judged claim is asserted.
7. No acceptance point changed. Pass.
8. Both authorized and refused authority paths and in-flight fences pass through mounted native doors. Personal grants and Base Owner-only Business management remain unchanged.
9. Only native fixture and local runtime proof is claimed. No provider, legal or hosted commissioning claim is added. Pass.
10. The recorded conservative Owner or Admin native installation floor stays PARTIAL; broader delegation and provider policy are not released. No scope ASK is needed under the supplied standing rule.
11. Guarded landing, main equality, publication scan and Run site remain fleet gates. This cloud cannot establish them and does not claim a landing.

## Limits and plan return

Held remainder is unchanged: broader integration, automation and coding-agent actors, other mutations, third-party OAuth app actors and AGENT-006 delegation, session and callback transports. Independent interface qualification remains outstanding. Personal grant boundaries, Base Owner-only Business administration, API-004 consent and UI gate, AGENT-005, AGENT-006, CONNECT-001, ROLE-011, ROLE-012 and existing Base approval custody remain owed. No held authority is widened. No local acceptance-breaking defect remains after the passing repairs.

Final exact-SHA Verify status, receipt transfer and terminal branch custody will be appended after polling within the ten-call budget. Publication scan and guarded landing remain the fleet's independent responsibility.
